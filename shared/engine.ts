import { TILE_BY_ID, TILES } from './tiles';
import { PLAYER_COLORS, SIDES, type CurrentTile, type Feature, type GameAction, type GameState, type GameView, type PlacedTile, type Rotation, type Side } from './types';

export const key = (x: number, y: number) => `${x},${y}`;
const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const opposite = (s: Side): Side => SIDES[(SIDES.indexOf(s) + 2) % 4];
export const rotateSide = (s: Side, rotation: number): Side => SIDES[(SIDES.indexOf(s) + rotation) % 4];
export function sidesOf(tile: CurrentTile) {
  const def = TILE_BY_ID[tile.definitionId];
  return Object.fromEntries(SIDES.map(s => [rotateSide(s, tile.rotation), def.sides[s]])) as typeof def.sides;
}
export const featureEdges = (tile: CurrentTile, feature: Feature) => feature.edges.map(s => rotateSide(s, tile.rotation));
export function canPlace(board: GameState['board'], tile: CurrentTile, x: number, y: number): boolean {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || Math.abs(x) > 1000 || Math.abs(y) > 1000 || board[key(x, y)]) return false;
  let adjacent = false;
  const sides = sidesOf(tile);
  for (let i = 0; i < 4; i++) {
    const neighbor = board[key(x + DELTA[i][0], y + DELTA[i][1])];
    if (!neighbor) continue;
    adjacent = true;
    if (sides[SIDES[i]] !== sidesOf(neighbor)[opposite(SIDES[i])]) return false;
  }
  return adjacent;
}
export function frontier(board: GameState['board']) {
  const cells = new Map<string, { x: number; y: number }>();
  for (const tile of Object.values(board)) for (const [dx, dy] of DELTA) {
    const x = tile.x + dx, y = tile.y + dy;
    if (!board[key(x, y)]) cells.set(key(x, y), { x, y });
  }
  return [...cells.values()];
}
export const legalPositions = (board: GameState['board'], tile: CurrentTile) => frontier(board).filter(p => canPlace(board, tile, p.x, p.y));

export interface Component { nodes: { tile: PlacedTile; feature: Feature }[]; openEdges: number; tileCount: number; shields: number; owners: string[] }
export function componentAt(board: GameState['board'], tileKey: string, featureId: string): Component {
  const nodes: Component['nodes'] = [], visited = new Set<string>();
  const queue = [{ tile: board[tileKey], featureId }];
  let openEdges = 0, shields = 0;
  while (queue.length) {
    const item = queue.pop()!;
    if (!item.tile) continue;
    const feature = TILE_BY_ID[item.tile.definitionId].features.find(f => f.id === item.featureId);
    if (!feature) continue;
    const id = `${key(item.tile.x, item.tile.y)}:${feature.id}`;
    if (visited.has(id)) continue;
    visited.add(id); nodes.push({ tile: item.tile, feature }); shields += feature.shields ?? 0;
    for (const edge of featureEdges(item.tile, feature)) {
      const [dx, dy] = DELTA[SIDES.indexOf(edge)];
      const neighbor = board[key(item.tile.x + dx, item.tile.y + dy)];
      const other = neighbor && TILE_BY_ID[neighbor.definitionId].features.find(f => f.type === feature.type && featureEdges(neighbor, f).includes(opposite(edge)));
      if (neighbor && other) queue.push({ tile: neighbor, featureId: other.id });
      else openEdges++;
    }
  }
  return { nodes, openEdges, shields, tileCount: new Set(nodes.map(n => key(n.tile.x, n.tile.y))).size,
    owners: nodes.flatMap(n => n.tile.meeples.filter(m => m.featureId === n.feature.id).map(m => m.playerId)) };
}
export function monasteryValue(board: GameState['board'], tile: PlacedTile) {
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (board[key(tile.x + dx, tile.y + dy)]) count++;
  return count;
}
export function eligibleFeatures(state: Pick<GameState, 'board' | 'lastPlaced' | 'players' | 'activePlayer'>): Feature[] {
  const tile = state.lastPlaced && state.board[state.lastPlaced];
  if (!tile || state.players[state.activePlayer].meeples === 0) return [];
  return TILE_BY_ID[tile.definitionId].features.filter(f => componentAt(state.board, state.lastPlaced!, f.id).owners.length === 0);
}
function log(state: GameState, text: string) {
  state.log.push({ id: (state.log.at(-1)?.id ?? 0) + 1, text });
  state.log = state.log.slice(-60);
}
function award(state: GameState, component: Component, value: number, label: string) {
  if (!component.owners.length) return;
  const counts = new Map<string, number>();
  for (const id of component.owners) counts.set(id, (counts.get(id) ?? 0) + 1);
  const max = Math.max(...counts.values());
  for (const player of state.players) if (counts.get(player.id) === max) {
    player.score += value; log(state, `${player.name}: +${value} за ${label}`);
  }
  for (const { tile, feature } of component.nodes) {
    for (const meeple of tile.meeples.filter(m => m.featureId === feature.id)) state.players.find(p => p.id === meeple.playerId)!.meeples++;
    tile.meeples = tile.meeples.filter(m => m.featureId !== feature.id);
  }
}
export function scoreFeatures(state: GameState, final = false) {
  const seen = new Set<string>();
  for (const tile of Object.values(state.board)) for (const feature of TILE_BY_ID[tile.definitionId].features) {
    const id = `${key(tile.x, tile.y)}:${feature.id}`;
    if (seen.has(id)) continue;
    const component = componentAt(state.board, key(tile.x, tile.y), feature.id);
    for (const n of component.nodes) seen.add(`${key(n.tile.x, n.tile.y)}:${n.feature.id}`);
    if (feature.type === 'monastery') {
      const value = monasteryValue(state.board, tile);
      if (final || value === 9) award(state, component, value, 'монастырь');
    } else if (final || component.openEdges === 0) {
      const factor = feature.type === 'city' && component.openEdges === 0 ? 2 : 1;
      award(state, component, (component.tileCount + component.shields) * factor, feature.type === 'city' ? 'город' : 'дорогу');
    }
  }
}
function draw(state: GameState) {
  state.phase = 'drawingTile'; state.currentTile = null;
  while (state.deck.length) {
    const definitionId = state.deck.pop()!;
    const fits = [0, 1, 2, 3].some(rotation => legalPositions(state.board, { definitionId, rotation: rotation as Rotation }).length);
    if (fits) { state.currentTile = { definitionId, rotation: 0 }; state.phase = 'placingTile'; return; }
    state.discarded++; log(state, `Тайл «${TILE_BY_ID[definitionId].name}» сброшен: нет подходящих мест`);
  }
  scoreFeatures(state, true); state.phase = 'gameOver'; log(state, 'Партия завершена. Незавершённые объекты подсчитаны.');
}
export function createGame(players: { id: string; name: string }[], random = Math.random): GameState {
  if (players.length < 2 || players.length > 4) throw new Error('Нужно от 2 до 4 игроков');
  const deck = TILES.flatMap(t => Array<string>(t.copies).fill(t.id));
  deck.splice(deck.indexOf('city-road'), 1);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const state: GameState = { version: 1, board: { '0,0': { definitionId: 'city-road', rotation: 0, x: 0, y: 0, meeples: [] } }, deck,
    currentTile: null, players: players.map((p, i) => ({ id: p.id, name: p.name, color: PLAYER_COLORS[i], score: 0, meeples: 7 })),
    activePlayer: 0, phase: 'drawingTile', turn: 1, lastPlaced: null, log: [], discarded: 0 };
  log(state, 'Земли ждут своих строителей. Партия началась!'); draw(state); return state;
}
export function applyAction(original: GameState, actorId: string, action: GameAction): GameState {
  if (original.phase === 'gameOver') throw new Error('Партия уже завершена');
  if (original.players[original.activePlayer].id !== actorId) throw new Error('Сейчас ход другого игрока');
  const state = structuredClone(original), player = state.players[state.activePlayer];
  if (action.type === 'rotateTile') {
    if (state.phase !== 'placingTile' || !state.currentTile) throw new Error('Сейчас нельзя вращать тайл');
    state.currentTile.rotation = (state.currentTile.rotation + 1) % 4 as Rotation; return state;
  }
  if (action.type === 'placeTile') {
    if (state.phase !== 'placingTile' || !state.currentTile) throw new Error('Сначала завершите текущий ход');
    if (!canPlace(state.board, state.currentTile, action.x, action.y)) throw new Error('Стороны тайла должны совпадать со всеми соседями');
    const k = key(action.x, action.y);
    state.board[k] = { ...state.currentTile, x: action.x, y: action.y, meeples: [] };
    state.lastPlaced = k; state.currentTile = null; state.phase = 'placingMeeple';
    log(state, `${player.name} разместил(а) тайл «${TILE_BY_ID[state.board[k].definitionId].name}»`); return state;
  }
  if (action.type !== 'placeMeeple' && action.type !== 'skipMeeple') throw new Error('Неизвестное действие');
  if (state.phase !== 'placingMeeple' || !state.lastPlaced) throw new Error('Сначала разместите тайл');
  if (action.type === 'placeMeeple') {
    const feature = eligibleFeatures(state).find(f => f.id === action.featureId);
    if (!feature) throw new Error('Объект уже занят или нет свободных фишек');
    state.board[state.lastPlaced].meeples.push({ playerId: player.id, featureId: feature.id }); player.meeples--;
    log(state, `${player.name} поставил(а) фишку`);
  }
  state.phase = 'scoring'; scoreFeatures(state); state.turn++; state.activePlayer = (state.activePlayer + 1) % state.players.length;
  state.lastPlaced = null; draw(state); return state;
}
export function publicState(state: GameState, canUndo = false): GameView {
  const { deck, ...view } = state;
  return structuredClone({ ...view, remainingTiles: deck.length, canUndo });
}
