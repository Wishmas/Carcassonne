import express from 'express';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Server, type Socket } from 'socket.io';
import { applyAction, createGame, publicState } from '../shared/engine';
import type { GameAction, Session } from '../shared/types';
import { MemoryRoomRepository, roomView, type Room, type RoomRepository } from './rooms';

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const codeOf = (value: unknown) => text(value, 6).toUpperCase();
function parseAction(value: unknown): GameAction {
  if (!value || typeof value !== 'object') throw new Error('Некорректное действие');
  const a = value as Record<string, unknown>;
  if (a.type === 'rotateTile' || a.type === 'skipMeeple' || a.type === 'undo') return { type: a.type };
  if (a.type === 'placeTile' && typeof a.x === 'number' && typeof a.y === 'number' && Number.isSafeInteger(a.x) && Number.isSafeInteger(a.y)) return { type: a.type, x: a.x, y: a.y };
  if (a.type === 'placeMeeple' && typeof a.featureId === 'string' && a.featureId.length < 30) return { type: a.type, featureId: a.featureId };
  throw new Error('Некорректное действие');
}
export function createApp(repository: RoomRepository = new MemoryRoomRepository()) {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { maxHttpBufferSize: 16_384 });
  const tokens = new Map<string, { code: string; playerId: string }>();
  const connections = new Map<string, Set<string>>();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(express.static(resolve('dist')));
  app.get('/', (_req, res) => res.sendFile(resolve('dist/index.html')));

  function publish(room: Room) {
    room.updatedAt = Date.now(); repository.save(room);
    io.to(room.code).emit('roomUpdated', roomView(room));
    if (room.game) io.to(room.code).emit('gameState', publicState(room.game, Boolean(room.undo)));
  }
  function attach(socket: Socket, room: Room, playerId: string) {
    if (socket.data.playerId) throw new Error('Вы уже в комнате. Сначала выйдите из неё.');
    socket.data.code = room.code; socket.data.playerId = playerId;
    const ids = connections.get(playerId) ?? new Set<string>(); ids.add(socket.id); connections.set(playerId, ids);
    room.players.find(p => p.id === playerId)!.connected = true;
    socket.join(room.code);
  }
  function getRoom(socket: Socket) {
    const room = repository.get(socket.data.code);
    if (!room || !room.players.some(p => p.id === socket.data.playerId)) throw new Error('Сначала войдите в комнату');
    return room;
  }
  io.on('connection', socket => {
    let count = 0, since = Date.now();
    function safely<T>(event: string, handler: (data: T) => void) {
      socket.on(event, (data: T) => {
        try {
          if (Date.now() - since > 10_000) { since = Date.now(); count = 0; }
          if (++count > 80) throw new Error('Слишком много действий. Подождите несколько секунд.');
          handler(data);
        } catch (error) { socket.emit('actionRejected', { message: error instanceof Error ? error.message : 'Ошибка действия' }); }
      });
    }
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token) {
      const session = tokens.get(token), room = session && repository.get(session.code);
      if (session && room) {
        attach(socket, room, session.playerId);
        socket.emit('roomJoined', { room: roomView(room), session: { ...session, token } }); publish(room);
      } else socket.emit('sessionExpired', { message: 'Комната больше не существует. Возможно, сервер был перезапущен.' });
    }
    safely<Record<string, unknown>>('createRoom', data => {
      if (socket.data.playerId) throw new Error('Вы уже в комнате');
      const name = text(data?.name, 24);
      if (!name) throw new Error('Укажите своё имя');
      const capacity = data?.capacity;
      if (capacity !== 2 && capacity !== 3 && capacity !== 4) throw new Error('Выберите от 2 до 4 игроков');
      if ([...repository.all()].length >= 500) throw new Error('Сервер заполнен, попробуйте позже');
      let code: string;
      do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (repository.get(code));
      const playerId = randomUUID(), token = randomBytes(32).toString('hex');
      const room: Room = { code, hostId: playerId, capacity, allowPartial: data.allowPartial === true,
        players: [{ id: playerId, name, connected: true, ready: false }], game: null, undo: null, updatedAt: Date.now() };
      tokens.set(token, { code, playerId }); repository.save(room); attach(socket, room, playerId);
      socket.emit('roomCreated', { room: roomView(room), session: { code, playerId, token } satisfies Session }); publish(room);
    });
    safely<Record<string, unknown>>('joinRoom', data => {
      if (socket.data.playerId) throw new Error('Вы уже в комнате');
      const room = repository.get(codeOf(data?.code)), name = text(data?.name, 24);
      if (!name) throw new Error('Укажите своё имя');
      if (!room) throw new Error('Комната с таким кодом не найдена');
      if (room.game) throw new Error('Партия уже началась');
      if (room.players.length >= room.capacity) throw new Error('В комнате нет свободных мест');
      const playerId = randomUUID(), token = randomBytes(32).toString('hex');
      room.players.push({ id: playerId, name, connected: true, ready: false }); tokens.set(token, { code: room.code, playerId }); attach(socket, room, playerId);
      socket.emit('roomJoined', { room: roomView(room), session: { code: room.code, playerId, token } satisfies Session }); publish(room);
    });
    safely('setReady', ready => {
      const room = getRoom(socket);
      if (room.game) throw new Error('Партия уже началась');
      room.players.find(p => p.id === socket.data.playerId)!.ready = ready === true; publish(room);
    });
    safely('startGame', () => {
      const room = getRoom(socket);
      if (room.hostId !== socket.data.playerId) throw new Error('Начать партию может только создатель');
      if (room.game) throw new Error('Партия уже началась');
      if (room.players.length < 2 || (!room.allowPartial && room.players.length < room.capacity)) throw new Error('Дождитесь нужного числа игроков');
      if (room.players.some(p => !p.ready || !p.connected)) throw new Error('Все игроки должны подключиться и подтвердить готовность');
      room.game = createGame(room.players); room.undo = null;
      io.to(room.code).emit('gameStarted'); publish(room);
    });
    safely('gameAction', data => {
      const room = getRoom(socket), action = parseAction(data);
      if (!room.game) throw new Error('Партия ещё не началась');
      if (room.game.players[room.game.activePlayer].id !== socket.data.playerId) throw new Error('Сейчас ход другого игрока');
      if (action.type === 'undo') {
        if (!room.undo || room.game.phase !== 'placingMeeple') throw new Error('Можно отменить только размещение в текущем ходу');
        room.game = room.undo; room.undo = null;
      } else {
        const previous = room.game;
        room.game = applyAction(previous, socket.data.playerId, action);
        if (action.type === 'placeTile') room.undo = previous;
        if (action.type === 'placeMeeple' || action.type === 'skipMeeple') room.undo = null;
      }
      publish(room);
      if (room.game.phase === 'gameOver') io.to(room.code).emit('gameFinished');
    });
    safely('restartGame', () => {
      const room = getRoom(socket);
      if (room.hostId !== socket.data.playerId || room.game?.phase !== 'gameOver') throw new Error('Новая партия доступна создателю после завершения игры');
      room.game = createGame(room.players); room.undo = null; io.to(room.code).emit('gameStarted'); publish(room);
    });
    socket.on('disconnect', () => {
      const room = repository.get(socket.data.code), playerId = socket.data.playerId;
      if (!room || !playerId) return;
      const ids = connections.get(playerId); ids?.delete(socket.id);
      if (!ids?.size) { connections.delete(playerId); room.players.find(p => p.id === playerId)!.connected = false;
        io.to(room.code).emit('playerDisconnected', { playerId }); publish(room); }
    });
  });
  const cleanup = setInterval(() => {
    for (const room of repository.all()) if (room.players.every(p => !p.connected) && Date.now() - room.updatedAt > 86_400_000) {
      repository.delete(room.code);
      for (const [token, session] of tokens) if (session.code === room.code) tokens.delete(token);
    }
  }, 60_000);
  cleanup.unref(); http.on('close', () => clearInterval(cleanup));
  return { app, http, io, repository };
}
