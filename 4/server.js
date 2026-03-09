// ═══════════════════════════════════════════════════════════════
//  Birthday in History — Server v4
//  Strategy: Wikipedia = primary verified data source
//            Cloudflare AI = enrichment + description only
//  No more timeouts: Wikipedia does all the heavy lifting
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();

const express = require('express');
const https   = require('https');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN  = process.env.CF_API_TOKEN  || '';
// Use the fastest available model
const CF_MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ── HTTPS helper ────────────────────────────────────────────────
function httpsGet(hostname, urlPath, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path: urlPath, method: 'GET',
        headers: { 'User-Agent': 'BirthdayInHistory/4.0 (educational)', 'Accept': 'application/json' } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function httpsPost(hostname, urlPath, headers, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path: urlPath, method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`CF HTTP ${res.statusCode}: ${raw.slice(0,200)}`));
          else { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('CF timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── Cloudflare AI — only used for description enrichment ────────
async function enrichDescription(title, rawText, fullDate) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return rawText;
  try {
    const result = await httpsPost(
      'api.cloudflare.com',
      `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`,
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CF_API_TOKEN}` },
      {
        messages: [
          { role: 'system', content: 'You are a historian. Write clear, engaging historical descriptions. Be factual and specific. No markdown. Plain text only.' },
          { role: 'user', content: `Expand this historical event into 4-5 detailed sentences covering what happened, why it was significant, who was involved, and its lasting impact. Event: "${title}" on ${fullDate}. Context: ${rawText}. Write only the description, nothing else.` }
        ],
        max_tokens: 300,
        temperature: 0.3
      },
      55000
    );
    const text = result?.result?.response?.trim();
    return (text && text.length > 50) ? text : rawText;
  } catch (e) {
    console.log(`  [CF enrich skipped: ${e.message}]`);
    return rawText;
  }
}

// ── Wikipedia helpers ───────────────────────────────────────────
async function wikiOnThisDay(month, day, type) {
  // type: 'events' | 'births' | 'deaths' | 'holidays'
  const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/feed/onthisday/${type}/${month}/${day}`, 12000);
  return data?.[type] || [];
}

async function wikiPageSummary(title) {
  if (!title) return null;
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/page/summary/${encoded}`, 8000);
  if (!data || data.type?.includes('not_found')) return null;
  return {
    image: data.thumbnail?.source || data.originalimage?.source || null,
    url:   data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
    extract: data.extract || null
  };
}

// ── Category detection from Wikipedia event text ────────────────
function detectCategory(text, pages) {
  const t = (text + ' ' + (pages?.[0]?.title || '')).toLowerCase();

  // Sports
  if (/\b(olympic|championship|world cup|grand prix|formula one|f1|nba|nfl|fifa|cricket|tennis|golf|boxing|marathon|tournament|medal|athlete|footballer|soccer|baseball|hockey|wimbledon|superbowl|super bowl|tour de france|ufc|wrestling|swimming|athletics)\b/.test(t))
    return { cat: '⚽ Sports', key: 'sports' };

  // Science & Technology
  if (/\b(launch|rocket|satellite|nasa|space|moon|planet|discovery|inventor|patent|telescope|biology|chemistry|physics|atom|dna|gene|vaccine|medicine|surgery|hospital|laboratory|experiment|computer|internet|software|app|artificial intelligence|ai|robot|technology|engineer)\b/.test(t))
    return { cat: '🧪 Science', key: 'science' };

  // Business & Economy
  if (/\b(stock|market|bank|economy|trade|company|corporation|founded|merger|acquisition|bankruptcy|nasdaq|nyse|wall street|gdp|recession|inflation|finance|investment|ipo|startup|billion|million dollar|revenue|profit)\b/.test(t))
    return { cat: '💼 Business', key: 'business' };

  // Culture & Arts
  if (/\b(film|movie|music|album|song|artist|painter|sculpture|novel|book|publish|theater|theatre|opera|concert|grammy|oscar|emmy|tony|bafta|culture|fashion|television|tv|radio|broadcast|magazine|photograph)\b/.test(t))
    return { cat: '🎬 Culture', key: 'culture' };

  // Politics & World Events (default)
  return { cat: '🌍 World', key: 'world' };
}

// ── Category order and display config ──────────────────────────
const CAT_ORDER = ['🌍 World', '🧪 Science', '💼 Business', '🎬 Culture', '⚽ Sports'];

// ── Year context ────────────────────────────────────────────────
function yearContext(y) {
  y = parseInt(y);
  if (y < 1800) return { population:'~1 billion',    techEra:'Pre-industrial era',       milestone:'Age of Enlightenment and revolutions' };
  if (y < 1850) return { population:'~1.2 billion',  techEra:'Steam & industrial age',   milestone:'Railway and industrial expansion era' };
  if (y < 1900) return { population:'~1.6 billion',  techEra:'Industrial revolution',    milestone:'Steel, steam, and empire expansion' };
  if (y < 1920) return { population:'~1.8 billion',  techEra:'Early electricity era',    milestone:'World wars and rapid industrialization' };
  if (y < 1940) return { population:'~2.3 billion',  techEra:'Radio & aviation age',     milestone:'Great Depression and social transformation' };
  if (y < 1960) return { population:'~2.5 billion',  techEra:'Early electronics era',    milestone:'Post-WWII reconstruction and Cold War' };
  if (y < 1970) return { population:'~3.0 billion',  techEra:'Space race era',           milestone:'Civil rights movement and space exploration' };
  if (y < 1980) return { population:'~3.7 billion',  techEra:'Early computer era',       milestone:'Moon landing and counterculture revolution' };
  if (y < 1990) return { population:'~4.4 billion',  techEra:'Personal computer era',    milestone:'Cold War and computing revolution' };
  if (y < 2000) return { population:'~5.3 billion',  techEra:'Early internet era',       milestone:'WWW launched, digital revolution began' };
  if (y < 2005) return { population:'~6.1 billion',  techEra:'Dot-com era',              milestone:'Wikipedia launched, smartphones emerging' };
  if (y < 2010) return { population:'~6.6 billion',  techEra:'Social media dawn',        milestone:'iPhone launched, social networks took over' };
  if (y < 2015) return { population:'~7.0 billion',  techEra:'Smartphone era',           milestone:'Cloud computing and app economy boomed' };
  if (y < 2020) return { population:'~7.5 billion',  techEra:'AI & big data era',        milestone:'Machine learning and streaming dominated' };
  if (y < 2023) return { population:'~7.9 billion',  techEra:'AI revolution begins',     milestone:'COVID-19 reshaped the world permanently' };
  if (y < 2025) return { population:'~8.0 billion',  techEra:'Generative AI era',        milestone:'ChatGPT transformed every industry globally' };
  return         { population:'~8.2 billion',  techEra:'Agentic AI era',           milestone:'AI agents and climate action dominate headlines' };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Main logic ──────────────────────────────────────────────────
async function buildData(month, day, year) {
  const monthName = MONTHS[month - 1];
  const today = new Date();
  const currentYear = today.getFullYear(); // Dynamic — 2026 etc.

  console.log(`  Fetching Wikipedia "On This Day" for ${monthName} ${day}...`);

  // Fetch ALL Wikipedia on-this-day data in parallel
  const [wikiEvents, wikiBirths] = await Promise.all([
    wikiOnThisDay(month, day, 'events'),
    wikiOnThisDay(month, day, 'births')
  ]);

  console.log(`  Wikipedia returned: ${wikiEvents.length} events, ${wikiBirths.length} births`);

  // ── Separate exact-year events ────────────────────────────────
  const exactYearEvents = wikiEvents.filter(e => parseInt(e.year) === parseInt(year));
  const otherEvents     = wikiEvents.filter(e => parseInt(e.year) !== parseInt(year));

  // Put exact year first, then sort others by recency (most recent first for 2025/2026 coverage)
  const sortedEvents = [
    ...exactYearEvents,
    ...otherEvents.sort((a, b) => b.year - a.year)
  ];

  // Take up to 25 events for categorisation
  const candidateEvents = sortedEvents.slice(0, 25);

  // ── Categorise and build event objects ───────────────────────
  const grouped = {};
  CAT_ORDER.forEach(c => { grouped[c] = []; });

  // Process events — get Wikipedia images in batches
  const eventObjs = candidateEvents.map(e => {
    const page = e.pages?.[0];
    const { cat, key } = detectCategory(e.text || '', e.pages);
    const fullDate = `${monthName} ${day}, ${e.year}`;
    return {
      year:          e.year,
      fullDate,
      title:         page?.title || (e.text?.split('.')[0]?.slice(0, 60)) || 'Historical Event',
      description:   e.text || '',
      category:      cat,
      categoryKey:   key,
      wikipediaTitle: page?.title || null,
      wikiUrl:       page ? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` : '#',
      image:         page?.thumbnail?.source || null,
      isExactYear:   parseInt(e.year) === parseInt(year)
    };
  });

  // Fetch missing images for top events (parallel, fast)
  const needImages = eventObjs.filter(e => !e.image && e.wikipediaTitle).slice(0, 15);
  const imageResults = await Promise.all(
    needImages.map(e => wikiPageSummary(e.wikipediaTitle))
  );
  needImages.forEach((e, i) => {
    if (imageResults[i]?.image) e.image = imageResults[i].image;
    if (imageResults[i]?.url)   e.wikiUrl = imageResults[i].url;
  });

  // ── Enrich descriptions with Cloudflare AI (non-blocking) ────
  // Only enrich top 8 events to stay fast — run in parallel
  const toEnrich = eventObjs.slice(0, 8);
  const enriched = await Promise.allSettled(
    toEnrich.map(e => enrichDescription(e.title, e.description, e.fullDate))
  );
  toEnrich.forEach((e, i) => {
    if (enriched[i].status === 'fulfilled') e.description = enriched[i].value;
  });

  // ── Group by category, max 5 per category ─────────────────────
  eventObjs.forEach(ev => {
    const cat = ev.category;
    if (grouped[cat] && grouped[cat].length < 5) grouped[cat].push(ev);
  });

  // Remove empty categories
  CAT_ORDER.forEach(c => { if (grouped[c].length === 0) delete grouped[c]; });

  const hasExactYear = exactYearEvents.length > 0;

  // ── Famous births ──────────────────────────────────────────────
  const famousPeople = await buildFamousPeople(wikiBirths, monthName, day);

  return { grouped, hasExactYear, famousPeople };
}

async function buildFamousPeople(wikiBirths, monthName, day) {
  // Filter to people with Wikipedia pages and thumbnails — most notable first
  const withPages = wikiBirths.filter(b => b.pages?.length > 0).slice(0, 10);

  const people = await Promise.all(
    withPages.slice(0, 6).map(async b => {
      const page = b.pages[0];
      const wiki = await wikiPageSummary(page.title);
      return {
        name:          page.title,
        year:          b.year,
        fullDate:      `${monthName} ${day}, ${b.year}`,
        profession:    b.text ? b.text.split(',').slice(1, 2).join('').trim().slice(0, 60) : '',
        fact:          b.text || '',
        image:         wiki?.image || page.thumbnail?.source || null,
        wikiUrl:       wiki?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
      };
    })
  );

  return people.filter(p => p.image).slice(0, 4); // prefer people with images
}

// ── API endpoint ────────────────────────────────────────────────
app.post('/api/birthday', async (req, res) => {
  const { name, day, month, year } = req.body;
  if (!name || !day || !month || !year) return res.status(400).json({ error: 'Missing fields' });

  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  const today = new Date();
  const monthName = MONTHS[m - 1];

  if (new Date(y, m - 1, d) > today) return res.json({ type: 'future' });
  const isTodayBirthday = today.getDate() === d && (today.getMonth() + 1) === m;

  console.log(`\n[${new Date().toISOString()}] ${name} — ${monthName} ${d}, ${y}`);

  try {
    const { grouped, hasExactYear, famousPeople } = await buildData(m, d, y);

    const totalEvents = Object.values(grouped).reduce((s, a) => s + a.length, 0);
    console.log(`  ✓ Done: ${totalEvents} events across ${Object.keys(grouped).length} categories`);

    return res.json({
      type: 'success',
      name, day: d, month: m, year: y,
      isTodayBirthday, hasExactYear,
      grouped, famousPeople,
      yearContext: yearContext(y),
      dataNote: `Wikipedia covers events up to ${new Date().getFullYear()}. Very recent events (last few months) may have limited coverage.`
    });
  } catch (err) {
    console.error('  ✗ Error:', err.message);
    return res.status(500).json({ type: 'error', message: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎂  Birthday in History  →  http://localhost:${PORT}`);
  console.log(`   CF Account: ${CF_ACCOUNT_ID ? CF_ACCOUNT_ID.slice(0,8)+'...' : 'NOT SET'}`);
  console.log(`   CF Token:   ${CF_API_TOKEN  ? 'SET ✓' : 'NOT SET'}`);
  console.log(`   Note: Wikipedia covers all years up to present day\n`);
});
