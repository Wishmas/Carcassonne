import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { canPlace, eligibleFeatures, frontier, key } from '../shared/engine';
import type { GameAction, GameView } from '../shared/types';
import { Tile } from './Tile';
import styles from './App.module.css';

const SIZE = 100;
export default function Board({ game, canAct, act, debug }: { game: GameView; canAct: boolean; act: (a: GameAction) => void; debug: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; cameraX: number; cameraY: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const cells = useMemo(() => frontier(game.board), [game.board]);
  const choices = game.phase === 'placingMeeple' && canAct ? eligibleFeatures(game) : [];
  useEffect(() => { if (game.turn === 1 && Object.keys(game.board).length === 1) { setCamera({ x: 0, y: 0, zoom: 1 }); setHover(null); } }, [game.turn]);
  const fit = () => {
    const tiles = Object.values(game.board), el = surface.current;
    if (!el) return;
    const xs = tiles.map(t => t.x), ys = tiles.map(t => t.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const zoom = Math.max(.25, Math.min(1.15, (el.clientWidth - 140) / ((maxX - minX + 2) * SIZE), (el.clientHeight - 140) / ((maxY - minY + 2) * SIZE)));
    setCamera({ x: -(minX + maxX) * SIZE / 2 * zoom, y: -(minY + maxY) * SIZE / 2 * zoom, zoom });
  };
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect(), px = e.clientX - rect.left - rect.width / 2, py = e.clientY - rect.top - rect.height / 2;
      setCamera(c => {
        const zoom = Math.max(.25, Math.min(2, c.zoom * Math.exp(-e.deltaY * .0015))), ratio = zoom / c.zoom;
        return { zoom, x: px - (px - c.x) * ratio, y: py - (py - c.y) * ratio };
      });
    };
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
  }, []);
  function down(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest(`.${styles.featureChoice}`)) return;
    drag.current = { x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y, moved: false };
    surface.current?.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag.current) return;
    const d = drag.current, dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 5) { d.moved = true; setDragging(true); setCamera(c => ({ ...c, x: d.cameraX + dx, y: d.cameraY + dy })); }
  }
  function up(e: PointerEvent) {
    const d = drag.current;
    if (d && !d.moved && canAct && game.phase === 'placingTile' && game.currentTile) {
      const rect = surface.current!.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left - rect.width / 2 - camera.x) / camera.zoom / SIZE + .5);
      const y = Math.floor((e.clientY - rect.top - rect.height / 2 - camera.y) / camera.zoom / SIZE + .5);
      if (cells.some(p => p.x === x && p.y === y)) act({ type: 'placeTile', x, y });
    }
    drag.current = null; setDragging(false);
    if (surface.current?.hasPointerCapture(e.pointerId)) surface.current.releasePointerCapture(e.pointerId);
  }
  return <section className={styles.boardPanel} aria-label="Игровое поле">
    <div className={styles.boardHeading}><span className={styles.eyebrow}>ВАШ МАЛЕНЬКИЙ МИР</span><span>{Object.keys(game.board).length} тайлов на столе</span></div>
    <div ref={surface} className={`${styles.board} ${dragging ? styles.dragging : ''} ${debug ? styles.debugBoard : ''}`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
      <div className={styles.boardWorld} style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}>
        {game.phase === 'placingTile' && game.currentTile && cells.map(cell => {
          const k = key(cell.x, cell.y), valid = canPlace(game.board, game.currentTile!, cell.x, cell.y);
          return <button key={k} className={`${styles.cell} ${valid ? styles.valid : styles.invalid}`} style={{ left: cell.x * SIZE - SIZE / 2, top: cell.y * SIZE - SIZE / 2 }}
            aria-label={`Разместить тайл: ${cell.x}, ${cell.y}${valid ? '' : ', недопустимо'}`} disabled={!canAct}
            onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)}
            onClick={e => { if (e.detail === 0 && canAct) act({ type: 'placeTile', ...cell }); }}>
            {hover === k && valid ? <div className={styles.ghost}><Tile tile={game.currentTile!} /></div> : <span>{valid ? '+' : '×'}</span>}
          </button>;
        })}
        {Object.values(game.board).map(tile => <div key={key(tile.x, tile.y)} className={`${styles.placedTile} ${game.lastPlaced === key(tile.x, tile.y) ? styles.lastTile : ''}`} style={{ left: tile.x * SIZE - SIZE / 2, top: tile.y * SIZE - SIZE / 2 }}>
          <Tile tile={tile} players={game.players} debug={debug} choices={game.lastPlaced === key(tile.x, tile.y) ? choices : []} onFeature={featureId => act({ type: 'placeMeeple', featureId })} />
        </div>)}
      </div>
      {Object.keys(game.board).length === 1 && <div className={styles.boardWelcome}>Здесь начинается история<span>Присоедините тайл к одной из сторон</span></div>}
    </div>
    <div className={styles.boardBottom}><span>Перетащите поле · Колесо для масштаба</span><div className={styles.cameraControls}>
      <button aria-label="Уменьшить" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.25, c.zoom - .15) }))}>−</button><span>{Math.round(camera.zoom * 100)}%</span>
      <button aria-label="Увеличить" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(2, c.zoom + .15) }))}>+</button><button onClick={fit} title="Показать всё поле">Всё поле</button>
    </div></div>
  </section>;
}
