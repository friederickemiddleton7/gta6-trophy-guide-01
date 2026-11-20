// GTA VI Trophy Guide & Tracker — plain ES module, offline, no dependencies.
// Checklist state persists in localStorage; export/import as JSON; filters, search,
// spoiler setting, and a generated roadmap to the platinum.
const KEY = 'gta6-trophy-guide-v1';

const els = {
  list: document.getElementById('list'),
  progress: document.getElementById('progress'),
  pfill: document.getElementById('pfill'),
  grade: document.getElementById('grade'),
  kind: document.getElementById('kind'),
  search: document.getElementById('search'),
  hideDone: document.getElementById('hideDone'),
  spoiler: document.getElementById('spoiler'),
  export: document.getElementById('export'),
  import: document.getElementById('import'),
  reset: document.getElementById('reset'),
  summary: document.getElementById('summary'),
  roadlist: document.getElementById('roadlist'),
};

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;

let state = JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? { earned: [], spoiler: false };
let earned = new Set(state.earned);
state.spoiler = !!state.spoiler;

function save() {
  localStorage.setItem(KEY, JSON.stringify({ earned: [...earned], spoiler: state.spoiler }));
}

const isStory = (t) => /story|chapter|final mission/i.test(t.guide) && t.grade !== 'bronze' || t.id <= 7;
const MISSABLE_IDS = new Set([3,4,5,6]); // placeholder; enriched from flags below
const FLAG = {};
for (const t of trophies) FLAG[t.id] = t.flag ?? null;

function tags(t) {
  const out = [];
  if (t.grade === 'platinum') out.push(['kind', 'Platinum']);
  if (FLAG[t.id]) out.push(['miss', 'Missable']);
  return out;
}

function visible() {
  const q = els.search.value.trim().toLowerCase();
  const g = els.grade.value, k = els.kind.value;
  return trophies.filter((t) => {
    if (els.hideDone.checked && earned.has(t.name)) return false;
    if (g !== 'all' && t.grade !== g) return false;
    if (k !== 'all') {
      const tg = FLAG[t.id];
      if (k === 'missable' && !tg) return false;
      if (k === 'story' && !isStory(t)) return false;
      if (k === 'mission' && (isStory(t) || tg)) return false;
      if (k === 'collectible' && !/collect|find|locate/i.test(t.guide + t.description)) return false;
      if (k === 'side' && (isStory(t) || tg || /collect/i.test(t.guide))) return false;
    }
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide).toLowerCase().includes(q)) return false;
    if (state.spoiler && isStory(t) && !earned.has(t.name)) return false;
    return true;
  });
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const v = visible();
  const total = trophies.length, n = earned.size;
  els.progress.textContent = `${n} / ${total}`;
  els.pfill.style.width = (100 * n / total).toFixed(1) + '%';
  els.list.replaceChildren();
  for (const t of v) {
    const card = document.createElement('article');
    card.className = 'tcard' + (earned.has(t.name) ? ' earned' : '');
    const bx = document.createElement('div'); bx.className = 'box';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = earned.has(t.name);
    cb.setAttribute('aria-label', 'mark ' + t.name + ' earned');
    cb.addEventListener('change', () => {
      if (cb.checked) earned.add(t.name); else earned.delete(t.name);
      save(); render();
    });
    bx.append(cb);

    const body = document.createElement('div');
    const guide = state.spoiler && isStory(t) && !earned.has(t.name)
      ? '(hidden by spoiler setting — finish the story to reveal)'
      : esc(t.guide);
    body.innerHTML = `<h3 class="tname">${esc(t.name)}</h3>
      <p class="tdesc">${esc(t.description)}</p>
      <p class="tguide">${guide}</p>`;

    const badges = document.createElement('div'); badges.className = 'badges';
    badges.innerHTML = `<span class="grade ${t.grade}">${t.grade}</span><span class="tags"></span>`;
    for (const [cls, label] of tags(t)) {
      const s = document.createElement('span');
      s.className = 'tag ' + cls; s.textContent = label;
      badges.querySelector('.tags').append(s);
    }
    card.append(bx, body, badges);
    els.list.append(card);
  }
  els.summary.hidden = v.length === trophies.length;
  if (!els.summary.hidden) els.summary.textContent = `Showing ${v.length} of ${total} trophies.`;
}

function renderRoadmap() {
  const groups = [
    ['Play through the story', trophies.filter((t) => t.id <= 7), 'Story trophies 2–7 unlock automatically as you finish Gone Fishing and each chapter; the platinum (1) needs all the rest.'],
    ['Do every mission & side op', trophies.filter((t) => t.grade === 'silver' || t.grade === 'gold'), 'Silver and gold trophies mark the big set-pieces: missions, heists, and the long side-content lines. Replay any from the mission menu.'],
    ['Clean up the bronze list', trophies.filter((t) => t.grade === 'bronze'), 'Most bronzes are one-off actions: collectibles, challenges, and small milestones. The checklist keeps you honest — sweep it before the story ends.'],
  ];
  els.roadlist.replaceChildren();
  groups.forEach(([title, items, note], i) => {
    const li = document.createElement('li');
    const b = document.createElement('b'); b.textContent = `${title} (${items.length})`;
    li.append(b, document.createTextNode(' — ' + note));
    if (i === 0) { const m = document.createElement('span'); m.className = 'miss'; m.textContent = ' Watch the missable flags'; li.append(m); }
    els.roadlist.append(li);
  });
}

els.export.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify([...earned], null, 0)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
});
els.import.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const arr = JSON.parse(await f.text());
    earned = new Set(Array.isArray(arr) ? arr : []);
    save(); render();
  } catch { els.summary.hidden = false; els.summary.textContent = 'That file is not a valid progress export.'; }
});
els.reset.addEventListener('click', () => {
  if (!confirm('Reset all earned trophies?')) return;
  earned = new Set(); save(); render();
});
['change', 'input'].forEach((ev) => {
  els.grade.addEventListener(ev, render);
  els.kind.addEventListener(ev, render);
  els.search.addEventListener(ev, render);
  els.hideDone.addEventListener(ev, render);
  els.spoiler.addEventListener(ev, () => { state.spoiler = els.spoiler.checked; save(); render(); });
});
els.spoiler.checked = state.spoiler;
renderRoadmap();
render();
