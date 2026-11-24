import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { applyAction, createGame, publicState } from '../shared/engine';
import type { GameAction, GameState, GameView, RoomView, Session } from '../shared/types';

const LOCAL_KEY = 'lands-game-v1', SESSION_KEY = 'lands-session-v1';
function read<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing / full storage: game still works in memory. */ } }
interface Local { game: GameState | null; undo: GameState | null }
type LocalAction = { type: 'replace'; game: GameState } | { type: 'clear' } | { type: 'action'; action: GameAction };
function localReducer(state: Local, event: LocalAction): Local {
  if (event.type === 'replace') return { game: event.game, undo: null };
  if (event.type === 'clear') return { game: null, undo: null };
  if (!state.game) return state;
  if (event.action.type === 'undo') return state.undo && state.game.phase === 'placingMeeple' ? { game: state.undo, undo: null } : state;
  const next = applyAction(state.game, state.game.players[state.game.activePlayer].id, event.action);
  return { game: next, undo: event.action.type === 'placeTile' ? state.game : event.action.type === 'rotateTile' ? state.undo : null };
}
function restoreLocal(): Local {
  const value = read<Local>(LOCAL_KEY);
  // Ignore incompatible/corrupt snapshots instead of breaking the start screen.
  if (!value?.game || value.game.version !== 1) return { game: null, undo: null };
  try { publicState(value.game); if (!value.game.players?.length || !value.game.board || !Array.isArray(value.game.deck)) throw Error(); return value; }
  catch { return { game: null, undo: null }; }
}
export function useGame() {
  const [local, dispatch] = useReducer(localReducer, undefined, restoreLocal);
  const [session, setSession] = useState<Session | null>(() => read<Session>(SESSION_KEY));
  const sessionRef = useRef(session); sessionRef.current = session;
  const [room, setRoom] = useState<RoomView | null>(null);
  const [onlineGame, setOnlineGame] = useState<GameView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  useEffect(() => { save(LOCAL_KEY, local); }, [local]);
  useEffect(() => {
    const socket = io({ autoConnect: false, auth: cb => cb({ token: sessionRef.current?.token }), reconnection: true }); socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setError(''); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    const joined = (data: { session: Session; room: RoomView }) => {
      sessionRef.current = data.session; setSession(data.session); save(SESSION_KEY, data.session); setRoom(data.room);
    };
    socket.on('roomCreated', joined); socket.on('roomJoined', joined);
    socket.on('roomUpdated', setRoom); socket.on('gameState', setOnlineGame);
    socket.on('actionRejected', (data: { message: string }) => setError(data.message));
    socket.on('sessionExpired', (data: { message: string }) => {
      sessionRef.current = null; setSession(null); save(SESSION_KEY, null); setRoom(null); setOnlineGame(null); setError(data.message);
    });
    socket.connect(); return () => { socket.disconnect(); socketRef.current = null; };
  }, []);
  const game = session ? onlineGame : local.game ? publicState(local.game, Boolean(local.undo)) : null;
  const canAct = Boolean(game && (!session || (connected && game.players[game.activePlayer].id === session.playerId)));
  const act = useCallback((action: GameAction) => {
    setError('');
    if (sessionRef.current) {
      if (!socketRef.current?.connected) { setError('Нет соединения. Дождитесь переподключения.'); return; }
      socketRef.current.emit('gameAction', action);
    } else if (local.game) {
      try {
        if (action.type !== 'undo') applyAction(local.game, local.game.players[local.game.activePlayer].id, action);
        dispatch({ type: 'action', action });
      } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка хода'); }
    }
  }, [local.game]);
  const send = (event: string, data?: unknown) => {
    setError('');
    if (!socketRef.current?.connected) { setError('Сервер недоступен. Проверьте, что запущен npm run dev.'); return; }
    socketRef.current.emit(event, data);
  };
  function leave() {
    socketRef.current?.disconnect(); sessionRef.current = null; setSession(null); save(SESSION_KEY, null);
    setRoom(null); setOnlineGame(null); setError(''); socketRef.current?.connect();
  }
  return { game, room, session, connected, error, setError, canAct, act, send, leave,
    saved: Boolean(local.game), resume: () => { if (session) leave(); },
    startLocal: (names: string[]) => { if (session) leave(); dispatch({ type: 'replace', game: createGame(names.map((name, i) => ({ id: `local-${i}`, name: name.trim() || `Игрок ${i + 1}` }))) }); },
    clearLocal: () => dispatch({ type: 'clear' }) };
}
export type GameController = ReturnType<typeof useGame>;
