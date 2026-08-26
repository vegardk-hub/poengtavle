const KEY = 'poengtavle-v1';
/* Bumpes for hånd ved hver endring som pushes, sammen med CACHE i sw.js.
   Vises i toppen av appen, slik at det er lett å se om telefonen faktisk
   har hentet siste versjon. */
const APP_VERSION = 'v9';
const DAY_LABELS = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const EMOJIS = ['⭐', '😴', '🛁', '🛏️', '🍽️', '🗑️', '🧸', '🐕', '👕', '🪴', '🦷', '📚', '🎒', '🧹', '🚲', '🍎', '✏️', '🧦', '🚿', '🧺', '🥣', '🎹'];
/* Radfargene følger radnummeret, ikke barnet. Vetle og Live skal se nøyaktig
   det samme brettet — de sammenligner, og en forskjell i farge blir en sak. */
const ROWS = [
  { bg: '#fff1c9', line: '#eaa800', ink: '#7d5200' },
  { bg: '#dcf3d2', line: '#4faf4f', ink: '#245d1e' },
  { bg: '#d9ecff', line: '#3d97e8', ink: '#0f4a80' },
  { bg: '#ffdde9', line: '#ea6b98', ink: '#8c2a4c' },
  { bg: '#e7ddff', line: '#8b6be0', ink: '#452a85' },
  { bg: '#ffe0cc', line: '#ef7f3c', ink: '#8c3d0d' },
  { bg: '#cdf2ed', line: '#2fb5a3', ink: '#0d5c53' }
];
const SPARKS = ['⭐', '🌟', '✨', '🎉', '💫', '🎊'];
const QUICK_AMOUNTS = [10, 20, 50, 100];

const SMILEY = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.8" cy="10" r="1.3" fill="currentColor"/><circle cx="15.2" cy="10" r="1.3" fill="currentColor"/><path d="M7.6 14.2c1.1 1.7 2.6 2.5 4.4 2.5s3.3-.8 4.4-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

let S = null;
let ui = { view: 'home', childId: null, weekOffset: 0, tab: 'tasks', tasksChildId: null, payChildId: null, newEmoji: '⭐', popCell: null, amount: null, animateFrom: null, celebrate: false };

/* ---------- lagring ---------- */

/* Rekkefølgen er bevisst: hyppige, små gjøremål øverst, sjeldnere og større
   nederst. Alle oppgaver gjelder begge barna likt (kids: null), i samme
   rekkefølge — V og L skal se nøyaktig samme liste. */
function defaultTasks() {
  const t = (emoji, name, price) => ({ id: uid(), emoji, name, price, kids: null, week: null, archived: false });
  const multi = (emoji, name) => ({ id: uid(), emoji, name, price: null, kids: null, week: null, archived: false, multi: true });
  return [
    t('🪮', 'Børste håret', 5),
    t('😴', 'Sove i egen seng', 20),
    t('🛏️', 'Ha ryddig rom', 10),
    t('🍽️', 'Tømme oppvaskmaskinen', 10),
    t('🗑️', 'Gå ut med søpla', 5),
    t('🍳', 'Hjelpe til med middag', 20),
    t('🛒', 'Handle i butikken', 20),
    multi('🔑', 'Passe seg selv'),
    multi('🙋', 'Hjelpe foreldre med noe')
  ];
}

/* Hvert tidligere standardoppsett listes her, slik at migrate() kan bytte
   noen til det nyeste automatisk — men bare når ingenting er registrert ennå. */
const KNOWN_DEFAULT_TASK_NAME_SETS = [
  ['Sove i egen seng', 'Vaske badet', 'Rydde rommet', 'Tømme oppvaskmaskinen', 'Gå ut med søpla', 'Leke med L', 'Hjelpe pappa med noe'],
  ['Børste håret', 'Sove i egen seng', 'Ha ryddig rom', 'Tømme oppvaskmaskinen', 'Gå ut med søpla', 'Hjelpe foreldre å rydde', 'Hjelpe til med middag', 'Handle i butikken', 'Hjelpe foreldre med noe']
].map(names => names.sort().join('|'));

function defaults() {
  return {
    version: 3,
    lastBackup: null,
    sound: true,
    children: [
      { id: 'c1', name: 'V', emoji: '🤖' },
      { id: 'c2', name: 'L', emoji: '🧸' }
    ],
    tasks: defaultTasks(),
    events: [],
    payouts: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    S = raw ? migrate(JSON.parse(raw)) : defaults();
  } catch (e) {
    S = defaults();
  }
}

/* Eldre versjoner hadde PIN + en egen godkjenningsrunde (status pending/approved).
   Ferdige oppgaver blir stående som gjort; uferdige uten avklart beløp forsvinner,
   siden det ikke lenger finnes noe sted å avklare dem. */
function migrate(s) {
  if (Array.isArray(s.events)) {
    s.events = s.events
      .filter(e => e.status !== 'pending' || typeof e.amount === 'number')
      .map(({ status, seen, approvedAt, ...rest }) => rest);
  }
  delete s.pin;
  /* Byttet ut den gamle standard-oppgavelisten med en ny. Bare trygt å bytte
     automatisk når ingenting er registrert ennå — ellers lar vi det stå, og
     en voksen får rydde manuelt under ⚙️ Rediger → Oppgaver. */
  if (Array.isArray(s.tasks) && (!s.events || !s.events.length)) {
    const names = s.tasks.filter(t => !t.archived).map(t => t.name).sort().join('|');
    if (KNOWN_DEFAULT_TASK_NAME_SETS.indexOf(names) >= 0) s.tasks = defaultTasks();
  }
  return s;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    toast('Fikk ikke lagret — er lagringen full?');
  }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

/* ---------- dato ---------- */

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseIso(s) { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function weekDates(offset) {
  const m = mondayOf(new Date());
  m.setDate(m.getDate() + offset * 7);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(m);
    d.setDate(m.getDate() + i);
    out.push(d);
  }
  return out;
}

function weekNumber(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
  const jan4 = new Date(x.getFullYear(), 0, 4);
  return 1 + Math.round(((x - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function longDate(s) {
  const d = parseIso(s);
  return d.getDate() + '. ' + MONTHS[d.getMonth()];
}

function dayName(s) {
  const full = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
  return full[(parseIso(s).getDay() + 6) % 7];
}

function daysSince(s) {
  if (!s) return Infinity;
  return Math.round((new Date() - parseIso(s)) / 86400000);
}

/* ---------- oppslag ---------- */

function child(id) { return S.children.find(c => c.id === id); }
function task(id) { return S.tasks.find(t => t.id === id); }

function tasksFor(childId, weekKey) {
  return S.tasks.filter(t =>
    !t.archived &&
    (!t.kids || t.kids.indexOf(childId) >= 0) &&
    (!t.week || t.week === weekKey)
  );
}

function eventAt(childId, taskId, date) {
  return S.events.find(e => e.childId === childId && e.taskId === taskId && e.date === date);
}

function balance(childId) {
  const earned = S.events.filter(e => e.childId === childId).reduce((s, e) => s + (e.amount || 0), 0);
  const paid = S.payouts.filter(p => p.childId === childId).reduce((s, p) => s + p.amount, 0);
  return earned - paid;
}

function earnedBetween(childId, from, to) {
  return S.events.filter(e => e.childId === childId && e.date >= from && e.date <= to)
    .reduce((s, e) => s + (e.amount || 0), 0);
}

function kr(n) { return Math.round(n).toLocaleString('nb-NO') + ' kr'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
/* navn lagres slik de skrives; barnesidene roper dem ut med text-transform i CSS */

/* ---------- visninger ---------- */

function render() {
  const app = document.getElementById('app');
  let html;
  if (ui.view === 'home') html = viewHome();
  else if (ui.view === 'board') html = viewBoard();
  else html = viewAdmin();
  const modus = (ui.view === 'home' || ui.view === 'board') ? 'barn' : 'voksen';
  document.documentElement.dataset.mode = modus;
  document.body.dataset.mode = modus;
  document.body.dataset.screen = ui.view;
  app.innerHTML = html;
  if (ui.view === 'admin' && ui.tab === 'tasks') bindDrag();
  renderAmountModal();
  if (ui.view === 'board' && ui.celebrate) {
    feiring();
    ui.celebrate = false;
  }
  ui.popCell = null;
}

/* Enkle romfartøy tegnet som SVG (ikke emoji) for et roligere, mer
   fotografisk preg. Ingen <defs>/id-er, siden markeringen settes inn flere
   ganger på siden og duplikate id-er ikke er lov. */
const SATELLITE_SVG = `<svg viewBox="0 0 64 40" width="52" height="33"><rect x="2" y="16" width="17" height="8" rx="1" fill="#3a72b8"/><rect x="2" y="16" width="17" height="8" rx="1" fill="#28518a" opacity=".5"/><line x1="4" y1="18" x2="17" y2="18" stroke="#8fb6e6" stroke-width=".6"/><line x1="4" y1="22" x2="17" y2="22" stroke="#8fb6e6" stroke-width=".6"/><rect x="45" y="16" width="17" height="8" rx="1" fill="#3a72b8"/><line x1="47" y1="18" x2="60" y2="18" stroke="#8fb6e6" stroke-width=".6"/><line x1="47" y1="22" x2="60" y2="22" stroke="#8fb6e6" stroke-width=".6"/><rect x="24" y="13" width="16" height="14" rx="2" fill="#dfe3ea"/><rect x="24" y="20" width="16" height="7" rx="2" fill="#b7bec9"/><circle cx="32" cy="18" r="3" fill="#54606f"/><line x1="32" y1="13" x2="32" y2="4" stroke="#b7bec9" stroke-width="1.4"/><circle cx="32" cy="4" r="1.8" fill="#f0c65a"/></svg>`;

/* Raketten er selve inngangsknappen til hvert barn nå: bokstaven fra navnet
   sitter der vinduet satt før, som et oppdragsmerke. */
function rocketSvg(name) {
  const letter = esc((name || '?').trim().slice(0, 2).toUpperCase());
  return `<svg viewBox="0 0 40 90" width="58" height="131"><path d="M20 2c8 15 10 30 10 46H10c0-16 2-31 10-46Z" fill="#e9ecf2"/><path d="M20 2c5 12 7 24 7 38h-7Z" fill="#c4cad6"/><circle cx="20" cy="30" r="8.2" fill="#fff"/><circle cx="20" cy="30" r="8.2" fill="none" stroke="#b7bec9" stroke-width="1"/><text x="20" y="34.5" text-anchor="middle" font-family="-apple-system,'Segoe UI',sans-serif" font-size="12" font-weight="800" fill="#23241f">${letter}</text><path d="M10 48 2 66l8-6Z" fill="#c0392b"/><path d="M30 48l8 18-8-6Z" fill="#c0392b"/><rect x="10" y="48" width="20" height="13" fill="#dfe3ea"/><path d="M13 61 20 82 27 61Z" fill="#f6a623"/><path d="M15.5 61 20 75 24.5 61Z" fill="#ffe08a"/></svg>`;
}

function viewHome() {
  const rockets = S.children.map((c, i) => `
    <button class="craft craft-kid craft-kid-${i % 4}" data-act="child" data-id="${c.id}" aria-label="Gå til ${esc(c.name)} sin side">
      <span class="tap">${rocketSvg(c.name)}</span>
    </button>`).join('');
  return `
    <div class="space-scene" aria-hidden="true">
      <div class="stars stars-far"></div>
      <div class="stars stars-near"></div>
      <div class="nebula nebula-a"></div>
      <div class="nebula nebula-b"></div>
      <img class="planet-photo planet-jupiter" src="https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg" alt="">
      <img class="planet-photo planet-neptune" src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Neptune_Full.jpg/500px-Neptune_Full.jpg" alt="">
      <img class="planet-photo planet-saturn" src="https://upload.wikimedia.org/wikipedia/commons/0/0a/Transparent_Saturn.png" alt="">
      <div class="craft craft-sat1"><div class="spin">${SATELLITE_SVG}</div></div>
      <div class="craft craft-sat2"><div class="spin spin-slow">${SATELLITE_SVG}</div></div>
      ${rockets}
    </div>
    <div class="topbar">
      <div>
        <h1 class="title">UKEPENGER</h1>
        <div class="version-tag">${APP_VERSION}</div>
      </div>
      <button class="btn" data-act="admin">⚙️ Rediger</button>
    </div>
    <div class="rocket-hint">Trykk på raketten din! 🚀</div>`;
}

function viewBoard() {
  const c = child(ui.childId);
  if (!c) { ui.view = 'home'; return viewHome(); }
  const dates = weekDates(ui.weekOffset);
  const keys = dates.map(iso);
  const wk = iso(dates[0]);
  const today = iso(new Date());
  const list = tasksFor(c.id, wk);

  const head = `<div></div><div class="board-head">KR</div>` +
    dates.map((d, i) => `<div class="board-head${keys[i] === today ? ' today' : ''}">${DAY_LABELS[i]}</div>`).join('') +
    `<div class="board-head">SUM</div>`;

  const rows = list.map((t, i) => {
    const col = ROWS[i % ROWS.length];
    const v = `--bg:${col.bg};--line:${col.line};--ink:${col.ink}`;
    const cells = keys.map(k => {
      const evs = S.events.filter(e => e.childId === c.id && e.taskId === t.id && e.date === k);
      const pop = ui.popCell === c.id + t.id + k ? ' pop' : '';
      let inner = '';
      if (evs.length) {
        if (t.multi) {
          const daySum = evs.reduce((s, e) => s + (e.amount || 0), 0);
          inner = `<span class="mark multi"><span class="multi-sum">${daySum}</span>${evs.length > 1 ? `<span class="multi-count">×${evs.length}</span>` : ''}</span>`;
        } else {
          inner = `<span class="mark">${SMILEY}</span>`;
        }
      }
      const label = t.name + ' ' + dayName(k) + (evs.length ? (t.multi ? ' – ' + evs.length + ' gang' + (evs.length === 1 ? '' : 'er') : ' – gjort') : ' – ikke gjort');
      return `<button class="cell${evs.length ? ' ok' : ''}${k === today ? ' today' : ''}${pop}" style="${v}" data-act="cell" data-task="${t.id}" data-date="${k}" aria-label="${esc(label)}">${inner}</button>`;
    }).join('');
    const sum = keys.reduce((s, k) => {
      return s + S.events.filter(e => e.childId === c.id && e.taskId === t.id && e.date === k).reduce((s2, e) => s2 + (e.amount || 0), 0);
    }, 0);
    return `<div class="task-name" style="${v}"><span class="task-emoji">${t.emoji}</span><span class="tn-tekst">${esc(t.name)}</span></div>
      <div class="task-kr" style="${v}">${t.price === null ? '?' : t.price}</div>
      ${cells}
      <div class="task-sum${sum ? '' : ' zero'}" style="${v}">${sum}</div>`;
  }).join('');

  const weekSum = earnedBetween(c.id, keys[0], keys[6]);
  const totalSaved = balance(c.id);
  const label = ui.weekOffset === 0 ? 'Denne uken' : 'Uke ' + weekNumber(dates[0]);

  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost" data-act="home" aria-label="Tilbake">←</button>
        <div class="kid-avatar avatar-sm">${c.emoji}</div>
        <div>
          <div class="kid-name" style="font-size:24px">${esc(c.name)}</div>
          <div class="subtle">Uke ${weekNumber(dates[0])}</div>
        </div>
      </div>
    </div>
    <div class="pengesekk-row">
      <div class="pengesekk-stack">
        <div class="pengesekk">
          <div class="pengesekk-label">Spart opp denne uken</div>
          <div class="pengesekk-amount"><span class="coin">🪙</span><span id="ukesum">${weekSum}</span> kr</div>
        </div>
        <div class="pengesekk-total"><span class="coin">💰</span>${kr(totalSaved)} <span class="pengesekk-total-label">spart opp totalt</span></div>
      </div>
    </div>
    <div class="week-nav-row">
      <button class="btn btn-icon" data-act="week" data-d="-1" aria-label="Forrige uke">◀</button>
      <button class="btn btn-sm" data-act="week" data-d="0">${label}</button>
      <button class="btn btn-icon" data-act="week" data-d="1" aria-label="Neste uke">▶</button>
      <button class="btn btn-sm" data-act="admin" aria-label="Rediger">⚙️</button>
    </div>
    <div class="card">
      <div class="board-scroll">
        <div class="board" style="grid-template-columns:minmax(128px,2.2fr) 34px repeat(7,minmax(38px,1fr)) 46px">
          ${head}${rows}
        </div>
      </div>
      ${list.length ? '' : '<div class="empty">Ingen oppgaver ennå. Legg til under ⚙️ Rediger.</div>'}
      <div class="legend">
        <span class="lg-ok">${SMILEY} Gjort</span>
        <span class="lg-heia">Hver innsats teller! 💪</span>
      </div>
    </div>`;
}

function viewAdmin() {
  const tabs = [['tasks', 'Oppgaver'], ['payout', 'Utbetalinger'], ['settings', 'Innstillinger']];
  let body;
  if (ui.tab === 'payout') body = tabPayout();
  else if (ui.tab === 'settings') body = tabSettings();
  else body = tabTasks();

  const stale = S.events.length > 5 && daysSince(S.lastBackup) > 30;
  return `
    <div class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost" data-act="home" aria-label="Tilbake">←</button>
        <h1 class="title" style="font-size:19px">Rediger</h1>
        <div class="version-tag">${APP_VERSION}</div>
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(t => `<button class="tab${ui.tab === t[0] ? ' active' : ''}" data-act="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}
    </div>
    ${stale ? `<div class="banner"><span>Det er ${S.lastBackup ? daysSince(S.lastBackup) + ' dager' : 'lenge'} siden forrige sikkerhetskopi.</span><button class="btn btn-sm" data-act="backup">Last ned kopi</button></div>` : ''}
    ${body}`;
}

function tabTasks() {
  const cid = ui.tasksChildId || S.children[0] && S.children[0].id;
  const wk = iso(mondayOf(new Date()));
  const list = S.tasks.filter(t => !t.archived && (!t.kids || t.kids.indexOf(cid) >= 0));
  const rows = list.map(t => `
    <div class="row" data-taskid="${t.id}">
      <div class="row-left">
        <span class="grip" data-grip="${t.id}" aria-hidden="true">⠿</span>
        <span class="task-emoji">${t.emoji}</span>
        <span class="row-title">${esc(t.name)}</span>
        ${t.week ? `<span class="pill">bare uke ${weekNumber(parseIso(t.week))}</span>` : ''}
        ${!t.kids ? `<span class="pill">alle barna</span>` : ''}
      </div>
      <div class="row-left" style="flex:none;gap:8px">
        <input type="text" inputmode="numeric" value="${t.price === null ? '?' : t.price}" data-price="${t.id}" style="width:70px;text-align:right" aria-label="Pris"> kr
        <button class="btn btn-sm btn-icon" data-act="deltask" data-id="${t.id}" aria-label="Fjern oppgave">🗑</button>
      </div>
    </div>`).join('');

  return `<div class="card stack">
    <div>
      <div class="section-title">Oppgaver</div>
      <div class="tabs">${S.children.map(c => `<button class="tab${c.id === cid ? ' active' : ''}" data-act="taskchild" data-id="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}</div>
    </div>
    <div id="tasklist">${rows || '<div class="empty">Ingen oppgaver for dette barnet.</div>'}</div>
    <div class="adder">
      <div class="adder-row">
        <div class="emoji-pick">${EMOJIS.slice(0, 10).map(e => `<button class="emoji-btn${ui.newEmoji === e ? ' sel' : ''}" data-act="emoji" data-e="${e}">${e}</button>`).join('')}
        <button class="emoji-btn" data-act="moreemoji" aria-label="Flere ikoner">…</button></div>
      </div>
      <div class="adder-row" style="margin-top:10px">
        <input type="text" id="newname" placeholder="Ny oppgave" style="flex:1;min-width:150px">
        <input type="text" id="newprice" inputmode="numeric" placeholder="kr, eller ? for valgfritt" style="width:78px;text-align:right">
        <button class="btn btn-primary" data-act="addtask" data-child="${cid}" data-week="${wk}">Legg til</button>
      </div>
      <div class="checks">
        <label><input type="checkbox" id="newweek"> Bare denne uken</label>
        <label><input type="checkbox" id="newall"> Gjelder alle barna</label>
      </div>
    </div>
  </div>`;
}

function tabPayout() {
  const cid = ui.payChildId || S.children[0] && S.children[0].id;
  const c = child(cid);
  if (!c) return `<div class="card"><div class="empty">Ingen barn lagt til ennå.</div></div>`;
  const dates = weekDates(0).map(iso);
  const year = new Date().getFullYear();
  const bal = balance(cid);
  const hist = S.payouts.filter(p => p.childId === cid).slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return `<div class="card stack">
    <div>
      <div class="section-title">Oppgjør</div>
      <div class="tabs">${S.children.map(k => `<button class="tab${k.id === cid ? ' active' : ''}" data-act="paychild" data-id="${k.id}">${k.emoji} ${esc(k.name)}</button>`).join('')}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Ikke utbetalt</div><div class="stat-value">${kr(bal)}</div></div>
      <div class="stat"><div class="stat-label">Denne uken</div><div class="stat-value">${kr(earnedBetween(cid, dates[0], dates[6]))}</div></div>
      <div class="stat"><div class="stat-label">Totalt i ${year}</div><div class="stat-value">${kr(earnedBetween(cid, year + '-01-01', year + '-12-31'))}</div></div>
    </div>
    <div>
      ${hist.length ? hist.map(p => `<div class="row"><div>${longDate(p.date)} · ${esc(p.method)}</div><div>${kr(p.amount)}</div></div>`).join('')
        : '<div class="empty">Ingen utbetalinger registrert ennå.</div>'}
    </div>
    <div class="adder-row" style="justify-content:flex-end">
      <select id="paymethod" aria-label="Måte"><option>kontant</option><option>Vipps</option><option>sparekonto</option></select>
      <input type="number" inputmode="numeric" id="payamount" value="${bal}" style="width:96px;text-align:right" aria-label="Beløp">
      <button class="btn btn-primary" data-act="payout" data-child="${cid}">Betal ut</button>
    </div>
  </div>`;
}

function tabSettings() {
  return `<div class="card stack">
    <div>
      <div class="section-title">Barn</div>
      ${S.children.map(c => `<div class="row">
        <div class="row-left">
          <span class="task-emoji">${c.emoji}</span>
          <input type="text" value="${esc(c.name)}" data-cname="${c.id}" style="max-width:190px">
        </div>
        <div class="row-left" style="flex:none;gap:8px">
          <input type="text" value="${esc(c.emoji)}" data-cemoji="${c.id}" style="width:56px;text-align:center" aria-label="Ikon">
          <button class="btn btn-sm btn-icon" data-act="delchild" data-id="${c.id}" aria-label="Fjern barn">🗑</button>
        </div>
      </div>`).join('')}
      <div class="adder-row" style="margin-top:14px">
        <input type="text" id="childemoji" value="🐻" style="width:60px;text-align:center" aria-label="Ikon">
        <input type="text" id="childname" placeholder="Nytt barn" style="flex:1;min-width:140px">
        <button class="btn btn-primary" data-act="addchild">Legg til barn</button>
      </div>
    </div>
    <div>
      <div class="section-title">Lyd</div>
      <div class="checks"><label><input type="checkbox" data-sound${S.sound === false ? '' : ' checked'}> Spill lyd og feiring når noe krysses av</label></div>
    </div>
    <div>
      <div class="section-title">Sikkerhetskopi</div>
      <div class="hint">Alt ligger bare på denne telefonen. Last ned en kopi av og til og legg den i OneDrive — da overlever dataene om nettleseren blir tømt.${S.lastBackup ? ' Forrige kopi: ' + longDate(S.lastBackup) + '.' : ''}</div>
      <div class="adder-row" style="margin-top:12px">
        <button class="btn" data-act="backup">Last ned kopi</button>
        <button class="btn" data-act="restorepick">Gjenopprett fra fil</button>
        <input type="file" id="restorefile" accept="application/json" style="display:none">
      </div>
    </div>
    <div>
      <div class="section-title">Bilder på forsiden</div>
      <div class="hint">Jupiter og Neptun: NASA/USGS (falt i det fri). Saturn: SpiciousS, Wikimedia Commons, lisens <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</div>
    </div>
  </div>`;
}

/* ---------- beløps-dialog for oppgaver med valgfri sum ---------- */

function renderAmountModal() {
  const el = document.getElementById('modal');
  if (!ui.amount) { el.innerHTML = ''; return; }
  const t = task(ui.amount.taskId);
  if (!t) { ui.amount = null; el.innerHTML = ''; return; }
  const quick = QUICK_AMOUNTS.map(a => `<button class="btn quick-amt" data-act="quickamt" data-a="${a}">${a} kr</button>`).join('');
  const noteField = t.multi ? `
        <div class="adder-row">
          <input type="text" id="amtnote" placeholder="Noen få ord om hva som ble gjort" style="flex:1;min-width:160px" autofocus>
        </div>` : '';
  let list = '';
  if (t.multi) {
    const evs = S.events.filter(e => e.childId === ui.childId && e.taskId === t.id && e.date === ui.amount.date);
    if (evs.length) {
      list = `<div class="hint">I dag:</div>` + evs.map(e => `
        <div class="row" style="padding:8px 0">
          <div class="row-left"><span class="row-title">${e.note ? esc(e.note) : 'Uten merknad'}</span></div>
          <div class="row-left" style="flex:none;gap:8px">
            <span>${kr(e.amount || 0)}</span>
            <button class="btn btn-sm btn-icon" data-act="delentry" data-id="${e.id}" aria-label="Fjern">✕</button>
          </div>
        </div>`).join('');
    }
  }
  el.innerHTML = `
    <div class="modal-backdrop" data-act="amtcancel">
      <div class="modal-card" data-act="noop">
        <div class="section-title">${t.emoji} ${esc(t.name)}</div>
        ${list}
        <div class="hint">Hvor mye er dette verdt?</div>
        ${noteField}
        <div class="quick-amts" style="margin-top:10px">${quick}</div>
        <div class="adder-row" style="margin-top:10px">
          <input type="number" inputmode="numeric" id="amtinput" placeholder="Eget beløp"${t.multi ? '' : ' autofocus'} style="flex:1;text-align:right"> kr
        </div>
        <div class="adder-row" style="justify-content:flex-end;margin-top:16px">
          <button class="btn" data-act="amtcancel">${t.multi ? 'Lukk' : 'Avbryt'}</button>
          <button class="btn btn-primary" data-act="amtsave">${t.multi ? 'Legg til' : 'Lagre'}</button>
        </div>
      </div>
    </div>`;
}

function finishAmount(v) {
  const { taskId, date } = ui.amount;
  const t = task(taskId);
  const noteEl = document.getElementById('amtnote');
  const note = noteEl ? noteEl.value.trim() : '';
  if (!t.multi) ui.amount = null;
  addEvent(taskId, date, v, note);
}

/* ---------- moro ---------- */

/* Gnister skytes ut fra midten av ruta. De ligger i sitt eget lag over alt
   annet, så de kan fly utenfor ruta uten å dytte på rutenettet. */
function gnister(el, antall) {
  const r = el.getBoundingClientRect();
  const fx = document.getElementById('fx');
  for (let i = 0; i < antall; i++) {
    const s = document.createElement('span');
    s.className = 'gnist';
    s.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    s.style.left = (r.left + r.width / 2) + 'px';
    s.style.top = (r.top + r.height / 2) + 'px';
    const v = (Math.PI * 2 * i) / antall + Math.random() * 0.6;
    const d = 45 + Math.random() * 55;
    s.style.setProperty('--dx', Math.round(Math.cos(v) * d) + 'px');
    s.style.setProperty('--dy', Math.round(Math.sin(v) * d - 25) + 'px');
    fx.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

/* Skjermdekkende konfetti for den store feiringen — separat fra gnist-laget
   over, siden dette skal falle fra toppen av HELE skjermen, ikke fra ei rute. */
function bigFeiring() {
  const fx = document.getElementById('fx');
  const w = window.innerWidth, h = window.innerHeight;
  const n = Math.min(55, Math.max(32, Math.round(w / 9)));
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'konfetti';
    s.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
    s.style.left = Math.round(Math.random() * w) + 'px';
    s.style.fontSize = Math.round(16 + Math.random() * 20) + 'px';
    s.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
    s.style.setProperty('--drift', Math.round(Math.random() * 160 - 80) + 'px');
    s.style.setProperty('--fall', Math.round(h + 80) + 'px');
    s.style.animationDuration = (1.5 + Math.random()) + 's';
    s.style.animationDelay = (Math.random() * 0.35) + 's';
    fx.appendChild(s);
    setTimeout(() => s.remove(), 3200);
  }
}

let lydkontekst = null;
function lyd(toner) {
  if (S.sound === false || !window.AudioContext) return;
  try {
    lydkontekst = lydkontekst || new AudioContext();
    toner.forEach((hz, i) => {
      const o = lydkontekst.createOscillator(), g = lydkontekst.createGain();
      const t = lydkontekst.currentTime + i * 0.09;
      o.type = 'triangle';
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(lydkontekst.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
  } catch (e) { /* lyd er pynt — den skal aldri stoppe appen */ }
}

function fanfare() {
  lyd([523, 659, 784, 1047, 1319, 1568]);
}

/* Kjøres rett etter render() når en oppgave nettopp er krysset av: liten sprett
   på selve ruta, stort konfettiregn over hele skjermen, fanfare, og pengesekken
   teller seg opp fra beløpet den hadde før denne oppgaven ble lagt til. */
function feiring() {
  const rute = document.querySelector('.cell.pop');
  if (rute) gnister(rute, 10);
  bigFeiring();
  fanfare();
  const teller = document.getElementById('ukesum');
  if (teller && ui.animateFrom != null) {
    const til = +teller.textContent;
    if (ui.animateFrom !== til) tellOpp(teller, ui.animateFrom, til);
  }
  ui.animateFrom = null;
}

function tellOpp(el, fra, til) {
  const start = performance.now(), lengde = 900;
  el.parentElement.classList.add('rister');
  (function steg(na) {
    const p = Math.min(1, (na - start) / lengde);
    el.textContent = Math.round(fra + (til - fra) * p);
    if (p < 1) requestAnimationFrame(steg);
    else setTimeout(() => el.parentElement.classList.remove('rister'), 400);
  })(start);
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function onCell(taskId, date) {
  const t = task(taskId);
  if (t.multi) {
    ui.amount = { taskId, date };
    render();
    return;
  }
  const existing = eventAt(ui.childId, taskId, date);
  if (existing) {
    S.events = S.events.filter(x => x !== existing);
    save();
    render();
    return;
  }
  if (t.price === null) {
    ui.amount = { taskId, date };
    render();
    return;
  }
  addEvent(taskId, date, t.price);
}

function addEvent(taskId, date, amount, note) {
  const dates = weekDates(ui.weekOffset).map(iso);
  ui.animateFrom = earnedBetween(ui.childId, dates[0], dates[6]);
  const ev = { id: uid(), childId: ui.childId, taskId: taskId, date: date, amount: Math.round(amount) };
  if (note) ev.note = note;
  S.events.push(ev);
  save();
  ui.popCell = ui.childId + taskId + date;
  ui.celebrate = true;
  render();
}

function download() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'poengtavle-' + iso(new Date()) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.lastBackup = iso(new Date());
  save();
  toast('Kopi lastet ned');
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'noop') return;

  if (act === 'child') { ui.childId = el.dataset.id; ui.weekOffset = 0; ui.view = 'board'; }
  else if (act === 'home') { ui.view = 'home'; ui.amount = null; }
  else if (act === 'week') {
    const d = +el.dataset.d;
    ui.weekOffset = d === 0 ? 0 : ui.weekOffset + d;
  }
  else if (act === 'cell') { onCell(el.dataset.task, el.dataset.date); return; }
  else if (act === 'admin') { ui.view = 'admin'; ui.tab = el.dataset.goto || ui.tab || 'tasks'; }
  else if (act === 'tab') ui.tab = el.dataset.t;
  else if (act === 'taskchild') ui.tasksChildId = el.dataset.id;
  else if (act === 'paychild') ui.payChildId = el.dataset.id;
  else if (act === 'emoji') ui.newEmoji = el.dataset.e;
  else if (act === 'moreemoji') {
    const e = prompt('Lim inn et ikon (emoji):', ui.newEmoji);
    if (e) ui.newEmoji = e.trim().slice(0, 4);
  }
  else if (act === 'quickamt') { finishAmount(+el.dataset.a); return; }
  else if (act === 'amtsave') {
    const v = parseInt((document.getElementById('amtinput').value || '').trim(), 10);
    if (!v || v <= 0) { toast('Skriv et beløp'); return; }
    finishAmount(v);
    return;
  }
  else if (act === 'amtcancel') { ui.amount = null; }
  else if (act === 'delentry') {
    S.events = S.events.filter(x => x.id !== el.dataset.id);
    save();
  }
  else if (act === 'deltask') {
    const t = task(el.dataset.id);
    if (!t) return;
    if (!confirm('Fjerne «' + t.name + '» fra tavla? Det som allerede er tjent blir stående.')) return;
    t.archived = true;
    save();
  }
  else if (act === 'addtask') {
    const name = (document.getElementById('newname').value || '').trim();
    if (!name) { toast('Skriv et navn'); return; }
    const raw = (document.getElementById('newprice').value || '').trim();
    const price = raw === '' || raw === '?' ? null : parseInt(raw, 10) || 0;
    const all = document.getElementById('newall').checked;
    const thisWeek = document.getElementById('newweek').checked;
    S.tasks.push({
      id: uid(), emoji: ui.newEmoji, name: name, price: price,
      kids: all ? null : [el.dataset.child], week: thisWeek ? el.dataset.week : null, archived: false
    });
    save();
    toast('Oppgave lagt til');
  }
  else if (act === 'payout') {
    const amt = parseInt(document.getElementById('payamount').value, 10);
    if (!amt || amt <= 0) { toast('Sett et beløp'); return; }
    S.payouts.push({ id: uid(), childId: el.dataset.child, date: iso(new Date()), amount: amt, method: document.getElementById('paymethod').value });
    save();
    toast('Utbetaling registrert');
  }
  else if (act === 'addchild') {
    const name = (document.getElementById('childname').value || '').trim();
    if (!name) { toast('Skriv et navn'); return; }
    S.children.push({ id: uid(), name: name, emoji: (document.getElementById('childemoji').value || '🐻').trim() });
    save();
  }
  else if (act === 'delchild') {
    const c = child(el.dataset.id);
    if (!c) return;
    if (!confirm('Fjerne ' + c.name + '? Historikk og utbetalinger blir også borte.')) return;
    S.children = S.children.filter(x => x.id !== c.id);
    S.events = S.events.filter(e => e.childId !== c.id);
    S.payouts = S.payouts.filter(p => p.childId !== c.id);
    save();
  }
  else if (act === 'backup') { download(); return; }
  else if (act === 'restorepick') { document.getElementById('restorefile').click(); return; }
  else return;

  render();
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.price) {
    const t = task(el.dataset.price);
    const raw = el.value.trim();
    t.price = raw === '' || raw === '?' ? null : parseInt(raw, 10) || 0;
    save(); render();
  } else if (el.dataset.cname) {
    child(el.dataset.cname).name = el.value.trim() || 'Barn';
    save();
  } else if (el.dataset.cemoji) {
    child(el.dataset.cemoji).emoji = el.value.trim().slice(0, 4) || '🙂';
    save(); render();
  } else if (el.hasAttribute('data-sound')) {
    S.sound = el.checked;
    save();
    if (el.checked) lyd([660, 880]);
  } else if (el.id === 'restorefile' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.children || !data.tasks) throw 0;
        if (!confirm('Erstatte alt som ligger i appen nå med innholdet i filen?')) return;
        S = migrate(data); save(); render(); toast('Gjenopprettet');
      } catch (e) { toast('Filen kunne ikke leses'); }
    };
    r.readAsText(el.files[0]);
  }
});

/* ---------- dra for å endre rekkefølge ---------- */

function bindDrag() {
  document.querySelectorAll('[data-grip]').forEach(g => g.addEventListener('pointerdown', startDrag));
}

function startDrag(ev) {
  const row = ev.target.closest('.row');
  const list = Array.from(document.querySelectorAll('#tasklist .row'));
  const from = list.indexOf(row);
  const h = row.offsetHeight;
  const y0 = ev.clientY;
  row.classList.add('dragging');
  ev.target.setPointerCapture(ev.pointerId);

  function move(e) { row.style.transform = 'translateY(' + (e.clientY - y0) + 'px)'; }
  function up(e) {
    ev.target.releasePointerCapture(ev.pointerId);
    ev.target.removeEventListener('pointermove', move);
    ev.target.removeEventListener('pointerup', up);
    row.style.transform = '';
    row.classList.remove('dragging');
    const steps = Math.round((e.clientY - y0) / h);
    if (!steps) return;
    const to = Math.max(0, Math.min(list.length - 1, from + steps));
    const ids = list.map(r => r.dataset.taskid);
    const moved = ids.splice(from, 1)[0];
    ids.splice(to, 0, moved);
    const set = new Set(ids);
    const rest = S.tasks.filter(t => !set.has(t.id));
    S.tasks = ids.map(id => task(id)).concat(rest);
    save(); render();
  }
  ev.target.addEventListener('pointermove', move);
  ev.target.addEventListener('pointerup', up);
}

/* ---------- start ---------- */

load();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
