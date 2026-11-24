import { SIDES, type Feature, type Side, type Terrain, type TileDefinition } from './types';

const road = (id: string, edges: Side[], anchor: [number, number] = [50, 50]): Feature => ({ id, type: 'road', edges, anchor });
const city = (id: string, edges: Side[], anchor: [number, number], shields = 0): Feature => ({ id, type: 'city', edges, anchor, shields });
function tile(id: string, name: string, sides: Terrain[], copies: number, features: Feature[]): TileDefinition {
  return { id, name, sides: Object.fromEntries(SIDES.map((s, i) => [s, sides[i]])) as Record<Side, Terrain>, copies, features };
}

// Junctions terminate individual roads. Separate city caps are separate features.
export const TILES: TileDefinition[] = [
  tile('straight', 'Тракт', ['road', 'field', 'road', 'field'], 8, [road('r', ['north', 'south'])]),
  tile('bend', 'Поворот', ['road', 'road', 'field', 'field'], 8, [road('r', ['north', 'east'], [60, 40])]),
  tile('junction', 'Перекрёсток', ['road', 'road', 'road', 'field'], 4, [road('n', ['north'], [50, 22]), road('e', ['east'], [78, 50]), road('s', ['south'], [50, 78])]),
  tile('cross', 'Развилка', ['road', 'road', 'road', 'road'], 1, SIDES.map((s, i) => road(s, [s], [[50, 22], [78, 50], [50, 78], [22, 50]][i] as [number, number]))),
  tile('city-cap', 'Городские ворота', ['city', 'field', 'field', 'field'], 6, [city('c', ['north'], [50, 15])]),
  tile('city-road', 'Путь к городу', ['city', 'road', 'field', 'road'], 5, [city('c', ['north'], [50, 15]), road('r', ['east', 'west'], [50, 63])]),
  tile('city-end', 'Городской тракт', ['city', 'field', 'road', 'field'], 3, [city('c', ['north'], [50, 15]), road('r', ['south'], [50, 72])]),
  tile('city-corner', 'Городской квартал', ['city', 'city', 'field', 'field'], 4, [city('c', ['north', 'east'], [66, 29])]),
  tile('city-corner-shield', 'Башня с гербом', ['city', 'city', 'field', 'field'], 2, [city('c', ['north', 'east'], [66, 29], 1)]),
  tile('city-bridge', 'Большой город', ['city', 'field', 'city', 'field'], 3, [city('c', ['north', 'south'], [50, 50])]),
  tile('city-split', 'Два поселения', ['city', 'field', 'city', 'field'], 3, [city('n', ['north'], [50, 15]), city('s', ['south'], [50, 85])]),
  tile('city-three', 'Цитадель', ['city', 'city', 'city', 'field'], 3, [city('c', ['north', 'east', 'south'], [63, 50], 1)]),
  tile('city-full', 'Крепость', ['city', 'city', 'city', 'city'], 1, [city('c', [...SIDES], [50, 50], 1)]),
  tile('monastery', 'Монастырь', ['field', 'field', 'field', 'field'], 5, [{ id: 'm', type: 'monastery', edges: [], anchor: [50, 50] }]),
  tile('monastery-road', 'Дорога к монастырю', ['field', 'field', 'road', 'field'], 2, [{ id: 'm', type: 'monastery', edges: [], anchor: [50, 42] }, road('r', ['south'], [50, 82])]),
  tile('meadow', 'Зелёный луг', ['field', 'field', 'field', 'field'], 2, []),
];
export const TILE_BY_ID = Object.fromEntries(TILES.map(t => [t.id, t]));
export const DECK_SIZE = TILES.reduce((n, t) => n + t.copies, 0);
