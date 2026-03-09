/* ════════════════════════════════════════════════════
   Birthday in History v4 — Frontend
   ✓ Stunning loader with century scanner
   ✓ 5 categories (World/Science/Business/Culture/Sports)
   ✓ Empty categories hidden automatically
   ✓ Full date on every card + overlay
   ✓ Year context first, greeting second
════════════════════════════════════════════════════ */

// ── Starfield (landing) ──────────────────────────
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

// ── Starfield (loading screen) ───────────────────
let loadingStarAnim = null;
function startLoadingStars() {
  const canvas = document.getElementById('loading-stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
    r: Math.random() * 1.4 + 0.2, a: Math.random() * 0.6 + 0.1,
    speed: Math.random() * 0.003 + 0.001, phase: Math.random() * Math.PI * 2
  }));
  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      const alpha = s.a * (0.3 + 0.7 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,168,75,${alpha * 0.5})`; ctx.fill();
    });
    loadingStarAnim = requestAnimationFrame(draw);
  }
  loadingStarAnim = requestAnimationFrame(draw);
}

// ── Dropdowns ────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const CAT_META = {
  '🌍 World':    { key:'world',    icon:'🌍', label:'World Events' },
  '🧪 Science':  { key:'science',  icon:'🧪', label:'Science & Technology' },
  '💼 Business': { key:'business', icon:'💼', label:'Business & Economy' },
  '🎬 Culture':  { key:'culture',  icon:'🎬', label:'Culture & Arts' },
  '⚽ Sports':   { key:'sports',   icon:'⚽', label:'Sports' }
};
const CAT_ORDER = ['🌍 World','🧪 Science','💼 Business','🎬 Culture','⚽ Sports'];

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
const LOADER_STEPS = [
  { msg: 'Opening historical archives…',       icon: '📜', century: 'cen-ancient'  },
  { msg: 'Scanning ancient & medieval times…', icon: '🏛️', century: 'cen-medieval' },
  { msg: 'Searching the 1800s…',               icon: '⚙️', century: 'cen-1800'    },
  { msg: 'Scanning the 1900s…',                icon: '📻', century: 'cen-1900'    },
  { msg: 'Scanning 2000–2020…',                icon: '💻', century: 'cen-2000'    },
  { msg: 'Checking 2020s & recent events…',    icon: '🤖', century: 'cen-2020'    },
  { msg: 'Verifying Wikipedia sources…',       icon: '✅', century: null           },
  { msg: 'Enriching descriptions with AI…',   icon: '✨', century: null           },
];

function animateLoader() {
  const msgEl   = document.getElementById('loader-msg');
  const fillEl  = document.getElementById('loader-fill');
  const iconEl  = document.getElementById('loader-icon');
  const cenItems = document.querySelectorAll('.century-item');

  fillEl.style.width = '0%';
  let i = 0;
  const total = LOADER_STEPS.length;

  return new Promise(resolve => {
    const tick = () => {
      const step = LOADER_STEPS[i];

      // Update message + icon
      msgEl.style.opacity = '0';
      setTimeout(() => {
        msgEl.textContent = step.msg;
        iconEl.textContent = step.icon;
        msgEl.style.opacity = '1';
      }, 150);

      // Update progress bar
      fillEl.style.width = `${((i + 1) / total) * 100}%`;

      // Update century scanner
      if (step.century) {
        cenItems.forEach(el => {
          if (el.id === step.century) el.classList.add('scanning');
          else if (el.classList.contains('scanning')) {
            el.classList.remove('scanning');
            el.classList.add('done');
          }
        });
      }

      i++;
      if (i < total) setTimeout(tick, 420);
      else {
        // Mark all done
        cenItems.forEach(el => { el.classList.remove('scanning'); el.classList.add('done'); });
        setTimeout(resolve, 500);
      }
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

  document.getElementById('explore-btn').disabled = true;
  showPage('loading');
  startLoadingStars();

  const [data] = await Promise.all([
    fetchBirthday(name, day, month, parseInt(year)),
    animateLoader()
  ]);

  if (loadingStarAnim) cancelAnimationFrame(loadingStarAnim);
  document.getElementById('explore-btn').disabled = false;
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
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    return await r.json();
  } catch (e) {
    return { type: 'error', message: e.message };
  }
}

// ── Render ────────────────────────────────────────
function render(data) {
  ['msg-future','msg-error','success'].forEach(id =>
    document.getElementById(id).classList.add('page-hidden')
  );

  if (data.type === 'future') {
    document.getElementById('msg-future').classList.remove('page-hidden');
    return;
  }
  if (data.type === 'error' || !data.grouped) {
    document.getElementById('msg-error-text').textContent = data.message || 'Could not load events. Check Cloudflare credentials.';
    document.getElementById('msg-error').classList.remove('page-hidden');
    return;
  }

  document.getElementById('success').classList.remove('page-hidden');

  // Birthday banner
  if (data.isTodayBirthday) {
    document.getElementById('bday-title').textContent = `🎉 Happy Birthday, ${data.name}!`;
    document.getElementById('bday-banner').classList.remove('page-hidden');
    launchConfetti();
  }

  // 1. Year context FIRST
  document.getElementById('ctx-year').textContent = data.year;
  const c = data.yearContext;
  document.getElementById('ctx-pills').innerHTML = `
    <div class="ctx-pill"><span class="ctx-pill-icon">🌍</span>${c.population}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">💻</span>${c.techEra}</div>
    <div class="ctx-pill"><span class="ctx-pill-icon">✨</span>${c.milestone}</div>`;

  // 2. Greeting SECOND
  document.getElementById('greeting').textContent =
    `Hey ${data.name}, here are some remarkable moments in history that share your birthday.`;

  // 3. Data note
  const note = document.getElementById('data-note');
  if (data.dataNote) { note.textContent = `ℹ️  ${data.dataNote}`; note.style.display = 'inline-block'; }
  else note.style.display = 'none';

  // 4. Categories
  renderCategories(data.grouped);

  // 5. Famous people
  renderFamous(data.famousPeople);
}

// ── Category sections ─────────────────────────────
function renderCategories(grouped) {
  const wrap = document.getElementById('categories-wrap');
  wrap.innerHTML = '';

  CAT_ORDER.forEach((cat, ci) => {
    const events = grouped[cat];
    // Skip empty categories entirely
    if (!events || events.length === 0) return;

    const meta = CAT_META[cat];
    const section = document.createElement('div');
    section.className = 'cat-section';
    section.dataset.cat = meta.key;
    section.style.animationDelay = `${ci * 0.08}s`;

    section.innerHTML = `
      <div class="cat-header">
        <div class="cat-icon-wrap">${meta.icon}</div>
        <span class="cat-title">${meta.label}</span>
        <span class="cat-count">${events.length} event${events.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="cat-row"></div>`;

    const row = section.querySelector('.cat-row');
    events.forEach((ev, i) => row.appendChild(buildEventCard(ev, i)));
    wrap.appendChild(section);
  });
}

// ── Build event card ──────────────────────────────
const FALLBACK_EMOJI = { world:'🌍', science:'🔬', business:'💼', culture:'🎬', sports:'⚽' };

function buildEventCard(ev, i) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.style.animationDelay = `${i * 0.06}s`;

  const fe = FALLBACK_EMOJI[ev.categoryKey] || '🌍';
  const imgHTML = ev.image
    ? `<img src="${ev.image}" alt="${sanitize(ev.title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'ev-fallback\\'>${fe}</div>'">`
    : `<div class="ev-fallback">${fe}</div>`;

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
    card.href = p.wikiUrl || '#';
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

// ── Overlay ───────────────────────────────────────
function openOverlay(ev) {
  document.getElementById('ov-full-date').textContent = ev.fullDate || String(ev.year);
  document.getElementById('ov-title').textContent     = ev.title;
  document.getElementById('ov-cat').textContent       = ev.category || '';
  document.getElementById('ov-desc').textContent      = ev.description;
  document.getElementById('ov-link').href             = ev.wikiUrl || '#';

  const imgWrap = document.getElementById('ov-img-wrap');
  const img     = document.getElementById('ov-img');
  if (ev.image) {
    imgWrap.style.display = ''; img.src = ev.image; img.alt = ev.title;
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
  // Reset century strip
  document.querySelectorAll('.century-item').forEach(el => {
    el.classList.remove('scanning','done');
  });
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
    bit.style.cssText = `left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${COLORS[~~(Math.random()*COLORS.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${2.2+Math.random()*2.5}s;animation-delay:${Math.random()*1.8}s;opacity:${0.7+Math.random()*.3};`;
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
