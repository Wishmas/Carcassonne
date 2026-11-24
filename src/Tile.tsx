import { useEffect, useState } from 'react';
import { TILE_BY_ID } from '../shared/tiles';
import { SIDES, type CurrentTile, type Feature, type PlacedTile, type Player } from '../shared/types';
import styles from './App.module.css';

const ends = { north: [50, -3], east: [103, 50], south: [50, 103], west: [-3, 50] };
export function Meeple({ color = 'currentColor', size = 24 }: { color?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 28 30" aria-hidden="true"><path d="M10 9a5 5 0 1 1 8 0l7 5-3 5-5-3 5 12h-7l-1-7-1 7H6l5-12-5 3-3-5z" fill={color} stroke="#fff9e9" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function position(feature: Feature, rotation: number) {
  let [x, y] = feature.anchor;
  for (let r = 0; r < rotation; r++) [x, y] = [100 - y, x];
  return { left: `${x}%`, top: `${y}%` };
}
export function Tile({ tile, players = [], debug = false, choices = [], onFeature }: {
  tile: CurrentTile | PlacedTile; players?: Player[]; debug?: boolean; choices?: Feature[]; onFeature?: (id: string) => void;
}) {
  const def = TILE_BY_ID[tile.definitionId];
  const [angle, setAngle] = useState(tile.rotation * 90);
  useEffect(() => { setAngle(previous => previous + (tile.rotation * 90 - previous % 360 + 360) % 360); }, [tile.rotation]);
  const placed = 'meeples' in tile ? tile : null;
  return <div className={styles.tile}>
    <svg viewBox="0 0 100 100" className={styles.landscape} role="img" aria-label={def.name}>
      <rect width="100" height="100" rx="5" fill="#91ad72" />
      <path d="M4 7Q29 19 48 7T97 16M3 82Q30 65 46 84T97 76" fill="none" stroke="#a3bc83" strokeWidth="14" opacity=".55" />
      <g fill="#648755" opacity=".65"><path d="m12 33 3-7 3 7h-2v4h-2v-4zm68 39 3-7 3 7h-2v4h-2v-4zM17 88l3-7 3 7h-2v3h-2v-3z" /></g>
      <g transform={`rotate(${angle} 50 50)`} className={styles.tileRotation}>
        {def.features.filter(f => f.type === 'road').map(f => {
          const e = f.edges.map(edge => ends[edge]);
          const center = tile.definitionId === 'city-road' ? [50, 63] : tile.definitionId === 'city-end' ? [50, 30] : tile.definitionId === 'monastery-road' ? [50, 50] : [50, 50];
          const d = e.length === 2 ? `M${e[0]} Q${center} ${e[1]}` : `M${e[0]} L${center}`;
          return <g key={f.id}><path d={d} fill="none" stroke="#8e8059" strokeWidth="15" /><path d={d} fill="none" stroke="#efdaad" strokeWidth="11" /><path d={d} fill="none" stroke="#ffedc5" strokeWidth="1.5" strokeDasharray="3 5" /></g>;
        })}
        {def.features.filter(f => f.type === 'city').map(f => <g key={f.id}>
          {f.edges.length > 1 && <g><path d={f.edges.map(edge => `M${ends[edge]} L${f.anchor}`).join(' ')} stroke="#897562" strokeWidth="52" fill="none" strokeLinejoin="round" /><path d={f.edges.map(edge => `M${ends[edge]} L${f.anchor}`).join(' ')} stroke="#c9b69a" strokeWidth="47" fill="none" strokeLinejoin="round" /></g>}
          {f.edges.map(edge => <g key={edge} transform={`rotate(${SIDES.indexOf(edge) * 90} 50 50)`}>
            <path d="M-2-2H102V19L81 27 61 23 42 28 21 23-2 28Z" fill="#ccb99c" stroke="#8d7965" strokeWidth="2" />
            <path d="M12 0v20m21-20v22M57 0v19M80 0v20M0 11h100" stroke="#b09b7e" strokeWidth="1" />
            <path d="M17 7h14v10H17zm38-2h16v13H55z" fill="#a86d54" stroke="#80543f" strokeWidth="1" />
            <path d="m15 7 9-5 9 5m20-2 10-5 10 5" fill="none" stroke="#e0b18b" strokeWidth="2" />
          </g>)}
          {Boolean(f.shields) && <g transform={`translate(${f.anchor[0] - 6} ${f.anchor[1] - 7})`}><path d="M0 0h12v8l-6 5-6-5z" fill="#e5c779" stroke="#866b3d" strokeWidth="1.3" /><path d="M6 2v8M2 5h8" stroke="#997742" /></g>}
        </g>)}
        {def.features.some(f => f.type === 'monastery') && <g transform="translate(28 24)">
          <rect x="0" y="11" width="44" height="34" rx="3" fill="#d6c9aa" stroke="#88765a" strokeWidth="2" />
          <path d="m-4 12 26-14 26 14z" fill="#aa7055" stroke="#80583e" strokeWidth="2" /><path d="M16 45V29a6 6 0 0 1 12 0v16" fill="#766f52" />
          <rect x="16" y="-8" width="12" height="23" fill="#d6c9aa" stroke="#88765a" strokeWidth="2" /><path d="m13-8 9-9 9 9z" fill="#aa7055" /><path d="M22-24v9m-4-6h8" stroke="#655842" strokeWidth="2" /><path d="M20 0h4v6h-4z" fill="#766f52" />
        </g>}
        {def.features.filter(f => f.type === 'road').length >= 3 && <g><circle cx="50" cy="50" r="11" fill="#d3b98e" stroke="#998365" strokeWidth="2" /><path d="M44 44h12v12H44z" fill="#9e6f54" /><path d="m41 44 9-7 9 7z" fill="#725a42" /></g>}
        {debug && def.features.map(f => <g key={f.id}><circle cx={f.anchor[0]} cy={f.anchor[1]} r="3" fill="#6d36a0" />{f.edges.map(e => <path key={e} d={`M${f.anchor} L${ends[e]}`} stroke="#6d36a0" strokeWidth="1" strokeDasharray="3 2" />)}</g>)}
      </g>
      <rect x="1" y="1" width="98" height="98" rx="5" fill="none" stroke="#fff7d9" strokeOpacity=".45" strokeWidth="2" />
    </svg>
    {placed?.meeples.map(m => {
      const f = def.features.find(f => f.id === m.featureId)!;
      return <span key={m.featureId} className={styles.onTileMeeple} style={position(f, tile.rotation)}><Meeple color={players.find(p => p.id === m.playerId)?.color} size={26} /></span>;
    })}
    {choices.map(f => <button key={f.id} className={styles.featureChoice} style={position(f, tile.rotation)} onClick={e => { e.stopPropagation(); onFeature?.(f.id); }} title={`Поставить фишку: ${f.type === 'road' ? 'дорога' : f.type === 'city' ? 'город' : 'монастырь'}`} aria-label={`Поставить фишку: ${f.id}`}><span>+</span></button>)}
    {debug && <span className={styles.tileId}>{def.id}{placed ? ` ${placed.x},${placed.y}` : ''}</span>}
  </div>;
}
