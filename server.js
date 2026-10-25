'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const TOKEN = process.env.BOT_TOKEN || '', BOT = process.env.BOT_USERNAME || '', APP = process.env.APP_SHORT || '';
const PAGE = fs.readFileSync(path.join(__dirname, 'index.html'));
const RULES = `💣 Сапёр УНО — правила

🎯 Цель: остаться последним игроком с ХП.
Режимы: быстрая — 150 ХП, обычная — 300 ХП. Игроков: 2–8. У каждого по 8 карт.

🃏 Ход: клади карту того же цвета или значения, что на столе. Нечего класть — бери одну карту (если она подошла, можно сыграть). Автодобора нет.

💣 Сапёр: ставит мину своего цвета. Второй сапёр того же цвета взрывает её: числа, сыгранные между ними, суммируются, и следующий игрок теряет столько ХП. Два сапёра подряд — следующий теряет половину ХП.

⚡ Урон (+10, +15, +20): бьёшь любого игрока. Если ударили тебя (уроном или взрывом), можно сразу ответить контр-ударом картой урона.

💊 Лечение (+10, +20): лечишь себя, но не выше максимума.

🧲 Докопайся: следующий игрок тянет карты, пока не выпадет карта цвета, который лежал на столе, и сразу кладёт её.

🔋 Перезарядка: сбросил все карты — получаешь +50% от максимума ХП (в командах +25% общего запаса, но не выше максимума) и берёшь 8 новых.

Классика: ⏭ пропуск, 🔄 разворот, 🎨 смена цвета.

👥 Командный режим (1×1, 2×2, 3×3, 4×4 — всего 2, 4, 6 или 8 игроков): игроки сидят по очереди, у каждой команды общий запас ХП (300 или 600). Урон по любому игроку команды уменьшает общий запас, лечение и перезарядка его восстанавливают. Карты у каждого свои, бить можно только соперников. Побеждает команда, у которой остался запас ХП. Хозяин комнаты может включить опцию «карты напарника видны». Формат выбирает хозяин, свободные места можно заполнить ботами.`;
const SITE = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || '';
const HOOK = '/tg/' + crypto.createHash('sha256').update(TOKEN || 'x').digest('hex').slice(0, 24);
const tgCall = (m, b) => fetch('https://api.telegram.org/bot' + TOKEN + '/' + m, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
function onUpdate(u) {
  const m = u.message;
  if (!m || !m.text || !/^\/(start|rules|help)/.test(m.text)) return;
  const kb = SITE ? { inline_keyboard: [[{ text: '🎮 Играть', web_app: { url: SITE } }]] } : undefined;
  tgCall('sendMessage', { chat_id: m.chat.id, text: RULES, reply_markup: kb }).catch(() => {});
}
const srv = http.createServer((q, r) => {
  if (q.url === '/health') return r.end('ok');
  if (TOKEN && q.method === 'POST' && q.url === HOOK) {
    let b = ''; q.on('data', d => { b += d; if (b.length > 1e5) q.destroy(); });
    q.on('end', () => { r.end('ok'); try { onUpdate(JSON.parse(b)); } catch (e) {} });
    return;
  }
  if (q.method === 'POST' && q.url === HOOK && TOKEN) { let b = ''; q.on('data', d => b += d); q.on('end', () => { r.end('ok'); try { onUpdate(JSON.parse(b)); } catch (e) {} }); return; }
  r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(PAGE);
});
const wss = new WebSocketServer({ server: srv }), ROOMS = {};
const CN = { r: 'красный', b: 'синий', g: 'зелёный', y: 'жёлтый' }, COLS = Object.keys(CN);
const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mkDeck() {
  const d = [];
  for (const c of COLS) {
    for (let v = 0; v < 10; v++) { d.push({ t: 'n', c, v }); if (v) d.push({ t: 'n', c, v }); }
    for (let i = 0; i < 3; i++) d.push({ t: 's', c });
    for (let i = 0; i < 2; i++) { d.push({ t: 'skip', c }); d.push({ t: 'rev', c }); }
  }
  [10, 10, 10, 10, 15, 15, 15, 15, 20, 20].forEach(v => d.push({ t: 'd', v }));
  [10, 10, 10, 10, 20, 20].forEach(v => d.push({ t: 'h', v }));
  for (let i = 0; i < 4; i++) { d.push({ t: 'k' }); d.push({ t: 'w' }); }
  return sh(d);
}
const nm = c => ({ n: () => c.v + ' ' + CN[c.c], s: () => 'Сапёр ' + CN[c.c], d: () => 'Урон +' + c.v, h: () => 'Лечение +' + c.v,
  k: () => 'Докопайся', skip: () => 'Пропуск ' + CN[c.c], rev: () => 'Разворот ' + CN[c.c], w: () => 'Смена цвета' })[c.t]();
const autoP = p => p.bot || !p.ws;
const hpOf = (R, i) => R.team ? R.tp[R.P[i].team] : R.P[i].hp;
const foes = (R, i) => R.P.map((p, j) => j).filter(j => j !== i && R.P[j].alive && (!R.team || R.P[j].team !== R.P[i].team));
const nt = r => r.P.filter(p => p.team === 0).length > r.P.filter(p => p.team === 1).length ? 1 : 0;
const alive = R => R.P.filter(p => p.alive);
const nx = (R, i, d = R.dir) => { const n = R.P.length; let j = i; do { j = (j + d + n) % n; } while (!R.P[j].alive); return j; };
const lg = (R, m) => { R.log.unshift(m); R.log.length = Math.min(R.log.length, 5); };
function drw(R, p) {
  if (!R.deck.length) { const t = R.disc.pop(); R.deck = sh(R.disc); R.disc = [t]; }
  if (!R.deck.length) return null;
  const c = R.deck.pop(); p.hand.push(c); return c;
}
const ok = (R, c) => {
  const t = R.disc[R.disc.length - 1];
  if ('dhkw'.includes(c.t)) return true;
  if (c.c === R.col) return true;
  return c.t === 'n' ? (t.t === 'n' && t.v === c.v) : (c.t === t.t && (c.t === 'skip' || c.t === 'rev'));
};
function hit(R, i, dm, why) {
  const t = R.P[i];
  if (R.team) R.tp[t.team] = Math.max(0, R.tp[t.team] - dm); else t.hp = Math.max(0, t.hp - dm);
  lg(R, `${t.name}: −${dm} ХП (${why})`); R.ev.push({ k: 'hit', i, v: dm });
  if (!hpOf(R, i)) {
    const out = R.team ? R.P.filter(p => p.team === t.team) : [t];
    out.forEach(p => { p.alive = false; R.deck = sh(R.deck.concat(p.hand)); p.hand = []; });
    lg(R, R.team ? `Команда ${t.team ? 'синих' : 'красных'} выбывает!` : `${t.name} выбывает!`);
  } else if (dm > 0 && !R.nc) R.hits.push({ t: i, a: R.hitter });
}
function rch(R) {
  R.P.forEach((p, i) => {
    if (p.alive && !p.hand.length) {
      const cur = hpOf(R, i), nh = Math.min(R.max, cur + Math.round(R.max * (R.team ? 0.25 : 0.5)));
      if (R.team) R.tp[p.team] = nh; else p.hp = nh;
      for (let k = 0; k < 8; k++) drw(R, p);
      lg(R, `${p.name}: перезарядка! +${nh - cur} ХП и 8 карт`); R.ev.push({ k: 'rch', i });
    }
  });
}
function apply(R, i, ci, o) {
  const p = R.P[i], c = p.hand.splice(ci, 1)[0]; R.disc.push(c); R.hitter = i;
  lg(R, `${p.name}: ${nm(c)}${c.t === 'w' ? ' → ' + CN[o.col] : ''}`); R.ev.push({ k: 'card', i });
  if (c.t === 's') {
    R.col = c.c; const m = R.mines[c.c];
    if (!m) { R.mines[c.c] = { sum: 0, n: 0 }; lg(R, 'Мина ' + CN[c.c] + ' поставлена'); }
    else {
      const t = nx(R, i); delete R.mines[c.c]; R.ev.push({ k: 'boom' });
      hit(R, t, m.n ? m.sum : Math.floor(hpOf(R, t) / 2), m.n ? 'взрыв мины' : 'два сапёра подряд');
    }
    for (const x in R.mines) if (x !== c.c) R.mines[x].n++;
  } else for (const x in R.mines) { R.mines[x].n++; if (c.t === 'n') R.mines[x].sum += c.v; }
  if (c.c && c.t !== 's') R.col = c.c;
  if (c.t === 'w') R.col = o.col;
  if (c.t === 'h') { if (R.team) R.tp[p.team] = Math.min(R.max, R.tp[p.team] + c.v); else p.hp = Math.min(R.max, p.hp + c.v);
    R.ev.push({ k: 'heal', i, v: c.v }); }
  if (c.t === 'd') hit(R, o.t, c.v, 'урон');
  if (c.t === 'skip') R.skip = 1;
  if (c.t === 'rev') { R.dir *= -1; if (alive(R).length === 2) R.skip = 1; }
  if (c.t === 'k') dok(R, i);
}
function dok(R, i) {
  const v = nx(R, i), V = R.P[v];
  lg(R, `${V.name} тянет, пока не выпадет ${CN[R.col]}`);
  while (true) { const c = drw(R, V); if (!c) break; if (c.c === R.col) { apply(R, v, V.hand.length - 1, {}); break; } }
  R.cur = v;
}
function view(R, pi) {
  const pd = R.pend, T = pd && pd.t === pi;
  let cn = null;
  if (T) cn = { v: [...new Set(R.P[pi].hand.filter(c => c.t === 'd').map(c => c.v))], en: foes(R, pi) };
  return {
    room: R.code, phase: R.phase, you: pi, host: R.P[pi].id === R.hostId, max: R.max, cur: R.cur, col: R.col,
    dn: R.deck.length, top: R.disc[R.disc.length - 1], drawn: R.drawn, log: R.log, winner: R.winner,
    mines: Object.fromEntries(Object.entries(R.mines).map(([c, m]) => [c, m.sum])),
    P: R.P.map((p, j) => ({ name: p.name, hp: hpOf(R, j), team: p.team, n: p.hand.length, alive: p.alive, bot: !!p.bot, on: !!p.ws })),
    team: !!R.team, size: R.size, open: !!R.open, tp: R.tp, tm: R.P[pi].team,
    mates: R.team && R.open && R.phase !== 'lobby' ? R.P.map((p, j) => j !== pi && p.team === R.P[pi].team ? { j, hand: p.hand } : null).filter(Boolean) : [],
    hand: R.P[pi].hand, wait: pd ? pd.t : -1, cn, bot: BOT, app: APP
  };
}
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function push(R) {
  const ev = R.ev; R.ev = [];
  R.P.forEach((p, i) => { if (p.ws) send(p.ws, { s: 'st', v: view(R, i), ev }); });
}
function sched(R) {
  if (R.phase !== 'play' || R.pend) return;
  const p = R.P[R.cur];
  if (p && autoP(p)) { clearTimeout(R.tm); R.tm = setTimeout(() => botTurn(R), 1800); }
}
function settle(R) {
  while (R.hits.length) {
    const h = R.hits.shift(), T = R.P[h.t]; if (!T.alive) continue;
    const en = foes(R, h.t);
    if (!T.hand.some(c => c.t === 'd') || !en.length) continue;
    R.pend = { t: h.t, a: h.a }; clearTimeout(R.tm);
    R.tm = setTimeout(() => auto(R), autoP(T) ? 1500 : 12000);
    return push(R);
  }
  rch(R);
  const left = R.team ? new Set(alive(R).map(p => p.team)).size : alive(R).length;
  if (left < 2 || !R.P.some(p => p.alive && !p.bot)) {
    R.phase = 'over';
    if (R.team) R.winner = left === 1 && R.P.some(p => p.alive && !p.bot) ? alive(R)[0].team : -1;
    else { const w = R.P.findIndex(p => p.alive && !p.bot); R.winner = alive(R).length === 1 && w >= 0 ? w : -1; }
    return push(R);
  }
  let n = nx(R, R.cur); if (R.skip) { R.skip = 0; n = nx(R, n); }
  R.cur = n; R.drawn = 0; push(R); sched(R);
}
function auto(R) {
  const pd = R.pend; if (!pd) return;
  const T = R.P[pd.t]; let r = null;
  if (autoP(T) && Math.random() < 0.5) {
    const ds = T.hand.filter(c => c.t === 'd').sort((x, y) => y.v - x.v);
    const en = foes(R, pd.t);
    if (ds.length && en.length) r = { v: ds[0].v, t: en.includes(pd.a) ? pd.a : en[0] };
  }
  resp(R, r);
}
function resp(R, r) {
  const pd = R.pend; if (!pd) return;
  clearTimeout(R.tm); R.pend = null;
  const T = R.P[pd.t];
  if (r) {
    const k = T.hand.findIndex(c => c.t === 'd' && c.v === r.v), X = R.P[r.t];
    if (k >= 0 && X && foes(R, pd.t).includes(r.t)) {
      const c = T.hand.splice(k, 1)[0]; R.disc.push(c);
      lg(R, `${T.name}: контр-удар +${c.v}`); R.ev.push({ k: 'card', i: pd.t });
      R.nc = 1; hit(R, r.t, c.v, 'контр-удар'); R.nc = 0;
    }
  }
  settle(R);
}
function botTurn(R) {
  if (R.phase !== 'play' || R.pend) return;
  const i = R.cur, p = R.P[i]; if (!autoP(p)) return;
  let pl = p.hand.map((c, k) => k).filter(k => ok(R, p.hand[k]));
  R.hits = [];
  if (!pl.length) {
    const c = drw(R, p); lg(R, `${p.name} берёт карту`); R.ev.push({ k: 'draw', i });
    if (!c || !ok(R, c)) return settle(R);
    pl = [p.hand.length - 1];
  }
  const en = foes(R, i);
  const sc = k => { const c = p.hand[k]; return [({ d: 8, k: 6, s: 7, h: hpOf(R, i) <= R.max - 10 ? 9 : -1, n: 3 + (c.v || 0) / 10, skip: 4, rev: 3, w: 1 })[c.t] + Math.random() * 2, k]; };
  const k = pl.map(sc).sort((a, b) => b[0] - a[0])[0][1], c = p.hand[k], o = {};
  if (c.t === 'w') { const n = {}; p.hand.forEach(x => x.c && (n[x.c] = (n[x.c] || 0) + 1)); o.col = COLS.slice().sort((a, b) => (n[b] || 0) - (n[a] || 0))[0]; }
  if (c.t === 'd') o.t = en.sort((a, b) => hpOf(R, a) - hpOf(R, b))[0];
  apply(R, i, k, o); settle(R);
}
function newRoom() {
  let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (ROOMS[c]);
  return ROOMS[c] = { code: c, P: [], phase: 'lobby', hostId: '', max: 150, team: false, size: 4, open: false, tp: [0, 0], log: [], ev: [], hits: [], mines: {}, deck: [], disc: [],
    cur: 0, dir: 1, col: 'r', skip: 0, drawn: 0, pend: null, nc: 0, winner: -1, idle: Date.now() };
}
function startGame(R, hp) {
  R.max = hp; R.phase = 'play'; R.tp = [hp, hp]; R.P.forEach(p => { p.hp = hp; p.hand = []; p.alive = true; });
  if (R.team) {
    const a = R.P.filter(p => p.team === 0), b = R.P.filter(p => p.team === 1), o = [];
    for (let k = 0; k < Math.max(a.length, b.length); k++) { if (a[k]) o.push(a[k]); if (b[k]) o.push(b[k]); }
    R.P = o;
  }
  R.deck = mkDeck(); R.disc = []; R.mines = {}; R.dir = 1; R.skip = 0; R.drawn = 0; R.pend = null; R.hits = []; R.winner = -1;
  R.log = ['Игра началась!'];
  R.P.forEach(p => { for (let i = 0; i < 8; i++) drw(R, p); });
  let c; while ((c = R.deck.pop()).t !== 'n') R.deck.unshift(c);
  R.disc = [c]; R.col = c.c; R.cur = Math.random() * R.P.length | 0;
  push(R); sched(R);
}
function tgUser(init) {
  if (!TOKEN || !init) return null;
  try {
    const p = new URLSearchParams(init), h = p.get('hash'); p.delete('hash');
    const s = [...p.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
    const key = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    if (crypto.createHmac('sha256', key).update(s).digest('hex') !== h) return null;
    const u = JSON.parse(p.get('user')); return { id: 't' + u.id, name: String(u.first_name || 'Игрок').slice(0, 16) };
  } catch (e) { return null; }
}
wss.on('connection', ws => {
  let U = null, R = null;
  const err = t => send(ws, { s: 'err', t });
  const me = () => R ? R.P.findIndex(p => p.id === U.id) : -1;
  function join(code) {
    const r = ROOMS[String(code || '').toUpperCase()]; if (!r) return err('Комната не найдена');
    let i = r.P.findIndex(p => p.id === U.id);
    if (i < 0) {
      if (r.phase !== 'lobby') return err('Игра уже идёт');
      if (r.P.length >= (r.team ? r.size : 8)) return err('Комната полна');
      r.P.push({ id: U.id, name: U.name, bot: 0, hand: [], hp: 0, alive: true, team: nt(r), ws }); i = r.P.length - 1;
    }
    R = r; r.P[i].ws = ws; r.idle = Date.now(); push(r); if (r.phase === 'play') sched(r);
  }
  function leave() {
    if (!R) return; const r = R, i = me(); R = null; r.idle = Date.now();
    if (i < 0) return;
    if (r.phase === 'lobby') {
      r.P.splice(i, 1);
      const h = r.P.find(p => !p.bot && p.ws);
      if (!h) { delete ROOMS[r.code]; return; }
      if (r.hostId === U.id) r.hostId = h.id;
    } else { r.P[i].ws = null; sched(r); }
    push(r);
  }
  ws.on('message', d => {
    let m; try { m = JSON.parse(d); } catch (e) { return; }
    if (m.a === 'hello') {
      U = tgUser(m.init) || { id: 'g' + String(m.uid || Math.random()).slice(0, 24), name: String(m.name || 'Гость').slice(0, 16) };
      return;
    }
    if (!U) return;
    if (m.a === 'rules') return send(ws, { s: 'rules', t: RULES });
    if (m.a === 'create') { if (R) leave(); const r = newRoom(); r.hostId = U.id; return join(r.code); }
    if (m.a === 'solo') {
      if (R) leave(); const r = newRoom(); r.hostId = U.id; join(r.code);
      if (m.team) {
        r.team = true; r.size = [2, 4, 6, 8].includes(m.size) ? m.size : 4;
        while (r.P.length < r.size) r.P.push({ id: 'b' + r.P.length, name: 'Бот ' + r.P.length, bot: 1, hand: [], hp: 0, alive: true, team: nt(r), ws: null });
        return startGame(r, m.hp === 600 ? 600 : 300);
      }
      const n = Math.min(3, Math.max(1, m.n | 0 || 1));
      for (let k = 1; k <= n; k++) r.P.push({ id: 'b' + k, name: 'Бот ' + k, bot: 1, hand: [], hp: 0, alive: true, team: 0, ws: null });
      return startGame(r, m.hp === 300 ? 300 : 150);
    }
    if (m.a === 'join') { if (R) leave(); return join(m.room); }
    if (!R) return;
    R.idle = Date.now(); const pi = me(); if (pi < 0) return;
    if (m.a === 'leave') return leave();
    if (m.a === 'bot' && R.hostId === U.id && R.phase === 'lobby' && R.P.length < (R.team ? R.size : 8)) {
      const k = R.P.filter(p => p.bot).length + 1;
      R.P.push({ id: 'b' + Date.now() + k, name: 'Бот ' + k, bot: 1, hand: [], hp: 0, alive: true, team: nt(R), ws: null }); return push(R);
    }
    if (m.a === 'start' && R.hostId === U.id && (R.phase === 'lobby' || R.phase === 'over')) {
      R.P = R.P.filter(p => p.bot || p.ws);
      if (R.P.length < 2) return err('Нужно минимум 2 игрока');
      if (R.team) {
        if (R.phase === 'over' && R.P.length % 2 === 0) R.size = R.P.length;
        if (R.P.length !== R.size) return err('Нужно игроков: ' + R.size + ' — добавь ботов');
        const c0 = R.P.filter(p => p.team === 0).length;
        if (c0 !== R.size / 2) return err('Команды должны быть равными');
        return startGame(R, m.hp === 600 ? 600 : 300);
      }
      return startGame(R, m.hp === 300 ? 300 : 150);
    }
    if (m.a === 'mode' && R.hostId === U.id && R.phase === 'lobby') {
      R.team = !!m.team;
      if (R.team) { R.size = Math.min(8, Math.max(2, R.size, R.P.length + R.P.length % 2)); R.P.forEach((p, k) => p.team = k % 2); }
      return push(R);
    }
    if (m.a === 'size' && R.hostId === U.id && R.phase === 'lobby' && R.team) {
      const n = m.n | 0; if (![2, 4, 6, 8].includes(n)) return;
      if (R.P.filter(p => !p.bot).length > n) return err('Игроков больше, чем мест');
      while (R.P.length > n) R.P.splice(R.P.map(p => p.bot).lastIndexOf(1), 1);
      R.size = n; R.P.forEach((p, k) => p.team = k % 2); return push(R);
    }
    if (m.a === 'fill' && R.hostId === U.id && R.phase === 'lobby' && R.team) {
      while (R.P.length < R.size) { const k = R.P.filter(p => p.bot).length + 1;
        R.P.push({ id: 'b' + Date.now() + k, name: 'Бот ' + k, bot: 1, hand: [], hp: 0, alive: true, team: nt(R), ws: null }); }
      return push(R);
    }
    if (m.a === 'open' && R.hostId === U.id && R.phase === 'lobby') { R.open = !!m.on; return push(R); }
    if (m.a === 'team' && R.phase === 'lobby') {
      const t = m.t ? 1 : 0;
      if (R.team && R.P[pi].team !== t && R.P.filter(p => p.team === t).length >= R.size / 2) return err('Команда заполнена');
      R.P[pi].team = t; return push(R);
    }
    if (R.phase !== 'play') return;
    const p = R.P[pi];
    if (m.a === 'counter' && R.pend && R.pend.t === pi) return resp(R, { v: m.v, t: m.t });
    if (m.a === 'nocounter' && R.pend && R.pend.t === pi) return resp(R, null);
    if (R.pend || R.cur !== pi || !p.alive) return;
    if (m.a === 'play') {
      const c = p.hand[m.ci]; if (!c || !ok(R, c)) return;
      const o = {};
      if (c.t === 'w') { if (!COLS.includes(m.col)) return; o.col = m.col; }
      if (c.t === 'd') { const X = R.P[m.t]; if (!X || !foes(R, pi).includes(m.t)) return; o.t = m.t; }
      R.hits = []; apply(R, pi, m.ci, o); return settle(R);
    }
    if (m.a === 'draw') {
      if (R.drawn || p.hand.some(c => ok(R, c))) return;
      const c = drw(R, p); R.ev.push({ k: 'draw', i: pi }); lg(R, `${p.name} берёт карту`); R.drawn = 1; R.hits = [];
      if (!c || !ok(R, c)) return settle(R);
      return push(R);
    }
    if (m.a === 'pass' && R.drawn) { R.hits = []; return settle(R); }
  });
  ws.on('close', () => leave());
});
setInterval(() => { for (const c in ROOMS) { const r = ROOMS[c]; if (!r.P.some(p => p.ws) && Date.now() - r.idle > 6e5) { clearTimeout(r.tm); delete ROOMS[c]; } } }, 6e4);
setInterval(() => wss.clients.forEach(c => c.readyState === 1 && c.ping()), 30000);
srv.listen(process.env.PORT || 3000, () => {
  console.log('Сапёр УНО запущен');
  if (TOKEN && SITE) tgCall('setWebhook', { url: SITE + HOOK }).then(x => console.log('webhook', x.ok)).catch(() => {});
});
