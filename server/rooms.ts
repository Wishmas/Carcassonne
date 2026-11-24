import type { GameState, RoomPlayer, RoomView } from '../shared/types';

export interface Room {
  code: string;
  hostId: string;
  capacity: number;
  allowPartial: boolean;
  players: RoomPlayer[];
  game: GameState | null;
  undo: GameState | null;
  updatedAt: number;
}
// Replace this interface with a persistent implementation when adding a database.
export interface RoomRepository {
  get(code: string): Room | undefined;
  save(room: Room): void;
  all(): Iterable<Room>;
  delete(code: string): void;
}
export class MemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, Room>();
  get(code: string) { return this.rooms.get(code); }
  save(room: Room) { this.rooms.set(room.code, room); }
  all() { return this.rooms.values(); }
  delete(code: string) { this.rooms.delete(code); }
}
export function roomView(room: Room): RoomView {
  return { code: room.code, hostId: room.hostId, capacity: room.capacity, allowPartial: room.allowPartial,
    players: structuredClone(room.players), started: Boolean(room.game) };
}
