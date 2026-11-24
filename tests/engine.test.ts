import { describe, expect, it } from 'vitest';
import { applyAction, canPlace, componentAt, createGame, eligibleFeatures, key, legalPositions, monasteryValue, publicState, scoreFeatures, sidesOf } from '../shared/engine';
import { DECK_SIZE, TILES } from '../shared/tiles';
import { SIDES, type GameState, type PlacedTile, type Rotation } from '../shared/types';

const players = [{ id: 'a', name: 'Анна' }, { id: 'b', name: 'Борис' }];
const tile = (definitionId: string, x: number, y: number, rotation: Rotation = 0, owner?: string, featureId = 'r'): PlacedTile => ({ definitionId, x, y, rotation, meeples: owner ? [{ playerId: owner, featureId }] : [] });
function fixture(tiles: PlacedTile[]) {
  const state = createGame(players, () => .5);
  state.board = Object.fromEntries(tiles.map(t => [key(t.x, t.y), t]));
  for (const p of state.players) p.meeples = 7 - tiles.flatMap(t => t.meeples).filter(m => m.playerId === p.id).length;
  return state;
}
function seeded(seed: number) { return () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }

describe('tile catalogue and placement', () => {
  it('contains 60 tiles and covers each non-field edge exactly once', () => {
    expect(DECK_SIZE).toBe(60);
    for (const def of TILES) for (const side of SIDES) {
      const covering = def.features.filter(f => f.edges.includes(side));
      expect(covering.length).toBe(def.sides[side] === 'field' ? 0 : 1);
      if (covering.length) expect(covering[0].type).toBe(def.sides[side]);
    }
  });
  it('rotates all four sides clockwise', () => {
    expect(sidesOf({ definitionId: 'city-road', rotation: 1 })).toEqual({ north: 'road', east: 'city', south: 'road', west: 'field' });
    expect(sidesOf({ definitionId: 'city-road', rotation: 0 })).toEqual({ north: 'city', east: 'road', south: 'field', west: 'road' });
  });
  it('requires adjacency, a free cell and matching sides with EVERY neighbor', () => {
    const state = fixture([tile('straight', 0, 0), tile('city-cap', 2, 0, 3)]), current = { definitionId: 'straight', rotation: 0 as const };
    expect(canPlace(state.board, current, 0, 1)).toBe(true);
    expect(canPlace(state.board, current, 1, 0)).toBe(false);
    expect(canPlace(state.board, current, 0, 0)).toBe(false);
    expect(canPlace(state.board, current, 8, 8)).toBe(false);
    expect(canPlace(state.board, current, NaN, 1)).toBe(false);
    expect(canPlace(state.board, current, .5, 1)).toBe(false);
  });
});
describe('feature graph and scoring', () => {
  it('completes a road between two endpoints and returns the meeple', () => {
    const state = fixture([tile('monastery-road', 0, 0, 0, 'a'), tile('monastery-road', 0, 1, 2)]);
    expect(componentAt(state.board, '0,0', 'r').openEdges).toBe(0);
    scoreFeatures(state); expect(state.players[0].score).toBe(2); expect(state.players[0].meeples).toBe(7);
    scoreFeatures(state); expect(state.players[0].score).toBe(2);
  });
  it('counts connected city tiles and shields once and only scores a closed city', () => {
    const tiles = [tile('city-corner-shield', 0, 0, 1, 'a', 'c'), tile('city-corner', 1, 0, 2), tile('city-corner', 1, 1, 3)];
    const state = fixture(tiles); scoreFeatures(state); expect(state.players[0].score).toBe(0);
    state.board['0,1'] = tile('city-corner', 0, 1); scoreFeatures(state);
    expect(state.players[0].score).toBe(10); expect(state.players[0].meeples).toBe(7);
  });
  it('scores unfinished cities at one point per tile and shield', () => {
    const state = fixture([tile('city-corner-shield', 0, 0, 0, 'a', 'c')]);
    scoreFeatures(state, true); expect(state.players[0].score).toBe(2);
  });
  it('keeps separate city segments and junction roads independent', () => {
    const state = fixture([tile('city-split', 0, 0, 0, 'a', 'n')]); state.lastPlaced = '0,0';
    expect(eligibleFeatures(state).map(f => f.id)).toEqual(['s']);
    const junction = fixture([tile('junction', 0, 0, 0, 'a', 'n')]); junction.lastPlaced = '0,0';
    expect(eligibleFeatures(junction).map(f => f.id)).toEqual(['e', 's']);
  });
  it('rejects meeples on an occupied connected feature across rotated tiles', () => {
    const state = fixture([tile('straight', 0, 0, 1, 'b'), tile('straight', 1, 0, 1)]); state.lastPlaced = '1,0';
    state.phase = 'placingMeeple'; expect(eligibleFeatures(state)).toHaveLength(0);
    expect(() => applyAction(state, 'a', { type: 'placeMeeple', featureId: 'r' })).toThrow('Объект уже занят');
  });
  it('awards only the majority and gives every tied leader full points', () => {
    const tiles = [tile('straight', 0, 0, 0, 'a'), tile('straight', 0, 1, 0, 'a'), tile('straight', 0, 2, 0, 'b')];
    const state = fixture(tiles); scoreFeatures(state, true); expect(state.players.map(p => p.score)).toEqual([3, 0]);
    const tied = fixture([tile('straight', 0, 0, 0, 'a'), tile('straight', 0, 1, 0, 'b')]);
    scoreFeatures(tied, true); expect(tied.players.map(p => p.score)).toEqual([2, 2]);
    expect(tied.players.map(p => p.meeples)).toEqual([7, 7]);
  });
  it('counts all eight monastery neighbors, scores at nine and scores partial monasteries at the end', () => {
    const state = fixture([tile('monastery', 0, 0, 0, 'a', 'm')]);
    state.board['1,0'] = tile('meadow', 1, 0); expect(monasteryValue(state.board, state.board['0,0'])).toBe(2);
    const partial = structuredClone(state); scoreFeatures(partial, true); expect(partial.players[0].score).toBe(2);
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) if (x || y) state.board[key(x, y)] = tile('meadow', x, y);
    scoreFeatures(state); expect(state.players[0].score).toBe(9); expect(state.players[0].meeples).toBe(7);
  });
});
describe('turn state machine', () => {
  it('validates actor, action phase and coordinates without mutating the input', () => {
    const state = createGame(players, () => .3), snapshot = structuredClone(state);
    expect(() => applyAction(state, 'b', { type: 'rotateTile' })).toThrow('другого игрока');
    expect(() => applyAction(state, 'a', { type: 'skipMeeple' })).toThrow('Сначала');
    expect(() => applyAction(state, 'a', { type: 'placeTile', x: 999, y: 999 })).toThrow('Стороны');
    const next = applyAction(state, 'a', { type: 'rotateTile' }); expect(next.currentTile!.rotation).toBe(1); expect(state).toEqual(snapshot);
    expect('deck' in publicState(state)).toBe(false);
  });
  it('allows claiming a just-completed feature before scoring and finishes the last turn', () => {
    let state = fixture([tile('city-cap', 0, 0, 2)]); state.deck = []; state.phase = 'placingTile';
    state.currentTile = { definitionId: 'city-cap', rotation: 0 };
    state = applyAction(state, 'a', { type: 'placeTile', x: 0, y: 1 });
    expect(state.phase).toBe('placingMeeple'); expect(state.players[0].score).toBe(0);
    state = applyAction(state, 'a', { type: 'placeMeeple', featureId: 'c' });
    expect(state.phase).toBe('gameOver'); expect(state.players[0].score).toBe(4); expect(state.players[0].meeples).toBe(7);
  });
  it('plays ten complete deterministic games, preserving all 60 tiles and seven meeples per player', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const random = seeded(seed);
      let state: GameState = createGame([...players, ...Array.from({ length: seed % 3 }, (_, i) => ({ id: `c${i}`, name: `Друг ${i}` }))], random);
      let turns = 0;
      while (state.phase !== 'gameOver' && turns++ < DECK_SIZE) {
        const actor = state.players[state.activePlayer].id;
        for (let r = 0; r < 4 && !legalPositions(state.board, state.currentTile!).length; r++) state = applyAction(state, actor, { type: 'rotateTile' });
        const positions = legalPositions(state.board, state.currentTile!); expect(positions.length).toBeGreaterThan(0);
        const p = positions[Math.floor(random() * positions.length)]; state = applyAction(state, actor, { type: 'placeTile', ...p });
        const choices = eligibleFeatures(state);
        state = applyAction(state, actor, choices.length && random() > .2 ? { type: 'placeMeeple', featureId: choices[Math.floor(random() * choices.length)].id } : { type: 'skipMeeple' });
        for (const player of state.players) {
          const onBoard = Object.values(state.board).flatMap(t => t.meeples).filter(m => m.playerId === player.id).length;
          expect(player.meeples + onBoard).toBe(7); expect(player.score).toBeGreaterThanOrEqual(0);
        }
      }
      expect(state.phase).toBe('gameOver'); expect(Object.keys(state.board).length + state.discarded).toBe(DECK_SIZE);
      expect(state.players.every(p => p.meeples === 7)).toBe(true);
    }
  });
});
