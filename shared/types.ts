export const SIDES = ['north', 'east', 'south', 'west'] as const;
export type Side = typeof SIDES[number];
export type Terrain = 'field' | 'road' | 'city';
export type FeatureType = 'road' | 'city' | 'monastery';
export type Rotation = 0 | 1 | 2 | 3;
export interface Feature { id: string; type: FeatureType; edges: Side[]; shields?: number; anchor: [number, number] }
export interface TileDefinition { id: string; name: string; sides: Record<Side, Terrain>; features: Feature[]; copies: number }
export interface CurrentTile { definitionId: string; rotation: Rotation }
export interface Meeple { playerId: string; featureId: string }
export interface PlacedTile extends CurrentTile { x: number; y: number; meeples: Meeple[] }
export interface Player { id: string; name: string; color: string; score: number; meeples: number }
export type TurnPhase = 'drawingTile' | 'placingTile' | 'placingMeeple' | 'scoring' | 'gameOver';
export interface LogEntry { id: number; text: string }
export interface GameState {
  version: 1;
  board: Record<string, PlacedTile>;
  deck: string[];
  currentTile: CurrentTile | null;
  players: Player[];
  activePlayer: number;
  phase: TurnPhase;
  turn: number;
  lastPlaced: string | null;
  log: LogEntry[];
  discarded: number;
}
export type GameView = Omit<GameState, 'deck'> & { remainingTiles: number; canUndo: boolean };
export type GameAction =
  | { type: 'rotateTile' }
  | { type: 'placeTile'; x: number; y: number }
  | { type: 'placeMeeple'; featureId: string }
  | { type: 'skipMeeple' }
  | { type: 'undo' };
export interface RoomPlayer { id: string; name: string; connected: boolean; ready: boolean }
export interface RoomView { code: string; hostId: string; capacity: number; allowPartial: boolean; players: RoomPlayer[]; started: boolean }
export interface Session { code: string; token: string; playerId: string }
export const PLAYER_COLORS = ['#c34e42', '#467da8', '#4c8967', '#c29430'];
