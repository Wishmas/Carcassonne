import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as client, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { legalPositions, publicState } from '../shared/engine';
import type { GameView, RoomView, Session } from '../shared/types';

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timeout waiting for ${event}`)); }, 5000);
    function handler(value: T) { clearTimeout(timer); resolve(value); }
    socket.once(event, handler);
  });
}
describe('authoritative multiplayer server', () => {
  let server: ReturnType<typeof createApp>, url: string;
  const sockets: Socket[] = [];
  beforeEach(async () => { server = createApp(); await new Promise<void>(resolve => server.http.listen(0, '127.0.0.1', resolve)); url = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`; });
  afterEach(async () => { for (const socket of sockets.splice(0)) socket.disconnect(); await new Promise<void>(resolve => server.io.close(() => resolve())); });
  async function connect(token?: string) { const socket = client(url, { autoConnect: false, transports: ['websocket'], auth: { token } }); sockets.push(socket); const ready = once(socket, 'connect'); socket.connect(); await ready; return socket; }
  async function setup() {
    const a = await connect(), b = await connect();
    const created = once<{ session: Session; room: RoomView }>(a, 'roomCreated'); a.emit('createRoom', { name: 'Анна', capacity: 2 }); const first = await created;
    const joined = once<{ session: Session; room: RoomView }>(b, 'roomJoined'); b.emit('joinRoom', { name: 'Борис', code: first.room.code }); const second = await joined;
    const readyA = once(a, 'roomUpdated'); a.emit('setReady', true); await readyA;
    const readyB = once(a, 'roomUpdated'); b.emit('setReady', true); await readyB;
    const started = once<GameView>(a, 'gameState'), startedB = once<GameView>(b, 'gameState'); a.emit('startGame'); const [game] = await Promise.all([started, startedB]);
    return { a, b, first, second, game };
  }
  it('creates and joins a room, keeps tokens private and hides the deck', async () => {
    const { first, second, game } = await setup();
    expect(first.room.code).toMatch(/^[A-F0-9]{6}$/); expect(second.room.players).toHaveLength(2);
    expect(JSON.stringify(second.room)).not.toContain(first.session.token); expect('deck' in game).toBe(false);
  });
  it('rejects non-active players, malformed payloads, fake tiles and invalid placement', async () => {
    const { a, b, first } = await setup();
    let error = once<{ message: string }>(b, 'actionRejected'); b.emit('gameAction', { type: 'rotateTile' }); expect((await error).message).toContain('другого игрока');
    error = once(a, 'actionRejected'); a.emit('gameAction', null); expect((await error).message).toContain('Некорректное');
    const before = publicState(server.repository.get(first.room.code)!.game!);
    error = once(a, 'actionRejected'); a.emit('gameAction', { type: 'placeTile', x: 99, y: 99, definitionId: 'city-full' }); expect((await error).message).toContain('Стороны');
    expect(publicState(server.repository.get(first.room.code)!.game!)).toEqual(before);
    error = once(b, 'actionRejected'); b.emit('restartGame'); expect((await error).message).toContain('Новая партия');
  });
  it('broadcasts the same placement to two clients, validates undo and closes undo at turn end', async () => {
    const { a, b, first } = await setup();
    let state = server.repository.get(first.room.code)!.game!;
    while (!legalPositions(state.board, state.currentTile!).length) { const rotated = once(a, 'gameState'), rotatedB = once(b, 'gameState'); a.emit('gameAction', { type: 'rotateTile' }); await Promise.all([rotated, rotatedB]); state = server.repository.get(first.room.code)!.game!; }
    const position = legalPositions(state.board, state.currentTile!)[0];
    const pa = once<GameView>(a, 'gameState'), pb = once<GameView>(b, 'gameState');
    a.emit('gameAction', { type: 'placeTile', ...position, definitionId: 'fake-client-tile' }); const [ga, gb] = await Promise.all([pa, pb]);
    expect(ga).toEqual(gb); expect(Object.keys(ga.board)).toHaveLength(2); expect(ga.canUndo).toBe(true);
    expect(Object.values(ga.board).some(t => t.definitionId === 'fake-client-tile')).toBe(false);
    let error = once<{ message: string }>(b, 'actionRejected'); b.emit('gameAction', { type: 'undo' }); expect((await error).message).toContain('другого игрока');
    const undo = once<GameView>(a, 'gameState'), undoB = once(b, 'gameState'); a.emit('gameAction', { type: 'undo' }); const [undone] = await Promise.all([undo, undoB]); expect(Object.keys(undone.board)).toHaveLength(1);
    const placed = once(a, 'gameState'), placedB = once(b, 'gameState'); a.emit('gameAction', { type: 'placeTile', ...position }); await Promise.all([placed, placedB]);
    const passed = once<GameView>(b, 'gameState'); a.emit('gameAction', { type: 'skipMeeple' }); expect((await passed).activePlayer).toBe(1);
    error = once(b, 'actionRejected'); b.emit('gameAction', { type: 'undo' }); expect((await error).message).toContain('Можно отменить');
  });
  it('restores identity and state using the session token after disconnection', async () => {
    const { a, b, first, game } = await setup();
    const disconnected = once(b, 'playerDisconnected'); a.disconnect(); expect((await disconnected).playerId).toBe(first.session.playerId);
    const reconnected = client(url, { autoConnect: false, transports: ['websocket'], auth: { token: first.session.token } }); sockets.push(reconnected);
    const joined = once<{ session: Session; room: RoomView }>(reconnected, 'roomJoined'), synced = once<GameView>(reconnected, 'gameState'); reconnected.connect();
    expect((await joined).session).toEqual(first.session); expect(await synced).toEqual(game);
  });
  it('does not allow a joiner to start, join a full room, or reuse an expired token', async () => {
    const { a, b, first } = await setup(); const third = await connect();
    let error = once<{ message: string }>(third, 'actionRejected'); third.emit('joinRoom', { code: first.room.code, name: 'Третий' }); expect((await error).message).toContain('Партия уже началась');
    error = once(b, 'actionRejected'); b.emit('startGame'); expect((await error).message).toContain('создатель');
    const expired = client(url, { autoConnect: false, auth: { token: 'no-such-token' } }); sockets.push(expired);
    const response = once<{ message: string }>(expired, 'sessionExpired'); expired.connect(); expect((await response).message).toContain('не существует');
    expect(a.connected).toBe(true);
  });
  it('requires two ready connected players and respects room capacity before starting', async () => {
    const a = await connect(), b = await connect(), third = await connect();
    const created = once<{ session: Session; room: RoomView }>(a, 'roomCreated'); a.emit('createRoom', { name: 'Анна', capacity: 2 }); const { room } = await created;
    let error = once<{ message: string }>(a, 'actionRejected'); a.emit('startGame'); expect((await error).message).toContain('числа игроков');
    const joined = once(b, 'roomJoined'); b.emit('joinRoom', { name: 'Борис', code: room.code }); await joined;
    error = once(third, 'actionRejected'); third.emit('joinRoom', { name: 'Третий', code: room.code }); expect((await error).message).toContain('свободных мест');
    error = once(a, 'actionRejected'); a.emit('startGame'); expect((await error).message).toContain('готовность');
  });
  it('rejects claiming an occupied connected object through the real socket handler', async () => {
    const { a, first, second } = await setup();
    const room = server.repository.get(first.room.code)!;
    room.game!.board = {
      '0,0': { definitionId: 'straight', rotation: 1, x: 0, y: 0, meeples: [{ playerId: second.session.playerId, featureId: 'r' }] },
      '1,0': { definitionId: 'straight', rotation: 1, x: 1, y: 0, meeples: [] },
    };
    room.game!.phase = 'placingMeeple'; room.game!.lastPlaced = '1,0'; room.game!.currentTile = null; room.game!.players[1].meeples = 6;
    const before = structuredClone(room.game);
    const rejected = once<{ message: string }>(a, 'actionRejected'); a.emit('gameAction', { type: 'placeMeeple', featureId: 'r', playerId: second.session.playerId });
    expect((await rejected).message).toContain('Объект уже занят'); expect(room.game).toEqual(before);
  });
});
