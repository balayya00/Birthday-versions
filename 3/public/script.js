/* ════════════════════════════════════════════════════
   Birthday in History v3 — Frontend
   Order: Year Context → Greeting → Categories → Famous
   No timeline · No fallback note · Full dates everywhere
════════════════════════════════════════════════════ */

// ── Starfield ────────────────────────────────────
(function initStars() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2, a: Math.random(),
      speed: Math.random() * 0.004 + 0.002, phase: Math.random() * Math.PI * 2
    }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      const alpha = s.a * (0.4 + 0.6 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize(); window.addEventListener('resize', resize); requestAnimationFrame(draw);
})();

// ── Dropdowns ────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAT_META = {
  '🌍 World':   { key:'world',   icon:'🌍', label:'World Events' },
  '🧪 Science': { key:'science', icon:'🧪', label:'Science & Technology' },
  '🎬 Culture': { key:'culture', icon:'🎬', label:'Culture & Arts' },
  '⚽ Sports':  { key:'sports',  icon:'⚽', label:'Sports' }
};
const CAT_ORDER = ['🌍 World', '🧪 Science', '🎬 Culture', '⚽ Sports'];

(function populateDropdowns() {
  const dayEl = document.getElementById('inp-day');
  const monEl = document.getElementById('inp-month');
  for (let d = 1; d <= 31; d++) dayEl.add(new Option(d < 10 ? `0${d}` : String(d), d));
  MONTHS.forEach((m, i) => monEl.add(new Option(m, i + 1)));
})();

// ── Page switching ────────────────────────────────
function showPage(id) {
  ['landing','loading','results'].forEach(p =>
    document.getElementById(p).classList.toggle('page-hidden', p !== id)
  );
  window.scrollTo(0, 0);
}

// ── Loading animation ─────────────────────────────
const LOADING_MSGS = [
  'Opening historical archives…',
  'Verifying Wikipedia sources…',
  'Scanning the 21st century…',
  'Scanning the 20th century…',
  'Searching ancient history…',
  'Finding people born on your day…',
  'Organising events by category…',
  'Preparing your history story…'
];

function animateLoader() {
  const msgEl = document.getElementById('loader-msg');
  const fillEl = document.getElementById('loader-fill');
  fillEl.style.width = '0%';
  let i = 0;
  const total = LOADING_MSGS.length;
  return new Promise(resolve => {
    const tick = () => {
      msgEl.style.opacity = '0';
      setTimeout(() => {
        msgEl.textContent = LOADING_MSGS[i];
        msgEl.style.opacity = '1';
        fillEl.style.width = `${((i + 1) / total) * 100}%`;
        i++;
        if (i < total) setTimeout(tick, 380);
        else setTimeout(resolve, 500);
      }, 200);
    };
    tick();
  });
}

// ── Submit ────────────────────────────────────────
async function submitForm() {
  const name  = document.getElementById('inp-name').value.trim();
  const day   = parseInt(document.getElementById('inp-day').value);
  const month = parseInt(document.getElementById('inp-month').value);
  const year  = document.getElementById('inp-year').value.trim();
  const errEl = document.getElementById('form-err');

  errEl.textContent = '';
  if (!name)  { errEl.textContent = 'Please enter your name.'; return; }
  if (!year)  { errEl.textContent = 'Please enter your birth year.'; return; }
  if (isNaN(parseInt(year)) || parseInt(year) < 1 || parseInt(year) > 2099)
              { errEl.textContent = 'Please enter a valid year (e.g. 2001).'; return; }

  const btn = document.getElementById('explore-btn');
  btn.disabled = true;
  showPage('loading');

  const [data] = await Promise.all([
    fetchBirthday(name, day, month, parseInt(year)),
    animateLoader()
  ]);

  btn.disabled = false;
  render(data);
  showPage('results');
}

// ── Fetch ─────────────────────────────────────────
async function fetchBirthday(name, day, month, year) {
  try {
    const r = await fetch('/api/birthday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, day, month, year })
    });
    if (!r.ok) throw new Error(`Server ${r.status}`);
    return await r.json();
  } catch (e) {
    return { type: 'error', message: e.message };
  }
}

// ── Main render ───────────────────────────────────
function render(data) {
  ['msg-future','msg-error','success'].forEach(id =>
    document.getElementById(id).classList.add('page-hidden')
  );

  if (data.type === 'future') {
    document.getElementById('msg-future').classList.remove('page-hidden');
    return;
  }
  if (data.type === 'error' || !data.grouped) {
    document.getElementById('msg-error-text').textContent = data.message || 'Could not fetch events. Please try again.';
    document.getElementById('msg-error').classList.remove('page-hidden');
    return;
  }

  document.getElementById('success').classList.remove('page-hidden');

  // ── Birthday banner (today only)
  if (data.isTodayBirthday) {
    document.getElementById('bday-title').textContent = `🎉 Happy Birthday, ${data.name}!`;
    document.getElementById('bday-banner').classList.remove('page-hidden');
    launchConfetti();
  }

  // ── 1. Year Context (FIRST)
  document.getElementById('ctx-year').textContent = data.year;
  const c = data.yearContext;
  document.getElementById('ctx-pills').innerHTML = `
    <div class="ctx-pill"><span class="ctx-pill-icon">🌍</span> World population ${c.population}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">💻</span> ${c.techEra}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">✨</span> ${c.milestone}</div>`;

  // ── 2. Greeting (SECOND)
  document.getElementById('greeting').textContent =
    `Hey ${data.name}, here are some remarkable moments in history that share your birthday.`;

  // ── 3. Categorical sections
  renderCategories(data.grouped);

  // ── 4. Famous people
  renderFamous(data.famousPeople);
}

// ── Category sections ─────────────────────────────
function renderCategories(grouped) {
  const wrap = document.getElementById('categories-wrap');
  wrap.innerHTML = '';

  CAT_ORDER.forEach((cat, ci) => {
    const events = grouped[cat];
    if (!events || events.length === 0) return;

    const meta = CAT_META[cat];
    const section = document.createElement('div');
    section.className = 'cat-section';
    section.dataset.cat = meta.key;
    section.style.animationDelay = `${ci * 0.1}s`;

    section.innerHTML = `
      <div class="cat-header">
        <div class="cat-icon-wrap">${meta.icon}</div>
        <span class="cat-title">${meta.label}</span>
        <span class="cat-count">${events.length} event${events.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="cat-row" id="cat-row-${meta.key}"></div>`;

    wrap.appendChild(section);

    const row = section.querySelector(`#cat-row-${meta.key}`);
    events.forEach((ev, i) => {
      row.appendChild(buildEventCard(ev, i, meta.key));
    });
  });
}

// ── Build a single event card ─────────────────────
function buildEventCard(ev, i, catKey) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.style.animationDelay = `${i * 0.06}s`;

  const emoji = { world:'🌍', science:'🔬', culture:'🎬', sports:'⚽' };
  const fallbackEmoji = emoji[catKey] || '🌍';

  const imgHTML = ev.image
    ? `<img src="${ev.image}" alt="${sanitize(ev.title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'ev-fallback\\'>${fallbackEmoji}</div>'">`
    : `<div class="ev-fallback">${fallbackEmoji}</div>`;

  card.innerHTML = `
    <div class="ev-img-wrap">${imgHTML}</div>
    <div class="ev-body">
      <div class="ev-date-row">
        <span class="ev-full-date">${sanitize(ev.fullDate || String(ev.year))}</span>
        <span class="ev-cat-dot"></span>
      </div>
      <h3 class="ev-title">${sanitize(ev.title)}</h3>
      <p class="ev-desc">${sanitize(ev.description)}</p>
      <p class="ev-hint">CLICK TO EXPAND →</p>
    </div>`;

  card.addEventListener('click', () => openOverlay(ev));
  return card;
}

// ── Famous people ─────────────────────────────────
function renderFamous(people) {
  const block = document.getElementById('famous-block');
  const grid  = document.getElementById('famous-grid');
  if (!people || people.length === 0) { block.classList.add('page-hidden'); return; }
  block.classList.remove('page-hidden');
  grid.innerHTML = '';

  people.forEach((p, i) => {
    const card = document.createElement('a');
    card.className = 'famous-card';
    card.href = p.wikiUrl || (p.wikipediaTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipediaTitle)}` : '#');
    card.target = '_blank'; card.rel = 'noopener';
    card.style.animationDelay = `${i * 0.08}s`;

    const imgHTML = p.image
      ? `<img class="fc-img" src="${p.image}" alt="${sanitize(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'fc-fallback\\'>👤</div>'">`
      : `<div class="fc-fallback">👤</div>`;

    card.innerHTML = `${imgHTML}
      <p class="fc-name">${sanitize(p.name)}</p>
      <p class="fc-year">Born ${p.year}</p>
      <p class="fc-role">${sanitize(p.profession || '')}</p>`;

    grid.appendChild(card);
  });
}

// ── Theatre Overlay ───────────────────────────────
function openOverlay(ev) {
  // Full date only — no "On the day you were born" header, no year ghost
  document.getElementById('ov-full-date').textContent = ev.fullDate || String(ev.year);
  document.getElementById('ov-title').textContent     = ev.title;
  document.getElementById('ov-cat').textContent       = ev.category || '';
  document.getElementById('ov-desc').textContent      = ev.description;
  document.getElementById('ov-link').href             = ev.wikiUrl || '#';

  const imgWrap = document.getElementById('ov-img-wrap');
  const img = document.getElementById('ov-img');
  if (ev.image) {
    imgWrap.style.display = '';
    img.src = ev.image;
    img.alt = ev.title;
    img.onerror = () => { imgWrap.style.display = 'none'; };
  } else {
    imgWrap.style.display = 'none';
  }

  document.getElementById('overlay').classList.remove('page-hidden');
  document.body.style.overflow = 'hidden';
}

function closeOverlay() {
  document.getElementById('overlay').classList.add('page-hidden');
  document.body.style.overflow = '';
}

// ── Go back ───────────────────────────────────────
function goBack() {
  document.getElementById('categories-wrap').innerHTML = '';
  document.getElementById('bday-banner').classList.add('page-hidden');
  showPage('landing');
}

// ── Confetti ──────────────────────────────────────
function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const COLORS = ['#c8a84b','#e8d080','#ffffff','#ff7b7b','#7bd4ff','#a8ff78','#ffb347'];
  for (let i = 0; i < 90; i++) {
    const bit = document.createElement('div');
    bit.className = 'confetti-bit';
    const size = 6 + Math.random() * 9;
    bit.style.cssText = `left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${COLORS[Math.floor(Math.random()*COLORS.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};animation-duration:${2.2+Math.random()*2.5}s;animation-delay:${Math.random()*1.8}s;opacity:${0.7+Math.random()*0.3};`;
    container.appendChild(bit);
  }
  setTimeout(() => { container.innerHTML = ''; }, 7000);
}

// ── Sanitize ──────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Keyboard ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOverlay();
  if (e.key === 'Enter' && ['INPUT','SELECT'].includes(document.activeElement?.tagName)) submitForm();
});
