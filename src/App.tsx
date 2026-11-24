import { useEffect, useState } from 'react';
import { DECK_SIZE, TILE_BY_ID } from '../shared/tiles';
import { eligibleFeatures } from '../shared/engine';
import { PLAYER_COLORS, type CurrentTile } from '../shared/types';
import { useGame, type GameController } from './useGame';
import { Meeple, Tile } from './Tile';
import Board from './Board';
import styles from './App.module.css';

function Brand() { return <div className={styles.brand}><span className={styles.brandMark}><i /><i /><i /><i /></span><div>Земли и замки<small>ИСТОРИЯ СКЛАДЫВАЕТСЯ ВМЕСТЕ</small></div></div>; }
function Rules({ close }: { close: () => void }) {
  return <div className={styles.backdrop} onClick={close}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={e => e.stopPropagation()}><button className={styles.close} onClick={close} aria-label="Закрыть правила" autoFocus>×</button><span className={styles.eyebrow}>ПАРА МИНУТ — И ВЫ В ИГРЕ</span><h2 id="rules-title">Как строить свой мир</h2><ol className={styles.rules}>
    <li><b>Поверните и разместите тайл.</b> Дорога стыкуется с дорогой, город с городом, луг с лугом. Все соседние стороны должны совпасть. Клавиша R поворачивает тайл.</li>
    <li><b>Выберите объект для фишки.</b> Нажмите «+» на новом тайле. На всей связанной дороге или городе не должно быть чужих или своих фишек. Можно пропустить.</li>
    <li><b>Завершайте объекты.</b> Дорога: 1 очко за тайл. Город: 2 за тайл и 2 за щит. Монастырь с восемью соседями: 9 очков. Фишки возвращаются в запас.</li>
    <li><b>Больше фишек — больше влияния.</b> Раздельные объекты могут объединиться. Все лидеры по числу фишек получают полную стоимость объекта.</li>
    <li><b>Последний тайл завершает партию.</b> Незаконченные дороги дают 1 очко за тайл, города — 1 за тайл и щит, монастыри — 1 за себя и каждого соседа.</li>
  </ol><p className={styles.muted}>На перекрёстках дороги заканчиваются. Поля не приносят очков. Неподходящий ни в одном повороте тайл автоматически сбрасывается. Отмена доступна до постановки фишки или передачи хода. В онлайне ход отключённого игрока ждёт его возвращения.</p><button className={styles.primary} onClick={close}>Всё понятно</button></section></div>;
}
function StartScreen({ controller: c, onPlay, showRules }: { controller: GameController; onPlay: () => void; showRules: () => void }) {
  const invitation = new URLSearchParams(location.search).get('room') || '';
  const [mode, setMode] = useState<'local' | 'online'>(invitation ? 'online' : 'local');
  const [capacity, setCapacity] = useState(2), [names, setNames] = useState(['Анна', 'Илья', 'Мария', 'Алексей']);
  const [name, setName] = useState(''), [code, setCode] = useState(invitation.toUpperCase()), [allowPartial, setAllowPartial] = useState(false);
  const demo: { tile: CurrentTile; x: number; y: number }[] = [
    { tile: { definitionId: 'city-corner-shield', rotation: 0 }, x: 0, y: 0 },
    { tile: { definitionId: 'city-road', rotation: 0 }, x: 1, y: 1 },
    { tile: { definitionId: 'bend', rotation: 2 }, x: 2, y: 1 },
    { tile: { definitionId: 'monastery', rotation: 0 }, x: 0, y: 1 },
    { tile: { definitionId: 'straight', rotation: 0 }, x: 2, y: 2 },
    { tile: { definitionId: 'city-cap', rotation: 2 }, x: 1, y: 0 },
  ];
  return <main className={styles.startPage}><header className={styles.header}><Brand /><button className={styles.textButton} onClick={showRules}>Как играть</button></header>
    <div className={styles.startLayout}><section className={styles.intro}><span className={styles.pill}>НАСТОЛЬНЫЙ ВЕЧЕР, ГДЕ БЫ ВЫ НИ БЫЛИ</span><h1>Большая история.<br /><em>По одному тайлу.</em></h1><p>Дороги ведут к новым городам, а маленькие решения — к большим победам. Соберите друзей и постройте свой мир.</p>
      <div className={styles.demoBoard} aria-hidden="true">{demo.map((d, i) => <div key={i} style={{ left: d.x * 106, top: d.y * 106 }}><Tile tile={d.tile} />{i === 3 && <span className={styles.demoMeeple}><Meeple color={PLAYER_COLORS[0]} size={38} /></span>}</div>)}<span className={styles.demoNote}>Каждый тайл — часть вашей истории</span></div>
      <div className={styles.gameFacts}><span><b>2–4</b> игрока</span><span><b>{DECK_SIZE}</b> тайлов</span><span><b>20–40</b> минут</span><span>За одним столом или онлайн</span></div>
    </section>
    <section className={styles.setupCard}><span className={styles.eyebrow}>МЕСТО ЗА СТОЛОМ НАЙДЁТСЯ КАЖДОМУ</span><h2>Соберём партию</h2><div className={styles.tabs}><button className={mode === 'local' ? styles.selectedTab : ''} onClick={() => setMode('local')}>За одним столом</button><button className={mode === 'online' ? styles.selectedTab : ''} onClick={() => setMode('online')}>Онлайн с друзьями</button></div>
      <label className={styles.label}>Количество игроков</label><div className={styles.countButtons}>{[2, 3, 4].map(n => <button key={n} className={capacity === n ? styles.chosen : ''} onClick={() => setCapacity(n)}>{n} игрока</button>)}</div>
      {mode === 'local' ? <form onSubmit={e => { e.preventDefault(); c.startLocal(names.slice(0, capacity)); onPlay(); }}><div className={styles.nameFields}>{names.slice(0, capacity).map((value, i) => <label key={i}><span style={{ color: PLAYER_COLORS[i] }}><Meeple size={23} color={PLAYER_COLORS[i]} /> Игрок {i + 1}</span><input aria-label={`Имя игрока ${i + 1}`} maxLength={24} value={value} onChange={e => setNames(prev => prev.map((s, j) => j === i ? e.target.value : s))} placeholder={`Игрок ${i + 1}`} /></label>)}</div><button className={styles.primary} type="submit">Начать приключение</button><p className={styles.formHint}>Один экран. Общий стол. Ходите по очереди.</p></form>
        : <div className={styles.onlineForm}><label className={styles.label} htmlFor="online-name">Ваше имя</label><input id="online-name" value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Как вас называть?" /><label className={styles.checkbox}><input type="checkbox" checked={allowPartial} onChange={e => setAllowPartial(e.target.checked)} />Разрешить старт неполным составом</label><button className={styles.primary} onClick={() => c.send('createRoom', { name, capacity, allowPartial })} disabled={!name.trim() || !c.connected}>Создать комнату</button><div className={styles.divider}>или присоединитесь по приглашению</div><div className={styles.joinRow}><input aria-label="Код комнаты" placeholder="Код комнаты" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /><button className={styles.secondary} disabled={!name.trim() || code.length !== 6 || !c.connected} onClick={() => c.send('joinRoom', { name, code })}>Войти</button></div><p className={styles.formHint}>{c.connected ? 'Сервер на связи · Приглашайте друзей по ссылке' : 'Подключаемся к игровому серверу…'}</p></div>}
      {c.saved && !c.session && <button className={styles.resumeButton} onClick={onPlay}>Продолжить сохранённую партию</button>}
    </section></div><footer className={styles.startFooter}>ЗЕМЛИ И ЗАМКИ <span>Самостоятельная игра по мотивам классической механики · Учебный MVP</span><span>Без регистрации. Вместе интереснее.</span></footer>
  </main>;
}
function Lobby({ controller: c }: { controller: GameController }) {
  const room = c.room!, me = room.players.find(p => p.id === c.session?.playerId), host = room.hostId === me?.id;
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  return <main className={styles.lobbyPage}><header className={styles.header}><Brand /><button className={styles.textButton} onClick={c.leave}>Выйти из комнаты</button></header><section className={`${styles.setupCard} ${styles.lobbyCard}`}><span className={styles.eyebrow}>ПОЧТИ ВСЕ В СБОРЕ</span><h1>Ваш стол готов</h1><p className={styles.muted}>Поделитесь кодом или ссылкой с друзьями.</p><div className={styles.roomCode}>{room.code}</div><button className={styles.secondary} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { c.setError('Не удалось скопировать. Выделите ссылку ниже.'); } }}>{copied ? 'Ссылка скопирована' : 'Скопировать приглашение'}</button><input className={styles.inviteInput} aria-label="Ссылка-приглашение" value={link} readOnly onFocus={e => e.target.select()} />
    <div className={styles.lobbyPlayers}>{Array.from({ length: room.capacity }, (_, i) => {
      const p = room.players[i]; return <div key={i}><Meeple color={p ? PLAYER_COLORS[i] : '#b9b8a8'} /><b>{p?.name || 'Ждём друга…'}{p?.id === room.hostId && <small>Создатель</small>}</b><span>{p ? !p.connected ? 'Нет связи' : p.ready ? 'Готов' : 'За столом' : 'Свободно'}</span></div>;
    })}</div><button className={me?.ready ? styles.secondary : styles.primary} disabled={!c.connected} onClick={() => c.send('setReady', !me?.ready)}>{me?.ready ? 'Я готов(а) · Отменить готовность' : 'Я готов(а) играть'}</button>{host && <button className={styles.primary} disabled={!c.connected || room.players.length < 2 || (!room.allowPartial && room.players.length < room.capacity) || room.players.some(p => !p.ready || !p.connected)} onClick={() => c.send('startGame')}>Начать партию</button>}<p className={styles.formHint}>{!c.connected ? 'Нет соединения, пытаемся переподключиться…' : room.allowPartial ? 'Можно начать от двух игроков, когда все готовы.' : `Для старта нужны ${room.capacity} готовых игрока.`}</p></section></main>;
}
export default function App() {
  const c = useGame();
  const [home, setHome] = useState(() => Boolean(new URLSearchParams(location.search).get('room'))), [rules, setRules] = useState(false), [debug, setDebug] = useState(false), [hideResults, setHideResults] = useState(false);
  const game = c.game;
  useEffect(() => { if (c.session) setHome(false); }, [c.session?.playerId]);
  useEffect(() => { setHideResults(false); }, [game?.phase === 'gameOver']);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setRules(false); return; }
      if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]') || rules || home) return;
      if (e.code === 'KeyR' && c.canAct && game?.phase === 'placingTile') { e.preventDefault(); c.act({ type: 'rotateTile' }); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [c.canAct, c.act, game?.phase, rules, home]);
  const toast = c.error && <div className={styles.toast} role="alert"><span>{c.error}</span><button onClick={() => c.setError('')} aria-label="Закрыть уведомление">×</button></div>;
  if (c.session && !c.room) return <><main className={styles.reconnect}><Brand /><h2>Возвращаем вас за стол…</h2><p>Нет соединения, пытаемся переподключиться.</p><button className={styles.secondary} onClick={c.leave}>На главный экран</button></main>{toast}</>;
  if (c.room && !game) return <><Lobby controller={c} />{toast}</>;
  if (!game || home) return <><StartScreen controller={c} onPlay={() => setHome(false)} showRules={() => setRules(true)} />{rules && <Rules close={() => setRules(false)} />}{toast}</>;
  const active = game.players[game.activePlayer], placing = game.phase === 'placingTile';
  const pending = game.lastPlaced && game.board[game.lastPlaced];
  const tile = game.currentTile || pending;
  const eligible = game.phase === 'placingMeeple' ? eligibleFeatures(game) : [];
  const ranking = [...game.players].sort((a, b) => b.score - a.score), best = ranking[0].score;
  return <main className={styles.gamePage}><header className={styles.header}><Brand /><div className={styles.headerMeta}><span>{c.session ? `Комната ${c.room?.code}` : 'За одним столом'}</span><span className={styles.connection}>{c.session ? c.connected ? 'В сети' : 'Переподключение…' : 'Сохранено в браузере'}</span></div><nav className={styles.headerActions}><button onClick={() => { if (c.session) c.leave(); setHome(true); }}>Новая игра</button><button onClick={() => setRules(true)}>Правила</button><button disabled={!game.canUndo || !c.canAct} onClick={() => c.act({ type: 'undo' })}>Отменить ход</button></nav></header>
    <div className={styles.gameLayout}><aside className={styles.playersPanel}><div className={styles.panelTitle}><span className={styles.eyebrow}>ЗА ИГРОВЫМ СТОЛОМ</span><span>{game.players.length}</span></div><h2>Строители мира</h2><div className={styles.playerList}>{game.players.map((p, i) => <article key={p.id} className={`${styles.playerCard} ${i === game.activePlayer && game.phase !== 'gameOver' ? styles.activePlayer : ''}`} style={{ '--player-color': p.color } as React.CSSProperties}>
      <div className={styles.playerTop}><span className={styles.playerAvatar}><Meeple color={p.color} size={30} /></span><div><b>{p.name}</b><small>{game.phase === 'gameOver' ? p.score === best ? 'Победитель' : 'Партия завершена' : i === game.activePlayer ? 'Сейчас ходит' : 'Ждёт своего хода'}{c.room?.players.find(r => r.id === p.id)?.connected === false ? ' · Нет связи' : ''}</small></div><strong className={styles.score}>{p.score}<small>очков</small></strong></div><div className={styles.meepleStock}>{Array.from({ length: 7 }, (_, j) => <span key={j} style={{ opacity: j < p.meeples ? 1 : .15 }}><Meeple color={p.color} size={20} /></span>)}<span>{p.meeples}/7</span></div>
    </article>)}</div><section className={styles.journal}><div className={styles.panelTitle}><h3>История партии</h3><span className={styles.historyIcon}>◷</span></div><ol>{[...game.log].reverse().slice(0, 8).map((entry, i) => <li key={entry.id} className={i === 0 ? styles.latestLog : ''}>{entry.text}</li>)}</ol></section><label className={styles.debugToggle}><input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />Режим разработчика</label></aside>
    <div className={styles.centerPanel}><div className={styles.turnBanner}><div><span className={styles.turnIcon}>✦</span><div><span className={styles.eyebrow}>{game.phase === 'gameOver' ? 'ИСТОРИЯ ЗАВЕРШЕНА' : `ХОД ${game.turn} · ${c.session && !c.canAct ? 'НАБЛЮДАЕМ ЗА ИГРОЙ' : 'ПОСТРОЙТЕ ЧТО-ТО ПРЕКРАСНОЕ'}`}</span><h2>{game.phase === 'gameOver' ? 'Каждый тайл нашёл своё место' : `${active.name}, ${placing ? 'ваш следующий тайл' : 'выберите место для фишки'}`}</h2></div></div><div className={styles.deckCount}><b>{game.remainingTiles}</b><span>в колоде</span></div></div>
      <Board game={game} canAct={c.canAct} act={c.act} debug={debug} />{c.session && !c.connected && <div className={styles.connectionBanner}>Нет соединения, пытаемся переподключиться. Ходы временно недоступны.</div>}
    </div><aside className={styles.actionPanel}><span className={styles.eyebrow}>{placing ? 'СЛЕДУЮЩАЯ ГЛАВА' : game.phase === 'gameOver' ? 'ДО НОВОЙ ВСТРЕЧИ' : 'ЕЩЁ ОДНО РЕШЕНИЕ'}</span><h2>{placing ? 'Ваш тайл' : game.phase === 'gameOver' ? 'Мир построен' : 'Ваша фишка'}</h2><p className={styles.actionDescription}>{game.phase === 'gameOver' ? 'Все очки подсчитаны. Хорошая была история!' : placing ? 'Найдите ему место в общей истории.' : 'Займите свободный объект или сохраните фишку на следующий ход.'}</p>
      {tile && <div className={styles.currentTile}><Tile tile={tile} players={game.players} debug={debug} /></div>}{tile && <h3 className={styles.tileName}>{TILE_BY_ID[tile.definitionId].name}</h3>}
      {placing && <><button className={styles.rotateButton} disabled={!c.canAct} onClick={() => c.act({ type: 'rotateTile' })}><span>↻</span> Повернуть тайл <kbd>R</kbd></button><div className={styles.stepList}><p className={styles.currentStep}><b>1</b>Поверните тайл</p><p className={styles.currentStep}><b>2</b>Нажмите на зелёное место</p><p><b>3</b>Разместите фишку</p></div></>}
      {game.phase === 'placingMeeple' && <><div className={styles.featureHint}><Meeple color={active.color} size={35} /><p>{eligible.length ? 'Нажмите на «+» на новом тайле, чтобы поставить фишку.' : 'Нет доступных объектов. Сохраните фишку и передайте ход.'}</p></div><button className={styles.primary} disabled={!c.canAct} onClick={() => c.act({ type: 'skipMeeple' })}>Пропустить и передать ход</button><button className={styles.textButton} disabled={!c.canAct || !game.canUndo} onClick={() => c.act({ type: 'undo' })}>Переложить тайл</button></>}
      {game.phase === 'gameOver' && <button className={styles.primary} onClick={() => setHideResults(false)}>Посмотреть итоги</button>}
      {c.session && !c.canAct && game.phase !== 'gameOver' && <p className={styles.waiting}>Сейчас ходит {active.name}. Поле обновляется автоматически.</p>}
      <div className={styles.scoringGuide}><span className={styles.eyebrow}>МАЛЕНЬКАЯ ПОДСКАЗКА</span><h3>Доводите до конца</h3><p><span>Дорога</span><b>1 / тайл</b></p><p><span>Город</span><b>2 / тайл + щит</b></p><p><span>Монастырь</span><b>до 9 очков</b></p><small>После завершения объекта ваши фишки возвращаются домой.</small></div>
    </aside></div><footer className={styles.gameFooter}><span>Стройте смелее. Играйте вместе.</span><span>{c.session ? 'Ходы проверяет сервер' : 'Локальная партия · Автосохранение'}{game.discarded > 0 ? ` · Сброшено тайлов: ${game.discarded}` : ''}</span></footer>
    {rules && <Rules close={() => setRules(false)} />}{toast}
    {game.phase === 'gameOver' && !hideResults && <div className={styles.backdrop}><section className={`${styles.modal} ${styles.results}`} role="dialog" aria-modal="true" aria-labelledby="result-title"><button className={styles.close} onClick={() => setHideResults(true)} aria-label="Посмотреть поле">×</button><span className={styles.eyebrow}>ПРЕКРАСНАЯ БЫЛА ПАРТИЯ</span><span className={styles.trophy}>♜</span><h2 id="result-title">{ranking.filter(p => p.score === best).map(p => p.name).join(' и ')} — {ranking.filter(p => p.score === best).length > 1 ? 'победители' : 'победитель'}!</h2><p className={styles.muted}>Завершённые и незавершённые объекты подсчитаны.</p><ol className={styles.ranking}>{ranking.map((p, i) => <li key={p.id}><span>{i + 1}</span><Meeple color={p.color} /><b>{p.name}<small>{p.meeples} фишек в запасе</small></b><strong>{p.score}<small>очков</small></strong></li>)}</ol><button className={styles.primary} disabled={Boolean(c.session && c.room?.hostId !== c.session.playerId)} onClick={() => { if (c.session) c.send('restartGame'); else { c.startLocal(game.players.map(p => p.name)); } }}>Начать заново</button>{c.session && c.room?.hostId !== c.session.playerId && <p className={styles.formHint}>Новую партию начнёт создатель комнаты.</p>}</section></div>}
  </main>;
}
