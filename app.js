'use strict';
/* RepRank — workout tracker. All data lives in this browser (localStorage). */

const $ = (s, el = document) => el.querySelector(s);
const KEY = 'reprank:v1';
const LB_PER_KG = 2.20462;

let S = loadState();
const ui = { tab: 'today', survey: null, step: 0, modal: null, restEnd: 0, restTotal: 0 };

/* ================= State ================= */
function defaultState() {
  return { profile: null, weights: [], prs: {}, history: [], rotation: 0, today: null, notified: {} };
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return Object.assign(defaultState(), s);
  } catch (e) { /* storage unavailable */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  pushStateToSW();
}

/* ================= Helpers ================= */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function dkey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(k) { return parseKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(seed) {
  let a = hashStr(String(seed));
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function weightedPick(arr, wfn, rng) {
  const total = arr.reduce((s, x) => s + wfn(x), 0);
  let r = rng() * total;
  for (const x of arr) { r -= wfn(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
}

/* Units: weights stored in lb, height in inches */
const metric = () => !!S.profile && S.profile.units === 'metric';
const wu = () => (metric() ? 'kg' : 'lb');
function toDisp(lbs) {
  if (lbs == null || lbs === '' || isNaN(lbs)) return '';
  const v = metric() ? lbs / LB_PER_KG : lbs;
  return Math.round(v * 10) / 10;
}
function fromDisp(v) { v = parseFloat(v); if (isNaN(v)) return null; return metric() ? v * LB_PER_KG : v; }
function fmtW(lbs) { return `${toDisp(lbs)} ${wu()}`; }
function roundToInc(lbs, inc) {
  const d = metric() ? lbs / LB_PER_KG : lbs;
  const r = Math.max(inc, Math.round(d / inc) * inc);
  return metric() ? r * LB_PER_KG : r;
}
function fmtHeight(inches) {
  if (!inches) return '—';
  if (metric()) return `${Math.round(inches * 2.54)} cm`;
  const ft = Math.floor(inches / 12); const inch = Math.round(inches - ft * 12);
  return `${ft}′${inch}″`;
}
function currentBW() {
  const w = S.weights.length ? S.weights[S.weights.length - 1].lbs : S.profile?.weightLbs;
  return w || 170;
}

/* ================= Workout generation ================= */
function activeSplitKey(p = S.profile) {
  if (p.split && p.split !== 'auto' && SPLITS[p.split]) return p.split;
  return recommendSplit(p);
}
function recommendSplit(p) {
  const d = +p.daysPerWeek || 4;
  if (d <= 2) return 'full';
  if (d === 3) return p.experience === 'beginner' ? 'full' : 'ppl';
  if (d === 4) return 'upperlower';
  if (d === 6) return 'ppl';
  return 'bro';
}
const activeSplit = () => SPLITS[activeSplitKey()].days;
const upcomingDayType = () => activeSplit()[S.rotation % activeSplit().length];

function exerciseCount(mins) { mins = +mins || 60; return mins <= 30 ? 4 : mins <= 45 ? 5 : mins <= 60 ? 6 : 7; }

function availableFor(muscle, p = S.profile) {
  const allow = EQUIPMENT[p.equipment || 'gym'].allow;
  const inj = p.injuries || [];
  return Object.values(EX).filter((e) => e.muscle === muscle && allow.includes(e.equip) && !e.avoid.some((a) => inj.includes(a)));
}

function scheme(exId) {
  const p = S.profile; const e = EX[exId];
  const g = GOALS[p.goal] || GOALS.general;
  let [sets, lo, hi, rest] = e.compound ? g.c : g.i;
  if (p.experience === 'beginner') sets = Math.max(2, sets - 1);
  if (p.experience === 'advanced' && e.compound) sets += 1;
  if (e.timed) { lo = 30; hi = 60; rest = 60; sets = 3; }
  else if (e.bw && !e.compound && hi < 12) { lo = 10; hi = 15; }
  return { sets, lo, hi, rest };
}

function lastPerformance(exId) {
  for (const h of S.history) {
    const x = h.exercises.find((e) => e.exId === exId);
    if (x && x.sets.length) return { date: h.date, sets: x.sets };
  }
  return null;
}

function suggestion(exId, sch) {
  const e = EX[exId];
  const big = e.compound && (e.muscle === 'quads' || e.muscle === 'hams' || exId === 'deadlift');
  const inc = metric() ? (big ? 5 : 2.5) : (big ? 10 : 5);
  const last = lastPerformance(exId);
  if (last) {
    const top = Math.max(...last.sets.map((s) => +s.w || 0));
    const topSets = last.sets.filter((s) => (+s.w || 0) === top);
    const hitAll = topSets.every((s) => (+s.r || 0) >= sch.hi);
    const lastTxt = e.timed ? last.sets.map((s) => `${s.r}s`).join(', ')
      : e.bw && !top ? last.sets.map((s) => s.r).join(', ') + ' reps'
      : `${toDisp(top)}${wu()} × ${topSets.map((s) => s.r).join(',')}`;
    if (e.timed || (e.bw && !top)) {
      return { w: top || null, note: `Last time: ${lastTxt}${hitAll ? ' — go for more today' : ''}` };
    }
    const w = hitAll ? top + (metric() ? inc * LB_PER_KG : inc) : top;
    return { w, note: `Last time: ${lastTxt}${hitAll ? ` → hit all reps, try ${fmtW(w)}` : ' → match it or beat it'}` };
  }
  const pr = S.prs[exId];
  if (pr && !e.bw && !e.timed) {
    const e1 = e1rm(pr.w, pr.r);
    const w = roundToInc((e1 / (1 + sch.hi / 30)) * 0.92, inc);
    return { w, note: `Based on your PR (${fmtW(pr.w)} × ${pr.r})` };
  }
  return { w: null, note: e.bw ? '' : 'First time — pick a weight you can do with 2 reps left in the tank' };
}

function makeEntry(exId) {
  const sch = scheme(exId); const sug = suggestion(exId, sch);
  return {
    exId, ...sch, sugW: sug.w, note: sug.note,
    sets: Array.from({ length: sch.sets }, () => ({ w: null, r: null, done: false })),
  };
}

function genWorkout(dayType, seed) {
  const p = S.profile; const dt = DAY_TYPES[dayType];
  const n = exerciseCount(p.sessionMin);
  const slots = dt.slots.slice(0, n);
  const focusMuscles = (p.focus || []).flatMap((f) => FOCUS[f]?.muscles || []);
  const extra = dt.slots.find((m) => focusMuscles.includes(m));
  if (extra) slots.splice(Math.min(2, slots.length), 0, extra);
  const rng = seeded(seed + dayType);
  const chosen = []; const seen = {};
  for (const m of slots) {
    const pool = availableFor(m).filter((e) => !chosen.includes(e.id));
    if (!pool.length) continue;
    const first = !seen[m]; seen[m] = true;
    let cand = first ? pool.filter((e) => e.compound) : pool.filter((e) => !e.compound);
    if (!cand.length) cand = pool;
    const pick = weightedPick(cand, (e) => (first && RANK_LIFTS[e.id] ? 4 : 1) + (lastPerformance(e.id) ? 1 : 0) + (first && S.prs[e.id] ? 6 : 0), rng);
    chosen.push(pick.id);
  }
  return chosen.map(makeEntry);
}

function newToday(dayType) {
  const k = dkey();
  S.today = { date: k, dayType, exercises: genWorkout(dayType, k + ':' + S.rotation), finished: false, started: null, planned: dayType === upcomingDayType() };
}

function ensureToday() {
  if (!S.profile) return;
  const k = dkey();
  if (S.today && S.today.date === k) return;
  // A previous day left unfinished with logged sets? Save it.
  if (S.today && !S.today.finished && S.today.exercises.some((e) => e.sets.some((s) => s.done))) finishWorkout(true);
  newToday(upcomingDayType());
  save();
}

function estMinutes(t) {
  return Math.round(t.exercises.reduce((m, e) => m + e.sets.length * (e.rest + 45), 0) / 60);
}
function sessionsThisWeek() {
  const now = new Date(); const day = (now.getDay() + 6) % 7; // Monday start
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const days = new Set(S.history.filter((h) => parseKey(h.date) >= start).map((h) => h.date));
  return days.size;
}
function streak() {
  const days = new Set(S.history.map((h) => h.date));
  let n = 0; const d = new Date();
  if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
  // allow rest days: count consecutive weeks would be fairer; use day streak with 1 rest day grace
  let gap = 0;
  while (gap <= 1) {
    if (days.has(dkey(d))) { n++; gap = 0; } else gap++;
    d.setDate(d.getDate() - 1);
    if (n > 3650) break;
  }
  return n;
}

/* ================= PRs & ranks ================= */
function e1rm(w, r) { w = +w || 0; r = +r || 0; if (r <= 0 || w <= 0) return 0; return r === 1 ? w : w * (1 + Math.min(r, 15) / 30); }
function setScore(exId, w, r) {
  const e = EX[exId]; w = +w || 0; r = +r || 0;
  if (r <= 0) return 0;
  if (e.timed) return r;
  if (e.bw) return (currentBW() + w) * (1 + r / 30);
  return e1rm(w, r);
}
function prScore(exId) { const pr = S.prs[exId]; return pr ? setScore(exId, pr.w, pr.r) : 0; }
function fmtSet(exId, w, r) {
  const e = EX[exId];
  if (e.timed) return `${r}s`;
  if (e.bw) return w > 0 ? `BW+${fmtW(w)} × ${r}` : `${r} reps`;
  return `${fmtW(w)} × ${r}`;
}

function commitPRs(exId, sets, date) {
  let best = null;
  for (const s of sets) { const sc = setScore(exId, s.w, s.r); if (!best || sc > best.sc) best = { ...s, sc }; }
  if (!best || best.sc <= 0) return null;
  const old = prScore(exId);
  if (best.sc > old + 0.01) {
    const prev = S.prs[exId];
    S.prs[exId] = { w: +best.w || 0, r: +best.r, date };
    return { exId, w: +best.w || 0, r: +best.r, prev };
  }
  return null;
}

function liftValue(exId) {
  const pr = S.prs[exId]; if (!pr) return null;
  const L = RANK_LIFTS[exId]; const bw = currentBW();
  if (L.type === 'ratio') return e1rm(pr.w, pr.r) / bw;
  if (!pr.w) return pr.r;
  return 30 * (((bw + pr.w) * (1 + pr.r / 30)) / bw - 1);
}
function thresholds(exId) {
  const L = RANK_LIFTS[exId];
  const f = S.profile?.sex === 'female' ? L.ff : 1;
  return L.std.map((x) => x * f);
}
function rankOf(v, th) {
  let idx = 0; while (idx < th.length && v >= th[idx]) idx++;
  const lo = idx === 0 ? 0 : th[idx - 1]; const hi = idx < th.length ? th[idx] : null;
  const frac = hi == null ? 1 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return { idx, frac, next: hi, score: idx + (hi == null ? 0 : frac) };
}
function groupRanks() {
  const out = {};
  for (const [g, def] of Object.entries(RANK_GROUPS)) {
    let best = null;
    for (const id of def.lifts) {
      const v = liftValue(id); if (v == null) continue;
      const r = rankOf(v, thresholds(id));
      if (!best || r.score > best.score) best = { ...r, lift: id, value: v };
    }
    out[g] = best;
  }
  return out;
}
function overallRank(gr) {
  const vals = Object.values(gr).filter(Boolean);
  if (!vals.length) return null;
  const avg = vals.reduce((s, r) => s + r.score, 0) / vals.length;
  return { idx: Math.min(7, Math.floor(avg)), frac: avg - Math.floor(avg), count: vals.length, avg };
}
function nextRankText(r) {
  if (!r) return '';
  if (r.next == null) return 'Max rank reached 👑';
  const L = RANK_LIFTS[r.lift]; const nm = RANKS[r.idx + 1].n;
  if (L.type === 'ratio') {
    const target = r.next * currentBW();
    const e = EX[r.lift];
    const w5 = target / (1 + 5 / 30);
    const inc = metric() ? 2.5 : 5;
    return `${nm}: est. 1RM of ${fmtW(roundToInc(target, inc))} (≈ ${fmtW(roundToInc(w5, inc))} × 5) on ${e.name}`;
  }
  return `${nm}: ${Math.ceil(r.next)} reps of ${EX[r.lift].name}`;
}

/* ================= Finish workout ================= */
function finishWorkout(silent) {
  const t = S.today;
  const done = t.exercises
    .map((e) => ({ exId: e.exId, sets: e.sets.filter((s) => s.done).map((s) => ({ w: +s.w || 0, r: +s.r || 0 })) }))
    .filter((e) => e.sets.length);
  if (!done.length) { if (!silent) toast('Log at least one set first'); return; }
  const before = groupRanks();
  const prs = done.map((e) => commitPRs(e.exId, e.sets, t.date)).filter(Boolean);
  const mins = t.started ? Math.max(1, Math.round((Date.now() - t.started) / 60000)) : null;
  S.history.unshift({ id: Date.now(), date: t.date, dayType: t.dayType, exercises: done, mins });
  const split = activeSplit();
  const pos = split.indexOf(t.dayType);
  if (t.planned || pos < 0) S.rotation += 1;
  else S.rotation = S.rotation - (S.rotation % split.length) + pos + 1;
  t.finished = true;
  ui.restEnd = 0; ui.restTotal = 0; clearInterval(restInterval); $('#restbar').hidden = true;
  const after = groupRanks();
  const rankUps = Object.keys(after).filter((g) => after[g] && (!before[g] || after[g].idx > before[g].idx))
    .map((g) => ({ g, idx: after[g].idx }));
  save();
  if (silent) return;
  const sets = done.reduce((n, e) => n + e.sets.length, 0);
  const vol = done.reduce((v, e) => v + e.sets.reduce((a, s) => a + (EX[e.exId].bw || EX[e.exId].timed ? 0 : s.w * s.r), 0), 0);
  openModal(`
    <div class="center">
      <div class="big-emoji">🏆</div>
      <h2>Workout complete!</h2>
      <p class="muted">${DAY_TYPES[t.dayType].name} · ${sets} sets${mins ? ` · ${mins} min` : ''}${vol ? ` · ${fmtW(Math.round(vol))} moved` : ''}</p>
    </div>
    ${prs.length ? `<h3>New PRs 🔥</h3><ul class="plain">${prs.map((p) => `<li><b>${EX[p.exId].name}</b> — ${fmtSet(p.exId, p.w, p.r)}${p.prev ? ` <span class="muted">(was ${fmtSet(p.exId, p.prev.w, p.prev.r)})</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${rankUps.length ? `<h3>Rank up! ⬆️</h3><ul class="plain">${rankUps.map((u) => `<li><b>${RANK_GROUPS[u.g].name}</b> → <span style="color:${RANKS[u.idx].c}">${RANKS[u.idx].n}</span></li>`).join('')}</ul>` : ''}
    <p class="muted">Next up: <b>${DAY_TYPES[upcomingDayType()].name}</b></p>
    <button class="btn primary block" data-action="close-modal">Nice</button>`);
  if (prs.length) notify('New PR! 🔥', prs.map((p) => `${EX[p.exId].name}: ${fmtSet(p.exId, p.w, p.r)}`).join('\n'), 'pr');
  for (const u of rankUps) notify('Rank up! ⬆️', `${RANK_GROUPS[u.g].name} is now ${RANKS[u.idx].n}`, 'rank-' + u.g);
  if (sessionsThisWeek() === +S.profile.daysPerWeek) notify('Weekly goal hit ✅', `${S.profile.daysPerWeek} workouts this week. Great job!`, 'week');
}

/* ================= Notifications ================= */
async function swReg() { try { return 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null; } catch (e) { return null; } }
async function notify(title, body, tag, force) {
  if ((!force && !S.profile?.notifications) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' };
  try {
    const reg = await swReg();
    if (reg) { await reg.showNotification(title, opts); return; }
    new Notification(title, opts);
  } catch (e) { /* ignore */ }
}
async function enableNotifications() {
  if (!('Notification' in window)) {
    toast('This browser can’t show notifications. On iPhone, add the app to your Home Screen first.');
    return false;
  }
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications are blocked in your browser settings'); return false; }
  if (S.profile) { S.profile.notifications = true; save(); }
  registerPeriodicSync();
  return true;
}
async function registerPeriodicSync() {
  const reg = await swReg();
  try {
    if (reg && 'periodicSync' in reg) await reg.periodicSync.register('reprank-reminder', { minInterval: 60 * 60 * 1000 });
  } catch (e) { /* not supported / not installed */ }
}
function reminderDue() {
  const p = S.profile; if (!p || !p.notifications) return false;
  const k = dkey();
  if (S.notified[k]) return false;
  if (S.history.some((h) => h.date === k)) return false;
  const [h, m] = (p.reminderTime || '17:00').split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}
function reminderTick() {
  if (!reminderDue()) return;
  S.notified = { [dkey()]: true };
  save();
  ensureToday();
  notify('Time to train 💪', `Today is ${DAY_TYPES[S.today.dayType].name}. ${S.today.exercises.length} exercises, ~${estMinutes(S.today)} min.`, 'daily');
}
async function pushStateToSW() {
  if (!('caches' in window)) return;
  try {
    const p = S.profile;
    const state = {
      notifications: !!p?.notifications, reminderTime: p?.reminderTime || '17:00',
      notified: S.notified, trainedDays: S.history.slice(0, 3).map((h) => h.date),
      nextName: p ? DAY_TYPES[(S.today && !S.today.finished) ? S.today.dayType : upcomingDayType()].name : '',
    };
    const c = await caches.open('reprank-state');
    await c.put(new URL('./__state', document.baseURI).href, new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) { /* ignore */ }
}

/* ================= Rest timer ================= */
let restInterval = null;
function startRest(sec) {
  ui.restEnd = Date.now() + sec * 1000; ui.restTotal = sec;
  clearInterval(restInterval);
  restInterval = setInterval(tickRest, 250);
  tickRest();
}
function tickRest() {
  const bar = $('#restbar');
  const left = Math.ceil((ui.restEnd - Date.now()) / 1000);
  if (left <= 0) {
    clearInterval(restInterval); bar.hidden = true;
    if (ui.restTotal) {
      ui.restTotal = 0;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (document.hidden) notify('Rest is over ⏱️', 'Time for your next set.', 'rest');
      else toast('Rest over — next set! 💥');
    }
    return;
  }
  bar.hidden = false;
  $('#rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('#rest-fill').style.width = `${100 - (left / ui.restTotal) * 100}%`;
}

/* ================= UI shell ================= */
const ICONS = {
  today: '<svg viewBox="0 0 24 24"><path d="M3 10v4M21 10v4M6 7v10M18 7v10M6 12h12" stroke-width="2.4" stroke-linecap="round"/></svg>',
  progress: '<svg viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 0 1-10 0V4zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4v3h-4z" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  rank: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2.5" stroke-width="1.8"/><path d="M5 9l7-1 7 1M12 8v7M12 15l-3 6M12 15l3 6M9 9l-1 5M15 9l1 5" stroke-width="1.8" stroke-linecap="round"/></svg>',
  body: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4" stroke-width="1.8"/><path d="M8 9a5 5 0 0 1 8 0M12 9l1.5-2" stroke-width="1.8" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const TABS = [['today', 'Today'], ['progress', 'PRs'], ['rank', 'Rank'], ['body', 'Body'], ['settings', 'Settings']];

function render() {
  const view = $('#view');
  if (!S.profile || ui.survey) {
    $('#tabbar').hidden = true;
    if (!ui.survey) startSurvey();
    view.innerHTML = renderSurvey();
  } else {
    $('#tabbar').hidden = false;
    $('#tabbar').innerHTML = TABS.map(([k, n]) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}">${ICONS[k]}<span>${n}</span></button>`).join('');
    const fn = { today: renderToday, progress: renderProgress, rank: renderRank, body: renderBody, settings: renderSettings }[ui.tab];
    view.innerHTML = fn();
  }
  renderModal();
}
function renderModal() {
  const m = $('#modal');
  if (!ui.modal) { m.hidden = true; m.innerHTML = ''; document.body.classList.remove('locked'); return; }
  m.hidden = false; document.body.classList.add('locked');
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="close-x" data-action="close-modal" aria-label="Close">✕</button>${ui.modal}</div>`;
}
function openModal(html) { ui.modal = html; renderModal(); }
function closeModal() { ui.modal = null; renderModal(); }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => (t.hidden = true), 250); }, 2600);
}
function rankBadge(idx, small) {
  if (idx == null) return `<span class="badge ${small ? 'sm' : ''} unranked">Unranked</span>`;
  const r = RANKS[idx];
  return `<span class="badge ${small ? 'sm' : ''}" style="--rc:${r.c}">${r.n}</span>`;
}

/* ================= Today ================= */
function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function renderToday() {
  ensureToday();
  const t = S.today; const dt = DAY_TYPES[t.dayType]; const p = S.profile;
  const wk = sessionsThisWeek(); const goal = +p.daysPerWeek;
  const muscles = [...new Set(t.exercises.map((e) => EX[e.exId].muscle))];
  const split = activeSplit();
  const nextDays = [1, 2, 3].map((i) => DAY_TYPES[split[(S.rotation + (t.finished ? i - 1 : i)) % split.length]].name);
  let h = `
  <header class="hero">
    <div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    <h1>${greet()}, ${esc(p.name || 'athlete')}</h1>
  </header>
  <section class="card daycard">
    <div class="row between top">
      <div><div class="eyebrow">${t.finished ? 'Done today' : 'Today’s workout'}</div><h2>${dt.emoji} ${dt.name}</h2></div>
      ${t.finished ? '' : '<button class="icon-btn" data-action="day-menu" aria-label="Workout options">⋯</button>'}
    </div>
    <div class="chips">${muscles.map((m) => `<span class="chip">${MUSCLE_NAMES[m]}</span>`).join('')}</div>
    <div class="meta">${t.exercises.length} exercises · ~${estMinutes(t)} min · ${GOALS[p.goal]?.name || ''}</div>
    <div class="week">
      <div class="dots">${Array.from({ length: goal }, (_, i) => `<i class="${i < wk ? 'on' : ''}"></i>`).join('')}</div>
      <span>${wk}/${goal} this week${streak() > 1 ? ` · 🔥 ${streak()} streak` : ''}</span>
    </div>
    <div class="upnext">Up next: ${nextDays.join(' → ')}</div>
  </section>`;
  if (t.finished) {
    const last = S.history.find((x) => x.date === t.date);
    h += `<section class="card done-card">
      <div class="big-emoji">✅</div>
      <h3>Workout logged</h3>
      <p class="muted">${last ? `${last.exercises.length} exercises · ${last.exercises.reduce((n, e) => n + e.sets.length, 0)} sets${last.mins ? ` · ${last.mins} min` : ''}` : ''}</p>
      <p>Recover well. Tomorrow is <b>${DAY_TYPES[upcomingDayType()].name}</b>.</p>
      <button class="btn ghost" data-action="bonus">Do another workout anyway</button>
    </section>`;
  } else {
    h += t.exercises.map(exerciseCard).join('');
    h += `<button class="btn primary big block" data-action="finish">Finish workout</button>`;
  }
  return h;
}
function exerciseCard(e, i) {
  const x = EX[e.exId]; const pr = S.prs[e.exId];
  const unitLbl = x.timed ? '' : x.bw ? `+${wu()}` : wu();
  return `<article class="card ex">
    <div class="row between top">
      <div>
        <h3>${x.name}</h3>
        <div class="sub">${MUSCLE_NAMES[x.muscle]} · ${e.sets.length} × ${e.lo}–${e.hi}${x.timed ? 's' : ''} · rest ${e.rest >= 60 ? `${Math.round(e.rest / 6) / 10}m` : `${e.rest}s`}</div>
      </div>
      <button class="icon-btn" data-action="swap" data-i="${i}" aria-label="Swap exercise" title="Swap exercise">⇄</button>
    </div>
    ${e.note ? `<div class="hint">${esc(e.note)}</div>` : ''}
    ${pr ? `<div class="hint pr">PR: ${fmtSet(e.exId, pr.w, pr.r)}${RANK_LIFTS[e.exId] ? ' · counts toward your rank' : ''}</div>` : RANK_LIFTS[e.exId] ? '<div class="hint pr">Counts toward your rank</div>' : ''}
    <div class="sets">
      <div class="set head"><span>Set</span><span>${x.timed ? '' : x.bw ? `Added ${wu()}` : x.equip === 'dumbbell' ? `${wu()} each` : wu()}</span><span>${x.timed ? 'Seconds' : 'Reps'}</span><span></span></div>
      ${e.sets.map((s, j) => `
      <div class="set ${s.done ? 'done' : ''}">
        <span class="n">${s.pr ? '🔥' : j + 1}</span>
        ${x.timed ? '<span></span>' : `<input type="number" inputmode="decimal" step="any" min="0" aria-label="Weight set ${j + 1}" data-field="w" data-i="${i}" data-j="${j}" value="${toDisp(s.w)}" placeholder="${x.bw ? '0' : toDisp(e.sugW) || unitLbl}">`}
        <input type="number" inputmode="numeric" min="0" aria-label="Reps set ${j + 1}" data-field="r" data-i="${i}" data-j="${j}" value="${s.r ?? ''}" placeholder="${e.lo}">
        <button class="check" data-action="check" data-i="${i}" data-j="${j}" aria-label="Complete set ${j + 1}">✓</button>
      </div>`).join('')}
    </div>
    <div class="row gap">
      <button class="link" data-action="add-set" data-i="${i}">+ Add set</button>
      ${e.sets.length > 1 ? `<button class="link muted" data-action="rm-set" data-i="${i}">− Remove set</button>` : ''}
    </div>
  </article>`;
}
function dayMenu() {
  const split = activeSplit();
  const nextType = split[(S.rotation + 1) % split.length];
  openModal(`<h2>Change today’s workout</h2>
    <button class="btn block" data-action="skip-day">Skip to next: ${DAY_TYPES[nextType].emoji} ${DAY_TYPES[nextType].name}</button>
    <button class="btn block" data-action="regen">🎲 New exercises, same muscles</button>
    <h3>Or pick a workout</h3>
    <div class="grid2">${Object.entries(DAY_TYPES).map(([k, d]) => `<button class="btn ${k === S.today.dayType ? 'primary' : ''}" data-action="pick-day" data-day="${k}">${d.emoji} ${d.name}</button>`).join('')}</div>`);
}

/* ================= Progress / PRs ================= */
function renderProgress() {
  const ids = Object.keys(S.prs).sort((a, b) => (S.prs[b].date || '').localeCompare(S.prs[a].date || ''));
  const totalSets = S.history.reduce((n, h) => n + h.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
  return `
  <header class="hero"><div class="eyebrow">Progress</div><h1>Personal Records</h1></header>
  <section class="stats3">
    <div class="stat"><b>${S.history.length}</b><span>workouts</span></div>
    <div class="stat"><b>${ids.length}</b><span>PRs</span></div>
    <div class="stat"><b>${totalSets}</b><span>sets</span></div>
  </section>
  <button class="btn primary block" data-action="add-pr">+ Log a PR</button>
  <section class="card list">
    ${ids.length ? ids.map((id) => {
      const pr = S.prs[id]; const x = EX[id]; if (!x) return '';
      let badge = '';
      if (RANK_LIFTS[id]) badge = rankBadge(rankOf(liftValue(id), thresholds(id)).idx, true);
      const est = !x.bw && !x.timed && pr.r > 1 ? `<span class="muted">est. 1RM ${fmtW(Math.round(e1rm(pr.w, pr.r)))}</span>` : '';
      return `<div class="li">
        <div><b>${x.name}</b><div class="sub">${fmtSet(id, pr.w, pr.r)} ${est}</div></div>
        <div class="right">${badge}<div class="sub">${pr.date ? fmtDate(pr.date) : ''}</div>
        <button class="link muted tiny" data-action="del-pr" data-id="${id}">remove</button></div>
      </div>`;
    }).join('') : '<p class="empty">No PRs yet. Finish a workout or log one above — e.g. your bench max.</p>'}
  </section>
  <h3 class="section-title">Workout history</h3>
  <section class="card list">
    ${S.history.length ? S.history.slice(0, 40).map((h, hi) => `<details class="li-d">
      <summary><div><b>${DAY_TYPES[h.dayType]?.emoji || ''} ${DAY_TYPES[h.dayType]?.name || 'Workout'}</b><div class="sub">${fmtDate(h.date)} · ${h.exercises.length} exercises${h.mins ? ` · ${h.mins} min` : ''}</div></div><span class="chev">›</span></summary>
      <ul class="plain">${h.exercises.map((e) => `<li><b>${EX[e.exId]?.name || e.exId}</b>: ${e.sets.map((s) => fmtSet(e.exId, s.w, s.r)).join(', ')}</li>`).join('')}</ul>
      <button class="link muted tiny" data-action="del-history" data-i="${hi}">delete workout</button>
    </details>`).join('') : '<p class="empty">Your finished workouts show up here.</p>'}
  </section>`;
}
function addPrModal() {
  const groups = {};
  for (const e of Object.values(EX)) (groups[e.muscle] ||= []).push(e);
  openModal(`<h2>Log a PR</h2>
    <label class="field">Exercise
      <select id="pr-ex">${Object.entries(groups).map(([m, list]) => `<optgroup label="${MUSCLE_NAMES[m]}">${list.map((e) => `<option value="${e.id}" ${e.id === 'bench_press' ? 'selected' : ''}>${e.name}${RANK_LIFTS[e.id] ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('')}</select>
    </label>
    <div class="grid2">
      <label class="field">Weight (${wu()}) <input id="pr-w" type="number" inputmode="decimal" step="any" min="0" placeholder="e.g. ${metric() ? 100 : 225}"></label>
      <label class="field">Reps / sec <input id="pr-r" type="number" inputmode="numeric" min="1" value="1"></label>
    </div>
    <p class="muted small">★ = counts toward your muscle rank. Dumbbell lifts: weight of one dumbbell. Bodyweight moves: weight = added weight (0 if none).</p>
    <button class="btn primary block" data-action="save-pr">Save PR</button>`);
}

/* ================= Rank ================= */
function partFill(g, gr) {
  const r = g === 'calves' ? [gr.quads, gr.hams].filter(Boolean).sort((a, b) => b.score - a.score)[0] : gr[g];
  return r ? RANKS[r.idx].c : 'var(--unranked)';
}
function bodySVG(gr) {
  const P = (g, shape) => `<g class="m" data-action="muscle" data-g="${g === 'calves' ? 'quads' : g}" style="fill:${partFill(g, gr)}">${shape}</g>`;
  const neutral = (s) => `<g class="skin">${s}</g>`;
  const mirror = (d) => d.replace(/([ML]|Q|\s)(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (m0, c, x, y) => `${c}${200 - +x} ${y}`);
  const pecL = 'M99 78 L99 116 Q85 122 71 112 Q65 96 71 84 Q84 75 99 78Z';
  const oblL = 'M73 118 Q77 152 80 194 L85 194 L85 120Z';
  const quadL = 'M76 206 Q67 250 76 292 Q86 298 96 292 Q102 252 98 226 L90 212Z';
  const latL = 'M70 84 L98 100 L98 152 Q85 162 77 150 Q69 122 70 84Z';
  const hamL = 'M76 232 Q71 262 77 294 Q86 299 96 294 Q100 264 98 234Z';
  const common = (arms) => neutral(`
      <ellipse cx="100" cy="34" rx="19" ry="23"/>
      <rect x="90" y="54" width="20" height="16" rx="4"/>
      <path d="M68 76 Q100 66 132 76 L135 112 Q128 152 125 202 L75 202 Q72 152 65 112Z"/>
      <path d="M75 200 L125 200 L122 232 L100 240 L78 232Z"/>
      <ellipse cx="44" cy="182" rx="8.5" ry="25" transform="rotate(10 44 182)"/>
      <ellipse cx="156" cy="182" rx="8.5" ry="25" transform="rotate(-10 156 182)"/>
      <circle cx="37" cy="215" r="8"/><circle cx="163" cy="215" r="8"/>
      <ellipse cx="86" cy="302" rx="10" ry="9"/><ellipse cx="114" cy="302" rx="10" ry="9"/>
      <ellipse cx="84" cy="404" rx="11" ry="7"/><ellipse cx="116" cy="404" rx="11" ry="7"/>
      <path d="M77 300 Q74 350 79 396 L90 396 Q95 350 94 300Z"/><path d="M123 300 Q126 350 121 396 L110 396 Q105 350 106 300Z"/>`) +
    P('shoulders', '<ellipse cx="64" cy="89" rx="15" ry="13"/><ellipse cx="136" cy="89" rx="15" ry="13"/>') +
    P(arms, '<ellipse cx="53" cy="129" rx="10" ry="22" transform="rotate(8 53 129)"/><ellipse cx="147" cy="129" rx="10" ry="22" transform="rotate(-8 147 129)"/>');
  const front = common('biceps') +
    P('chest', `<path d="${pecL}"/><path d="${mirror(pecL)}"/>`) +
    P('core', `${[120, 140, 160].map((y) => `<rect x="86.5" y="${y}" width="12.5" height="17" rx="4"/><rect x="101" y="${y}" width="12.5" height="17" rx="4"/>`).join('')}<rect x="88" y="180" width="24" height="16" rx="5"/><path d="${oblL}"/><path d="${mirror(oblL)}"/>`) +
    P('quads', `<path d="${quadL}"/><path d="${mirror(quadL)}"/>`) +
    P('calves', '<ellipse cx="84" cy="345" rx="8" ry="30"/><ellipse cx="116" cy="345" rx="8" ry="30"/>');
  const back = common('triceps') +
    P('back', `<path d="M86 60 L114 60 L133 80 L100 98 L67 80Z"/><path d="${latL}"/><path d="${mirror(latL)}"/><path d="M80 156 Q100 166 120 156 L122 198 L78 198Z"/>`) +
    P('hams', `<ellipse cx="88" cy="215" rx="14" ry="16"/><ellipse cx="112" cy="215" rx="14" ry="16"/><path d="${hamL}"/><path d="${mirror(hamL)}"/>`) +
    P('calves', '<ellipse cx="84" cy="340" rx="11" ry="30"/><ellipse cx="116" cy="340" rx="11" ry="30"/>');
  return `<div class="bodies">
    <figure><svg viewBox="25 0 150 420" role="img" aria-label="Front muscles">${front}</svg><figcaption>Front</figcaption></figure>
    <figure><svg viewBox="25 0 150 420" role="img" aria-label="Back muscles">${back}</svg><figcaption>Back</figcaption></figure>
  </div>`;
}
function renderRank() {
  const gr = groupRanks(); const ov = overallRank(gr);
  return `
  <header class="hero"><div class="eyebrow">Your physique</div><h1>Muscle Ranks</h1></header>
  <section class="card rank-hero" style="--rc:${ov ? RANKS[ov.idx].c : 'var(--unranked)'}">
    <div class="eyebrow">Overall</div>
    <div class="rank-name">${ov ? RANKS[ov.idx].n : 'Unranked'}</div>
    <div class="muted small">${ov ? `${ov.count}/8 muscle groups ranked · based on your PRs vs. bodyweight (${fmtW(Math.round(currentBW()))})` : 'Log PRs for key lifts (bench, squat, deadlift…) to get ranked'}</div>
    ${bodySVG(gr)}
    <div class="legend">${RANKS.map((r) => `<span><i style="background:${r.c}"></i>${r.n}</span>`).join('')}</div>
    <div class="muted tiny center">Tap a muscle for details</div>
  </section>
  <section class="card list">
    ${Object.entries(RANK_GROUPS).map(([g, def]) => {
      const r = gr[g];
      return `<button class="li rank-li" data-action="muscle" data-g="${g}">
        <div class="grow">
          <div class="row between"><b>${def.name}</b>${rankBadge(r ? r.idx : null, true)}</div>
          <div class="bar"><i style="width:${r ? ((r.score) / 8) * 100 : 0}%;background:${r ? RANKS[r.idx].c : 'transparent'}"></i></div>
          <div class="sub">${r ? `Best: ${EX[r.lift].name} ${fmtSet(r.lift, S.prs[r.lift].w, S.prs[r.lift].r)}` : `Log: ${def.lifts.map((l) => EX[l].name).slice(0, 2).join(' or ')}`}</div>
        </div></button>`;
    }).join('')}
  </section>
  <p class="muted tiny center">Ranks use estimated 1-rep max ÷ bodyweight (Epley formula), based on common strength standards${S.profile.sex === 'female' ? ', adjusted for female lifters' : ''}.</p>`;
}
function muscleModal(g) {
  const gr = groupRanks(); const r = gr[g]; const def = RANK_GROUPS[g];
  openModal(`<h2>${def.name}</h2>
    <div class="row gap">${rankBadge(r ? r.idx : null)}${r && r.next != null ? `<span class="muted">${Math.round(r.frac * 100)}% to ${RANKS[r.idx + 1].n}</span>` : ''}</div>
    ${r ? `<p>${nextRankText(r)}</p>` : '<p class="muted">No PR yet for this muscle group.</p>'}
    <h3>Lifts that count</h3>
    <ul class="plain">${def.lifts.map((l) => {
      const pr = S.prs[l];
      const rr = pr ? rankOf(liftValue(l), thresholds(l)) : null;
      return `<li class="row between"><span>${EX[l].name}${pr ? ` — <b>${fmtSet(l, pr.w, pr.r)}</b>` : ''}</span>${rr ? rankBadge(rr.idx, true) : '<span class="muted small">—</span>'}</li>`;
    }).join('')}</ul>
    <h3>Rank ladder (${EX[r ? r.lift : def.lifts[0]].name})</h3>
    <div class="ladder">${(() => {
      const lift = r ? r.lift : def.lifts[0]; const th = thresholds(lift); const L = RANK_LIFTS[lift];
      return RANKS.slice(1).map((rk, i) => `<div><i style="background:${rk.c}"></i>${rk.n}<span>${L.type === 'ratio' ? `${fmtW(roundToInc(th[i] * currentBW(), metric() ? 2.5 : 5))} 1RM` : `${Math.ceil(th[i])} reps`}</span></div>`).join('');
    })()}</div>
    <button class="btn primary block" data-action="add-pr">+ Log a PR</button>`);
}

/* ================= Body ================= */
function renderBody() {
  const p = S.profile; const bw = currentBW();
  const bmi = p.heightIn ? (703 * bw) / (p.heightIn * p.heightIn) : null;
  const first = S.weights[0]?.lbs; const delta = first != null ? bw - first : 0;
  const bmiCat = bmi == null ? '' : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  return `
  <header class="hero"><div class="eyebrow">Body</div><h1>Weight & Height</h1></header>
  <section class="stats3">
    <div class="stat"><b>${toDisp(Math.round(bw * 10) / 10)}</b><span>${wu()} now</span></div>
    <div class="stat"><b>${fmtHeight(p.heightIn)}</b><span>height</span></div>
    <div class="stat"><b>${bmi ? bmi.toFixed(1) : '—'}</b><span>BMI${bmiCat ? ' · ' + bmiCat : ''}</span></div>
  </section>
  <section class="card">
    <div class="row between"><h3>Weight trend</h3>${S.weights.length > 1 ? `<span class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${toDisp(Math.round(delta * 10) / 10)} ${wu()}</span>` : ''}</div>
    ${weightChart()}
    <div class="row gap">
      <input id="bw-in" type="number" inputmode="decimal" step="any" min="0" placeholder="Today’s weight (${wu()})" class="grow">
      <button class="btn primary" data-action="log-bw">Log</button>
    </div>
  </section>
  <section class="card">
    <h3>Height</h3>
    <div class="row gap">
      ${metric() ? `<input id="h-cm" type="number" inputmode="numeric" placeholder="cm" value="${p.heightIn ? Math.round(p.heightIn * 2.54) : ''}" class="grow">`
        : `<input id="h-ft" type="number" inputmode="numeric" placeholder="ft" value="${p.heightIn ? Math.floor(p.heightIn / 12) : ''}" class="grow"><input id="h-in" type="number" inputmode="numeric" placeholder="in" value="${p.heightIn ? Math.round(p.heightIn % 12) : ''}" class="grow">`}
      <button class="btn" data-action="save-height">Save</button>
    </div>
  </section>
  <section class="card list">
    <h3>Weigh-ins</h3>
    ${S.weights.length ? S.weights.slice().reverse().slice(0, 30).map((w) => `<div class="li"><span>${fmtDate(w.date)}</span><span>${fmtW(Math.round(w.lbs * 10) / 10)} <button class="link muted tiny" data-action="del-bw" data-date="${w.date}">✕</button></span></div>`).join('') : '<p class="empty">No weigh-ins yet.</p>'}
  </section>`;
}
function weightChart() {
  const pts = S.weights.slice(-60);
  if (pts.length < 2) return '<p class="empty">Log your weight on a couple of days to see a trend line.</p>';
  const W = 320, H = 140, pad = 24;
  const xs = pts.map((p) => parseKey(p.date).getTime()); const ys = pts.map((p) => toDisp(p.lbs));
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 2) { y0 -= 1; y1 += 1; }
  const X = (x) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - pad * 2);
  const Y = (y) => H - pad - ((y - y0) / (y1 - y0)) * (H - pad * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join(' ');
  const area = `${d} L${X(xs[xs.length - 1]).toFixed(1)} ${H - pad} L${X(xs[0]).toFixed(1)} ${H - pad}Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time">
    <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad}" x2="${W - pad}" y1="${Y(y1)}" y2="${Y(y1)}" class="grid"/><line x1="${pad}" x2="${W - pad}" y1="${Y(y0)}" y2="${Y(y0)}" class="grid"/>
    <text x="2" y="${Y(y1) + 4}" class="axis">${Math.round(y1)}</text><text x="2" y="${Y(y0) + 4}" class="axis">${Math.round(y0)}</text>
    <path d="${area}" fill="url(#wg)"/><path d="${d}" class="line"/>
    ${pts.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3" class="pt"/>`).join('')}
    <text x="${pad}" y="${H - 6}" class="axis">${fmtDate(pts[0].date)}</text><text x="${W - pad}" y="${H - 6}" class="axis" text-anchor="end">${fmtDate(pts[pts.length - 1].date)}</text>
  </svg>`;
}
function logWeight(lbs) {
  const k = dkey();
  S.weights = S.weights.filter((w) => w.date !== k);
  S.weights.push({ date: k, lbs });
  S.weights.sort((a, b) => a.date.localeCompare(b.date));
  S.profile.weightLbs = S.weights[S.weights.length - 1].lbs;
}

/* ================= Settings ================= */
function renderSettings() {
  const p = S.profile;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const recKey = recommendSplit(p);
  return `
  <header class="hero"><div class="eyebrow">Settings</div><h1>Your plan</h1></header>
  <section class="card">
    <div class="li"><span>Goal</span><b>${GOALS[p.goal]?.name}</b></div>
    <div class="li"><span>Experience</span><b>${cap(p.experience)}</b></div>
    <div class="li"><span>Days / week</span><b>${p.daysPerWeek}</b></div>
    <div class="li"><span>Session length</span><b>${p.sessionMin} min</b></div>
    <div class="li"><span>Equipment</span><b>${EQUIPMENT[p.equipment]?.name}</b></div>
    <div class="li"><span>Focus</span><b>${(p.focus || []).map((f) => FOCUS[f].name).join(', ') || 'Balanced'}</b></div>
    <div class="li"><span>Injuries</span><b>${(p.injuries || []).map((f) => INJURIES[f]).join(', ') || 'None'}</b></div>
    <button class="btn block" data-action="retake">📝 Retake the survey</button>
  </section>
  <section class="card">
    <h3>Workout split</h3>
    <p class="muted small">What you train each day, in rotation. Recommended for you: <b>${SPLITS[recKey].name}</b>.</p>
    <select data-setting="split">
      <option value="auto" ${!p.split || p.split === 'auto' ? 'selected' : ''}>Auto (${SPLITS[recKey].name})</option>
      ${Object.entries(SPLITS).map(([k, s]) => `<option value="${k}" ${p.split === k ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
    <div class="chips">${activeSplit().map((d, i) => `<span class="chip ${i === S.rotation % activeSplit().length ? 'on' : ''}">${DAY_TYPES[d].emoji} ${DAY_TYPES[d].name}</span>`).join('<span class="arrow">→</span>')}</div>
  </section>
  <section class="card">
    <h3>Notifications</h3>
    <p class="muted small">Daily workout reminder, PRs, rank-ups, rest timer. Status: <b>${perm === 'granted' && p.notifications ? 'On' : perm === 'denied' ? 'Blocked in browser' : perm === 'unsupported' ? 'Not supported here' : 'Off'}</b></p>
    <div class="row gap">
      <label class="field grow">Daily reminder<input type="time" data-setting="reminderTime" value="${p.reminderTime || '17:00'}"></label>
    </div>
    <div class="row gap">
      ${p.notifications && perm === 'granted' ? '<button class="btn" data-action="notif-off">Turn off</button>' : '<button class="btn primary" data-action="notif-on">🔔 Turn on notifications</button>'}
      <button class="btn ghost" data-action="notif-test">Send test</button>
    </div>
    <p class="muted tiny">Tip: install the app (Share → “Add to Home Screen” on iPhone, or ⋮ → “Install app” on Android) so reminders can arrive even when the app is closed.</p>
  </section>
  <section class="card">
    <h3>Units</h3>
    <div class="seg">
      <button class="${!metric() ? 'on' : ''}" data-action="units" data-u="imperial">lb / ft</button>
      <button class="${metric() ? 'on' : ''}" data-action="units" data-u="metric">kg / cm</button>
    </div>
  </section>
  <section class="card">
    <h3>Your data</h3>
    <p class="muted small">Everything is stored on this device only. Back it up to move phones.</p>
    <div class="row gap wrap">
      <button class="btn" data-action="export">⬇️ Export backup</button>
      <label class="btn">⬆️ Import backup<input type="file" accept="application/json" id="import-file" hidden></label>
      <button class="btn danger" data-action="reset">Reset everything</button>
    </div>
  </section>
  <p class="muted tiny center">RepRank · works offline</p>`;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/* ================= Survey ================= */
function startSurvey() {
  const p = S.profile || {};
  ui.survey = {
    name: p.name || '', sex: p.sex || '', age: p.age || '', units: p.units || 'imperial',
    heightIn: p.heightIn || '', weightLbs: p.weightLbs || (S.weights.length ? currentBW() : ''),
    goal: p.goal || '', experience: p.experience || '', daysPerWeek: p.daysPerWeek || 4, sessionMin: p.sessionMin || 60,
    equipment: p.equipment || '', focus: [...(p.focus || [])], injuries: [...(p.injuries || [])],
    lifts: { bench_press: {}, squat: {}, deadlift: {}, ohp: {} },
    reminderTime: p.reminderTime || '17:00', notifications: !!p.notifications,
  };
  ui.step = 0;
}
const sv = () => ui.survey;
const svMetric = () => sv().units === 'metric';
const svW = (lbs) => (lbs === '' || lbs == null ? '' : Math.round((svMetric() ? lbs / LB_PER_KG : lbs) * 10) / 10);
const choice = (field, val, title, desc, multi) => {
  const on = multi ? sv()[field].includes(val) : String(sv()[field]) === String(val);
  return `<button class="choice ${on ? 'on' : ''}" data-action="${multi ? 'sv-toggle' : 'sv-pick'}" data-field="${field}" data-value="${val}"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</button>`;
};
const STEPS = [
  { title: 'Welcome to RepRank 💪', sub: 'Answer a few quick questions and we’ll build your training plan.', ok: () => true,
    body: () => `<label class="field">What should we call you?<input data-sv="name" value="${esc(sv().name)}" placeholder="Your name" autocomplete="given-name"></label>` },
  { title: 'About you', sub: 'Used to compare your lifts to strength standards.', ok: () => sv().sex && sv().age,
    body: () => `<div class="grid2">${choice('sex', 'male', 'Male')}${choice('sex', 'female', 'Female')}</div>
      <label class="field">Age<input data-sv="age" type="number" inputmode="numeric" min="10" max="100" value="${sv().age}" placeholder="e.g. 22"></label>
      <div class="field">Units</div><div class="seg">
        <button class="${!svMetric() ? 'on' : ''}" data-action="sv-pick" data-field="units" data-value="imperial">lb / ft</button>
        <button class="${svMetric() ? 'on' : ''}" data-action="sv-pick" data-field="units" data-value="metric">kg / cm</button></div>` },
  { title: 'Height & weight', sub: 'Your weight is used for ranks and tracked over time.', ok: () => sv().heightIn > 0 && sv().weightLbs > 0,
    body: () => `${svMetric()
      ? `<label class="field">Height (cm)<input data-sv="heightCm" type="number" inputmode="numeric" value="${sv().heightIn ? Math.round(sv().heightIn * 2.54) : ''}" placeholder="e.g. 180"></label>`
      : `<div class="grid2"><label class="field">Feet<input data-sv="heightFt" type="number" inputmode="numeric" value="${sv().heightIn ? Math.floor(sv().heightIn / 12) : ''}" placeholder="5"></label>
         <label class="field">Inches<input data-sv="heightInch" type="number" inputmode="numeric" value="${sv().heightIn ? Math.round(sv().heightIn % 12) : ''}" placeholder="10"></label></div>`}
      <label class="field">Weight (${svMetric() ? 'kg' : 'lb'})<input data-sv="weight" type="number" inputmode="decimal" step="any" value="${svW(sv().weightLbs)}" placeholder="${svMetric() ? 'e.g. 80' : 'e.g. 180'}"></label>` },
  { title: 'What’s your main goal?', sub: 'This sets your sets, reps and rest times.', ok: () => sv().goal,
    body: () => Object.entries(GOALS).map(([k, g]) => choice('goal', k, g.name, g.desc)).join('') },
  { title: 'How experienced are you?', sub: '', ok: () => sv().experience,
    body: () => choice('experience', 'beginner', 'Beginner', 'Less than 6 months of consistent lifting') +
      choice('experience', 'intermediate', 'Intermediate', '6 months – 2 years') +
      choice('experience', 'advanced', 'Advanced', '2+ years, know your way around a barbell') },
  { title: 'Your schedule', sub: 'How often and how long can you train?', ok: () => true,
    body: () => `<div class="field">Days per week</div><div class="seg wrap">${[2, 3, 4, 5, 6, 7].map((d) => `<button class="${+sv().daysPerWeek === d ? 'on' : ''}" data-action="sv-pick" data-field="daysPerWeek" data-value="${d}">${d}</button>`).join('')}</div>
      <div class="field">Minutes per workout</div><div class="seg wrap">${[30, 45, 60, 90].map((d) => `<button class="${+sv().sessionMin === d ? 'on' : ''}" data-action="sv-pick" data-field="sessionMin" data-value="${d}">${d}</button>`).join('')}</div>
      <p class="muted small">Your split: <b>${SPLITS[recommendSplit(sv())].name}</b> — ${SPLITS[recommendSplit(sv())].days.map((d) => DAY_TYPES[d].name).join(' → ')}</p>` },
  { title: 'Where do you train?', sub: 'We’ll only pick exercises you can do.', ok: () => sv().equipment,
    body: () => Object.entries(EQUIPMENT).map(([k, e]) => choice('equipment', k, e.name, e.desc)).join('') },
  { title: 'Anything to focus on?', sub: 'Optional — we’ll add extra work for these. Pick any.', ok: () => true,
    body: () => `<div class="grid2">${Object.entries(FOCUS).map(([k, f]) => choice('focus', k, f.name, '', true)).join('')}</div>` },
  { title: 'Any injuries or pain?', sub: 'We’ll skip exercises that stress these areas.', ok: () => true,
    body: () => `<div class="grid2">${Object.entries(INJURIES).map(([k, n]) => choice('injuries', k, n, '', true)).join('')}</div><p class="muted small">Leave blank if none.</p>` },
  { title: 'Your current lifts', sub: 'Optional — enter your best set to get ranked right away. Skip any you don’t know.', ok: () => true,
    body: () => ['bench_press', 'squat', 'deadlift', 'ohp'].map((id) => `<div class="lift-row"><b>${EX[id].name}</b>
      <input data-svlift="${id}" data-k="w" type="number" inputmode="decimal" step="any" placeholder="${svMetric() ? 'kg' : 'lb'}" value="${svW(sv().lifts[id].w)}">
      <span class="x">×</span><input data-svlift="${id}" data-k="r" type="number" inputmode="numeric" placeholder="reps" value="${sv().lifts[id].r || ''}"></div>`).join('') },
  { title: 'Stay on track 🔔', sub: 'Get a daily reminder with your workout, plus alerts for PRs and rank-ups.', ok: () => true,
    body: () => `<label class="field">Remind me at<input data-sv="reminderTime" type="time" value="${sv().reminderTime}"></label>
      <button class="btn ${sv().notifications ? '' : 'primary'} block" data-action="sv-notif">${sv().notifications ? '✅ Notifications on' : 'Turn on notifications'}</button>
      <p class="muted small">On iPhone, add RepRank to your Home Screen (Share → Add to Home Screen) to allow notifications.</p>` },
];
function renderSurvey() {
  const st = STEPS[ui.step]; const last = ui.step === STEPS.length - 1;
  return `<div class="survey">
    <div class="progress"><i style="width:${((ui.step + 1) / STEPS.length) * 100}%"></i></div>
    <div class="row between"><button class="link ${ui.step ? '' : 'invisible'}" data-action="sv-back">‹ Back</button><span class="muted small">${ui.step + 1} / ${STEPS.length}</span>
      ${S.profile ? '<button class="link muted" data-action="sv-cancel">Cancel</button>' : '<span></span>'}</div>
    <h1>${st.title}</h1>${st.sub ? `<p class="muted">${st.sub}</p>` : ''}
    <div class="survey-body">${st.body()}</div>
    <button class="btn primary big block" data-action="sv-next" ${st.ok() ? '' : 'disabled'}>${last ? 'Build my plan 🚀' : 'Continue'}</button>
  </div>`;
}
function finishSurvey() {
  const d = sv(); const first = !S.profile;
  const p = {
    name: d.name.trim(), sex: d.sex, age: +d.age, units: d.units, heightIn: +d.heightIn, weightLbs: +d.weightLbs,
    goal: d.goal, experience: d.experience, daysPerWeek: +d.daysPerWeek, sessionMin: +d.sessionMin,
    equipment: d.equipment, focus: d.focus, injuries: d.injuries, reminderTime: d.reminderTime,
    notifications: d.notifications, split: S.profile?.split || 'auto',
  };
  S.profile = p;
  if (!S.weights.length || Math.abs(currentBW() - p.weightLbs) > 0.05) logWeight(p.weightLbs);
  for (const [id, l] of Object.entries(d.lifts)) {
    if (+l.w > 0 && +l.r > 0) commitPRs(id, [{ w: +l.w, r: +l.r }], dkey());
  }
  if (first) S.rotation = 0;
  // regenerate today unless sets already logged
  if (!S.today || S.today.finished || !S.today.exercises.some((e) => e.sets.some((s) => s.done))) { S.today = null; ensureToday(); }
  ui.survey = null; ui.tab = 'today';
  save();
  render();
  const split = SPLITS[activeSplitKey()]; const ov = overallRank(groupRanks());
  openModal(`<div class="center"><div class="big-emoji">🚀</div><h2>Your plan is ready${p.name ? ', ' + esc(p.name) : ''}!</h2></div>
    <p><b>${split.name}</b>, ${p.daysPerWeek}× per week, ~${p.sessionMin} min:</p>
    <div class="chips">${split.days.map((x) => `<span class="chip">${DAY_TYPES[x].emoji} ${DAY_TYPES[x].name}</span>`).join('')}</div>
    <p class="muted">Each time you finish a workout, the next day in the rotation is up. Today: <b>${DAY_TYPES[S.today.dayType].name}</b>.</p>
    ${ov ? `<p>Starting overall rank: ${rankBadge(ov.idx, true)} — check the Rank tab.</p>` : '<p class="muted">Log PRs to unlock your muscle ranks.</p>'}
    <button class="btn primary block" data-action="close-modal">Let’s go</button>`);
}

/* ================= Events ================= */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
  const a = el.dataset.action; const i = +el.dataset.i; const j = +el.dataset.j;
  const t = S.today;
  switch (a) {
    case 'tab': ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); break;
    case 'close-modal': closeModal(); break;
    // --- today
    case 'check': {
      const e = t.exercises[i]; const s = e.sets[j]; const x = EX[e.exId];
      if (s.done) { s.done = false; s.pr = false; save(); render(); break; }
      if (s.w == null) { const prev = e.sets.slice(0, j).reverse().find((o) => o.done && o.w > 0); s.w = x.bw ? 0 : (e.sugW ?? prev?.w ?? 0); }
      if (s.r == null || s.r === '') s.r = e.lo;
      if (!x.bw && !x.timed && !(s.w > 0)) { toast('Enter the weight you used'); break; }
      s.done = true; t.started ||= Date.now();
      const sc = setScore(e.exId, s.w, s.r);
      const bestToday = Math.max(0, ...e.sets.filter((o, k) => k !== j && o.done).map((o) => setScore(e.exId, o.w, o.r)));
      s.pr = sc > prScore(e.exId) + 0.01 && sc > bestToday;
      if (s.pr) toast(`🔥 New PR on ${x.name}!`);
      save(); render();
      if (e.sets.some((o) => !o.done) || t.exercises.some((o) => o.sets.some((q) => !q.done))) startRest(e.rest);
      break;
    }
    case 'add-set': { const e = t.exercises[i]; const lastS = e.sets[e.sets.length - 1]; e.sets.push({ w: lastS?.w ?? null, r: null, done: false }); save(); render(); break; }
    case 'rm-set': t.exercises[i].sets.pop(); save(); render(); break;
    case 'swap': {
      const e = t.exercises[i]; const m = EX[e.exId].muscle;
      const pool = availableFor(m).filter((x) => !t.exercises.some((o) => o.exId === x.id));
      if (!pool.length) { toast('No other exercises available for this muscle'); break; }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      t.exercises[i] = makeEntry(pick.id); save(); render(); break;
    }
    case 'finish': finishWorkout(false); render(); break;
    case 'day-menu': dayMenu(); break;
    case 'skip-day': S.rotation += 1; newToday(upcomingDayType()); save(); closeModal(); render(); toast(`Switched to ${DAY_TYPES[S.today.dayType].name}`); break;
    case 'regen': S.today.exercises = genWorkout(t.dayType, Math.random()); save(); closeModal(); render(); break;
    case 'pick-day': newToday(el.dataset.day); save(); closeModal(); render(); break;
    case 'bonus': newToday(upcomingDayType()); save(); render(); break;
    // --- PRs
    case 'add-pr': addPrModal(); break;
    case 'save-pr': {
      const id = $('#pr-ex').value; const x = EX[id];
      const w = x.timed ? 0 : (fromDisp($('#pr-w').value) || 0); const r = parseInt($('#pr-r').value, 10);
      if (!(r > 0) || (!x.bw && !x.timed && !(w > 0))) { toast('Enter weight and reps'); break; }
      const before = groupRanks();
      const res = commitPRs(id, [{ w, r }], dkey());
      if (!res) { toast(`That doesn’t beat your current PR (${fmtSet(id, S.prs[id].w, S.prs[id].r)})`); break; }
      const after = groupRanks();
      save(); closeModal(); render();
      const up = Object.keys(after).find((g) => after[g] && (!before[g] || after[g].idx > before[g].idx));
      toast(up ? `PR saved! ${RANK_GROUPS[up].name} → ${RANKS[after[up].idx].n} ⬆️` : 'PR saved 🔥');
      if (up) notify('Rank up! ⬆️', `${RANK_GROUPS[up].name} is now ${RANKS[after[up].idx].n}`, 'rank-' + up);
      break;
    }
    case 'del-pr': if (confirm(`Remove PR for ${EX[el.dataset.id].name}?`)) { delete S.prs[el.dataset.id]; save(); render(); } break;
    case 'del-history': if (confirm('Delete this workout from history?')) { S.history.splice(i, 1); save(); render(); } break;
    // --- rank
    case 'muscle': muscleModal(el.dataset.g); break;
    // --- body
    case 'log-bw': {
      const v = fromDisp($('#bw-in').value);
      if (!(v > 0)) { toast('Enter your weight'); break; }
      logWeight(v); save(); render(); toast('Weight logged'); break;
    }
    case 'del-bw': S.weights = S.weights.filter((w) => w.date !== el.dataset.date); save(); render(); break;
    case 'save-height': {
      const h = metric() ? (+$('#h-cm').value) / 2.54 : (+$('#h-ft').value) * 12 + (+$('#h-in').value || 0);
      if (!(h > 30)) { toast('Enter a valid height'); break; }
      S.profile.heightIn = h; save(); render(); toast('Height saved'); break;
    }
    // --- settings
    case 'retake': startSurvey(); render(); window.scrollTo(0, 0); break;
    case 'units': S.profile.units = el.dataset.u; save(); render(); break;
    case 'notif-on': if (await enableNotifications()) { notify('Notifications on 🔔', `We’ll remind you at ${S.profile.reminderTime || '17:00'} each day.`, 'test'); render(); } break;
    case 'notif-off': S.profile.notifications = false; save(); render(); break;
    case 'notif-test':
      if (await enableNotifications()) { notify('RepRank 💪', `Test notification. Today: ${DAY_TYPES[S.today?.dayType || upcomingDayType()].name}.`, 'test', true); render(); }
      break;
    case 'export': {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const aEl = document.createElement('a'); aEl.href = URL.createObjectURL(blob); aEl.download = `reprank-backup-${dkey()}.json`; aEl.click();
      setTimeout(() => URL.revokeObjectURL(aEl.href), 1000);
      break;
    }
    case 'reset':
      if (confirm('Delete ALL your data (workouts, PRs, weight)? This cannot be undone.')) { S = defaultState(); save(); ui.survey = null; render(); }
      break;
    // --- survey
    case 'sv-pick': {
      const f = el.dataset.field; let v = el.dataset.value;
      if (f === 'daysPerWeek' || f === 'sessionMin') v = +v;
      sv()[f] = v; render(); break;
    }
    case 'sv-toggle': { const arr = sv()[el.dataset.field]; const v = el.dataset.value; const k = arr.indexOf(v); k >= 0 ? arr.splice(k, 1) : arr.push(v); render(); break; }
    case 'sv-back': ui.step = Math.max(0, ui.step - 1); render(); break;
    case 'sv-cancel': ui.survey = null; render(); break;
    case 'sv-next': if (ui.step < STEPS.length - 1) { ui.step++; render(); window.scrollTo(0, 0); } else finishSurvey(); break;
    case 'sv-notif': {
      if (!('Notification' in window)) { toast('Notifications aren’t available here. On iPhone, add to Home Screen first.'); break; }
      const perm = await Notification.requestPermission();
      sv().notifications = perm === 'granted';
      if (perm !== 'granted') toast('Notifications were not allowed'); else registerPeriodicSync();
      render(); break;
    }
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.field && S.today) {
    const s = S.today.exercises[+el.dataset.i].sets[+el.dataset.j];
    if (el.dataset.field === 'w') s.w = el.value === '' ? null : fromDisp(el.value);
    else s.r = el.value === '' ? null : parseInt(el.value, 10);
    save();
  } else if (el.dataset.sv) {
    const d = sv(); const k = el.dataset.sv; const v = el.value;
    const m = svMetric() ? LB_PER_KG : 1;
    if (k === 'heightCm') d.heightIn = v ? +v / 2.54 : '';
    else if (k === 'heightFt' || k === 'heightInch') {
      const ft = +($('[data-sv="heightFt"]').value || 0); const inch = +($('[data-sv="heightInch"]').value || 0);
      d.heightIn = ft * 12 + inch || '';
    } else if (k === 'weight') d.weightLbs = v ? +v * m : '';
    else d[k] = v;
    const btn = $('[data-action="sv-next"]'); if (btn) btn.disabled = !STEPS[ui.step].ok();
  } else if (el.dataset.svlift) {
    const l = sv().lifts[el.dataset.svlift];
    if (el.dataset.k === 'w') l.w = el.value ? +el.value * (svMetric() ? LB_PER_KG : 1) : '';
    else l.r = el.value ? +el.value : '';
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.setting) {
    S.profile[el.dataset.setting] = el.value;
    if (el.dataset.setting === 'split') {
      S.rotation = 0;
      if (S.today && !S.today.finished && !S.today.exercises.some((e) => e.sets.some((s) => s.done))) newToday(upcomingDayType());
    }
    if (el.dataset.setting === 'reminderTime') S.notified = {};
    save(); render(); toast('Saved');
  } else if (el.id === 'import-file' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object' || !('prs' in data)) throw new Error('bad');
        S = Object.assign(defaultState(), data); save(); render(); toast('Backup imported');
      } catch (e) { toast('That file isn’t a RepRank backup'); }
    };
    r.readAsText(el.files[0]);
  }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ui.modal) closeModal(); });

$('#rest-skip').addEventListener('click', () => { ui.restTotal = 0; ui.restEnd = 0; tickRest(); });
$('#rest-add').addEventListener('click', () => { ui.restEnd += 15000; ui.restTotal += 15; tickRest(); });

/* ================= Boot ================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => { pushStateToSW(); if (S.profile?.notifications) registerPeriodicSync(); }).catch(() => {});
  });
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.profile) {
    const before = S.today?.date; ensureToday();
    if (before !== S.today?.date) render();
    reminderTick();
  }
});
setInterval(reminderTick, 30000);
render();
reminderTick();
