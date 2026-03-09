/* ════════════════════════════════════════════════════
   Birthday in History — Frontend Script
   All features: starfield, loading, timeline, theatre,
   confetti, skeleton, famous people, year context
════════════════════════════════════════════════════ */

// ── Starfield canvas ──────────────────────────────
(function initStars() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.004 + 0.002,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      const alpha = s.a * (0.4 + 0.6 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();

// ── Dropdown population ───────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

(function populateDropdowns() {
  const dayEl = document.getElementById('inp-day');
  const monEl = document.getElementById('inp-month');
  for (let d = 1; d <= 31; d++) {
    const o = new Option(d < 10 ? `0${d}` : d, d);
    dayEl.add(o);
  }
  MONTHS.forEach((m, i) => monEl.add(new Option(m, i + 1)));
})();

// ── Page switching ────────────────────────────────
function showPage(id) {
  ['landing','loading','results'].forEach(p => {
    const el = document.getElementById(p);
    if (p === id) el.classList.remove('page-hidden');
    else el.classList.add('page-hidden');
  });
  window.scrollTo(0, 0);
}

// ── Loading messages ──────────────────────────────
const LOADING_MSGS = [
  'Opening historical archives…',
  'Scanning the 21st century…',
  'Scanning the 20th century…',
  'Scanning the 19th century…',
  'Searching global events…',
  'Finding famous people born on your day…',
  'Building your birthday timeline…'
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
        if (i < total) setTimeout(tick, 320);
        else setTimeout(resolve, 450);
      }, 180);
    };
    tick();
  });
}

// ── Submit form ───────────────────────────────────
async function submitForm() {
  const name  = document.getElementById('inp-name').value.trim();
  const day   = parseInt(document.getElementById('inp-day').value);
  const month = parseInt(document.getElementById('inp-month').value);
  const year  = document.getElementById('inp-year').value.trim();
  const errEl = document.getElementById('form-err');

  errEl.textContent = '';
  if (!name)            { errEl.textContent = 'Please enter your name.'; return; }
  if (!year)            { errEl.textContent = 'Please enter your birth year.'; return; }
  if (isNaN(year) || parseInt(year) < 1 || parseInt(year) > 2099)
                        { errEl.textContent = 'Please enter a valid year (e.g. 2001).'; return; }

  const btn = document.getElementById('explore-btn');
  btn.disabled = true;

  showPage('loading');

  // Fire API + animation in parallel
  const [data] = await Promise.all([
    fetchBirthday(name, day, month, parseInt(year)),
    animateLoader()
  ]);

  btn.disabled = false;
  render(data);
  showPage('results');
}

// ── Fetch from backend ────────────────────────────
async function fetchBirthday(name, day, month, year) {
  try {
    const r = await fetch('/api/birthday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, day, month, year })
    });
    if (!r.ok) throw new Error('Server error');
    return await r.json();
  } catch (e) {
    return { type: 'error' };
  }
}

// ── Render results ────────────────────────────────
function render(data) {
  // Hide all message states
  ['msg-future','msg-error','success'].forEach(id =>
    document.getElementById(id).classList.add('page-hidden')
  );

  if (data.type === 'future') {
    document.getElementById('msg-future').classList.remove('page-hidden');
    return;
  }
  if (data.type === 'error' || !data.events) {
    document.getElementById('msg-error').classList.remove('page-hidden');
    return;
  }

  document.getElementById('success').classList.remove('page-hidden');

  // 🎂 Birthday banner
  const banner = document.getElementById('bday-banner');
  if (data.isTodayBirthday) {
    document.getElementById('bday-title').textContent = `🎉 Happy Birthday, ${data.name}!`;
    banner.classList.remove('page-hidden');
    launchConfetti();
  } else {
    banner.classList.add('page-hidden');
  }

  // Greeting
  document.getElementById('greeting').textContent =
    `Hey ${data.name}, here are some remarkable moments in history that share your birthday.`;

  // Year context
  document.getElementById('ctx-year').textContent = data.year;
  const pills = document.getElementById('ctx-pills');
  const c = data.yearContext;
  pills.innerHTML = `
    <div class="ctx-pill"><span class="ctx-pill-icon">🌍</span> World population ${c.population}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">💻</span> ${c.techEra}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">✨</span> ${c.milestone}</div>`;

  // Fallback note
  const fallback = document.getElementById('fallback-note');
  if (!data.hasExactYear) fallback.classList.remove('page-hidden');
  else fallback.classList.add('page-hidden');

  // Timeline + Cards
  renderTimeline(data.events);
  renderEventCards(data.events);
  renderFamous(data.famousPeople);
}

// ── Timeline ──────────────────────────────────────
function renderTimeline(events) {
  const tl = document.getElementById('timeline');
  tl.innerHTML = '';
  events.forEach((ev, i) => {
    const node = document.createElement('div');
    node.className = 'tl-node';
    node.innerHTML = `<div class="tl-dot"></div><div class="tl-year">${ev.year}</div>`;
    node.addEventListener('click', () => {
      document.querySelectorAll('.tl-node').forEach(n => n.classList.remove('active'));
      node.classList.add('active');
      const card = document.getElementById(`ev-${i}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlighted');
        setTimeout(() => card.classList.remove('highlighted'), 1600);
      }
    });
    tl.appendChild(node);
    if (i < events.length - 1) {
      const line = document.createElement('div');
      line.className = 'tl-line';
      tl.appendChild(line);
    }
  });
}

// ── Category fallback emoji ───────────────────────
const CAT_EMOJI = { world: '🌍', science: '🔬', culture: '🎬', sports: '⚽' };

// ── Event Cards ───────────────────────────────────
function renderEventCards(events) {
  // Hide skeletons
  document.getElementById('skeletons').classList.add('page-hidden');
  const list = document.getElementById('events-list');
  list.innerHTML = '';

  events.forEach((ev, i) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.id = `ev-${i}`;
    card.style.animationDelay = `${i * 0.07}s`;

    const fallbackEmoji = CAT_EMOJI[ev.categoryKey] || '🌍';
    const imgHTML = ev.image
      ? `<img src="${ev.image}" alt="${sanitize(ev.title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'ev-fallback\\'>${fallbackEmoji}</div>'" />`
      : `<div class="ev-fallback">${fallbackEmoji}</div>`;

    card.innerHTML = `
      <div class="ev-img-col">${imgHTML}</div>
      <div class="ev-body">
        <div>
          <div class="ev-top">
            <span class="ev-year">${ev.year}</span>
            <span class="ev-cat">${ev.category || '🌍 World'}</span>
          </div>
          <h3 class="ev-title">${sanitize(ev.title)}</h3>
          <p class="ev-desc">${sanitize(ev.description)}</p>
        </div>
        <p class="ev-hint">CLICK TO EXPLORE →</p>
      </div>`;

    card.addEventListener('click', () => openOverlay(ev));
    list.appendChild(card);
  });
}

// ── Famous People ─────────────────────────────────
function renderFamous(people) {
  const block = document.getElementById('famous-block');
  const grid = document.getElementById('famous-grid');

  if (!people || people.length === 0) { block.classList.add('page-hidden'); return; }
  block.classList.remove('page-hidden');
  grid.innerHTML = '';

  people.forEach((p, i) => {
    const card = document.createElement('a');
    card.className = 'famous-card';
    card.href = p.wikipediaTitle
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipediaTitle)}`
      : '#';
    card.target = '_blank'; card.rel = 'noopener';
    card.style.animationDelay = `${i * 0.08}s`;

    const role = p.profession || (p.fact ? p.fact.split('.')[0] : '');
    const imgHTML = p.image
      ? `<img class="fc-img" src="${p.image}" alt="${sanitize(p.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'fc-fallback\\'>👤</div>'" />`
      : `<div class="fc-fallback">👤</div>`;

    card.innerHTML = `
      ${imgHTML}
      <p class="fc-name">${sanitize(p.name)}</p>
      <p class="fc-year">Born ${p.year}</p>
      <p class="fc-role">${sanitize(role)}</p>`;

    grid.appendChild(card);
  });
}

// ── Theatre Overlay ───────────────────────────────
function openOverlay(ev) {
  document.getElementById('ov-year').textContent  = ev.year;
  document.getElementById('ov-title').textContent = ev.title;
  document.getElementById('ov-desc').textContent  = ev.description;
  document.getElementById('ov-link').href         = ev.wikiUrl || '#';

  const imgWrap = document.getElementById('ov-img-wrap');
  const img = document.getElementById('ov-img');
  if (ev.image) {
    img.src = ev.image;
    imgWrap.style.display = '';
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
  document.getElementById('skeletons').classList.remove('page-hidden');
  document.getElementById('events-list').innerHTML = '';
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
    bit.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${size}px; height: ${size}px;
      background: ${COLORS[Math.floor(Math.random() * COLORS.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${2.2 + Math.random() * 2.5}s;
      animation-delay: ${Math.random() * 1.8}s;
      opacity: ${0.7 + Math.random() * 0.3};`;
    container.appendChild(bit);
  }
  setTimeout(() => { container.innerHTML = ''; }, 7000);
}

// ── XSS helper ────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Keyboard shortcuts ────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOverlay();
  if (e.key === 'Enter') {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') submitForm();
  }
});
