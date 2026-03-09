// ═══════════════════════════════════════════════════════════════
//  Birthday in History — Server v5 (Final)
//  ✓ No dataNote shown to user
//  ✓ Population pill has "Population:" prefix
//  ✓ Famous people: up to 10, Indian priority (max 3)
//  ✓ Elaborate 6-8 sentence enriched descriptions
//  ✓ Smarter category detection
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
const CF_MODEL      = '@cf/meta/llama-3.1-8b-instruct';

// ── HTTPS helpers ────────────────────────────────────────────────
function httpsGet(hostname, urlPath, timeoutMs = 12000) {
  return new Promise(resolve => {
    const req = https.request(
      { hostname, path: urlPath, method: 'GET',
        headers: { 'User-Agent': 'BirthdayInHistory/5.0 (educational)', 'Accept': 'application/json' } },
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

function httpsPost(hostname, urlPath, headers, body, timeoutMs = 55000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path: urlPath, method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`CF HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
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

// ── Cloudflare AI: elaborate 6-8 sentence description ───────────
async function enrichDescription(title, rawText, fullDate) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return rawText;
  try {
    const result = await httpsPost(
      'api.cloudflare.com',
      `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`,
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CF_API_TOKEN}` },
      {
        messages: [
          {
            role: 'system',
            content: 'You are a world-class historian and storyteller. Write vivid, detailed, factually accurate historical descriptions in flowing prose. No markdown, no bullet points, no headers. Just plain compelling paragraphs.'
          },
          {
            role: 'user',
            content: `Write a rich 6-8 sentence description of this historical event. Cover: (1) exactly what happened and where, (2) key people involved and their roles, (3) the immediate global reaction and significance, (4) long-term impact on history and society, (5) any surprising or lesser-known facts about it.

Event: "${title}"
Date: ${fullDate}
Context from Wikipedia: ${rawText}

Write only the description paragraph itself — no title, no date, no intro phrase.`
          }
        ],
        max_tokens: 500,
        temperature: 0.25
      }
    );
    const text = result?.result?.response?.trim();
    return (text && text.length > 80) ? text : rawText;
  } catch (e) {
    console.log(`  [CF enrich skipped: ${e.message}]`);
    return rawText;
  }
}

// ── Wikipedia helpers ────────────────────────────────────────────
async function wikiOnThisDay(month, day, type) {
  const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/feed/onthisday/${type}/${month}/${day}`);
  return data?.[type] || [];
}

async function wikiPageSummary(title) {
  if (!title) return null;
  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/page/summary/${encoded}`, 8000);
  if (!data || data.type?.includes('not_found')) return null;
  return {
    image:   data.thumbnail?.source || data.originalimage?.source || null,
    url:     data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
    extract: data.extract || null
  };
}

// ── Smarter category detection ───────────────────────────────────
function detectCategory(text, pages) {
  const pageTitle = (pages?.[0]?.title || '').toLowerCase();
  const t = (text + ' ' + pageTitle).toLowerCase();

  // Sports — check first, most specific
  if (/\b(olympic|olympics|world cup|grand prix|formula.?one|f1|nba|nfl|nhl|mlb|fifa|icc|bcci|cricket|test match|odi|t20|tennis|golf|boxing|marathon|world championship|gold medal|athlete|footballer|soccer|baseball|hockey|wimbledon|super.?bowl|tour de france|ufc|mma|wrestling|swimming|athletics|rugby|cycling|motorsport|racing|horse racing|commonwealth games|asian games)\b/.test(t))
    return { cat: '⚽ Sports', key: 'sports' };

  // Science & Technology
  if (/\b(launch|rocket|satellite|nasa|space|moon|planet|asteroid|comet|telescope|biology|chemistry|physics|nuclear|atom|dna|gene|genome|vaccine|virus|pandemic|epidemic|medicine|surgery|hospital|laboratory|experiment|computer|internet|software|website|app|artificial intelligence|machine learning|robot|technology|engineer|invention|discovery|patent|mathematics|algorithm)\b/.test(t))
    return { cat: '🧪 Science', key: 'science' };

  // Business & Economy
  if (/\b(stock|market|wall street|nasdaq|nyse|sensex|nifty|bank|central bank|reserve bank|rbi|economy|trade|company|corporation|conglomerate|founded|merger|acquisition|bankruptcy|gdp|recession|inflation|finance|investment|ipo|startup|revenue|profit|oil|petroleum|opec|sanctions|tariff|currency|dollar|euro|rupee)\b/.test(t))
    return { cat: '💼 Business', key: 'business' };

  // Culture & Arts
  if (/\b(film|movie|cinema|music|album|song|artist|painter|sculpture|novelist|novel|book|publish|theater|theatre|opera|concert|grammy|oscar|academy award|emmy|tony|bafta|culture|fashion|television|tv series|radio|broadcast|magazine|photograph|architecture|heritage|festival|dance|choreograph|director|actor|actress)\b/.test(t))
    return { cat: '🎬 Culture', key: 'culture' };

  // Default: World/Politics
  return { cat: '🌍 World', key: 'world' };
}

const CAT_ORDER = ['🌍 World', '🧪 Science', '💼 Business', '🎬 Culture', '⚽ Sports'];

// ── Year context — population label included ─────────────────────
function yearContext(y) {
  y = parseInt(y);
  if (y < 1800) return { population:'~1 billion',   techEra:'Pre-industrial era',      milestone:'Age of Enlightenment and revolutions' };
  if (y < 1850) return { population:'~1.2 billion', techEra:'Steam & industrial age',  milestone:'Railway and industrial expansion era' };
  if (y < 1900) return { population:'~1.6 billion', techEra:'Industrial revolution',   milestone:'Steel, steam, and empire expansion' };
  if (y < 1920) return { population:'~1.8 billion', techEra:'Early electricity era',   milestone:'World wars and rapid industrialization' };
  if (y < 1940) return { population:'~2.3 billion', techEra:'Radio & aviation age',    milestone:'Great Depression and social transformation' };
  if (y < 1960) return { population:'~2.5 billion', techEra:'Early electronics era',   milestone:'Post-WWII reconstruction and Cold War' };
  if (y < 1970) return { population:'~3.0 billion', techEra:'Space race era',          milestone:'Civil rights movement and space exploration' };
  if (y < 1980) return { population:'~3.7 billion', techEra:'Early computer era',      milestone:'Moon landing and counterculture revolution' };
  if (y < 1990) return { population:'~4.4 billion', techEra:'Personal computer era',   milestone:'Cold War and computing revolution' };
  if (y < 2000) return { population:'~5.3 billion', techEra:'Early internet era',      milestone:'WWW launched, digital revolution began' };
  if (y < 2005) return { population:'~6.1 billion', techEra:'Dot-com era',             milestone:'Wikipedia launched, smartphones emerging' };
  if (y < 2010) return { population:'~6.6 billion', techEra:'Social media dawn',       milestone:'iPhone launched, social networks took over' };
  if (y < 2015) return { population:'~7.0 billion', techEra:'Smartphone era',          milestone:'Cloud computing and app economy boomed' };
  if (y < 2020) return { population:'~7.5 billion', techEra:'AI & big data era',       milestone:'Machine learning and streaming dominated' };
  if (y < 2023) return { population:'~7.9 billion', techEra:'AI revolution begins',    milestone:'COVID-19 reshaped the world permanently' };
  if (y < 2025) return { population:'~8.0 billion', techEra:'Generative AI era',       milestone:'ChatGPT transformed every industry globally' };
  return         { population:'~8.2 billion', techEra:'Agentic AI era',          milestone:'AI agents and climate action dominate headlines' };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Indian nationality detection ─────────────────────────────────
function isIndian(text, pageTitle) {
  const t = (text + ' ' + pageTitle).toLowerCase();
  return /\b(india|indian|bollywood|cricket india|ipl|national cricket team|mumbai|delhi|kolkata|chennai|bangalore|bengaluru|hyderabad|pune|jaipur|hindi film|tamil film|telugu film|kannada|malayalam film|bharatnatyam|carnatic|hindustani|indian national congress|bjp|nehru|gandhi|modi|tata|ambani|infosys|wipro|reliance)\b/.test(t);
}

// ── Build famous people: up to 10, max 3 Indians ────────────────
async function buildFamousPeople(wikiBirths, monthName, day) {
  const withPages = wikiBirths.filter(b => b.pages?.length > 0);

  // Separate Indians and others
  const indians = [];
  const others  = [];

  for (const b of withPages) {
    const page = b.pages[0];
    const text = b.text || '';
    if (isIndian(text, page.title)) indians.push(b);
    else others.push(b);
  }

  // Pick max 3 Indians, fill rest with others, total up to 10
  const selectedIndians = indians.slice(0, 3);
  const remaining = 10 - selectedIndians.length;
  const selectedOthers = others.slice(0, remaining);
  const selected = [...selectedIndians, ...selectedOthers].slice(0, 10);

  console.log(`  Famous people: ${selectedIndians.length} Indian(s), ${selectedOthers.length} other(s)`);

  // Fetch images in parallel
  const people = await Promise.all(
    selected.map(async b => {
      const page = b.pages[0];
      const wiki = await wikiPageSummary(page.title);
      // Extract profession from text: "Name, profession, ..."
      const textParts = (b.text || '').split(',');
      const profession = textParts.slice(1, 2).join('').trim().slice(0, 70);
      return {
        name:       page.title,
        year:       b.year,
        fullDate:   `${monthName} ${day}, ${b.year}`,
        profession,
        fact:       b.text || '',
        image:      wiki?.image || page.thumbnail?.source || null,
        wikiUrl:    wiki?.url   || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
      };
    })
  );

  // Return all 10 (with or without image)
  return people.slice(0, 10);
}

// ── Build events ─────────────────────────────────────────────────
async function buildData(month, day, year) {
  const monthName = MONTHS[month - 1];

  console.log(`  Fetching Wikipedia for ${monthName} ${day}...`);

  const [wikiEvents, wikiBirths] = await Promise.all([
    wikiOnThisDay(month, day, 'events'),
    wikiOnThisDay(month, day, 'births')
  ]);

  console.log(`  Wikipedia: ${wikiEvents.length} events, ${wikiBirths.length} births`);

  // Exact year first, then rest sorted newest-first
  const exactYearEvents = wikiEvents.filter(e => parseInt(e.year) === parseInt(year));
  const otherEvents     = wikiEvents.filter(e => parseInt(e.year) !== parseInt(year))
                                    .sort((a, b) => b.year - a.year);

  const candidateEvents = [...exactYearEvents, ...otherEvents].slice(0, 30);

  // Build event objects
  const eventObjs = candidateEvents.map(e => {
    const page = e.pages?.[0];
    const { cat, key } = detectCategory(e.text || '', e.pages);
    return {
      year:           e.year,
      fullDate:       `${monthName} ${day}, ${e.year}`,
      title:          page?.title || e.text?.split('.')[0]?.slice(0, 60) || 'Historical Event',
      description:    e.text || '',
      category:       cat,
      categoryKey:    key,
      wikipediaTitle: page?.title || null,
      wikiUrl:        page ? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` : '#',
      image:          page?.thumbnail?.source || null,
      isExactYear:    parseInt(e.year) === parseInt(year)
    };
  });

  // Fetch missing images (top 15, parallel)
  const needImages = eventObjs.filter(e => !e.image && e.wikipediaTitle).slice(0, 15);
  const imgResults = await Promise.all(needImages.map(e => wikiPageSummary(e.wikipediaTitle)));
  needImages.forEach((e, i) => {
    if (imgResults[i]?.image) e.image   = imgResults[i].image;
    if (imgResults[i]?.url)   e.wikiUrl = imgResults[i].url;
  });

  // Enrich top 8 descriptions with CF AI
  const toEnrich = eventObjs.slice(0, 8);
  const enriched = await Promise.allSettled(
    toEnrich.map(e => enrichDescription(e.title, e.description, e.fullDate))
  );
  toEnrich.forEach((e, i) => {
    if (enriched[i].status === 'fulfilled') e.description = enriched[i].value;
  });

  // Group by category, max 5 per category
  const grouped = {};
  CAT_ORDER.forEach(c => { grouped[c] = []; });
  eventObjs.forEach(ev => {
    if (grouped[ev.category] && grouped[ev.category].length < 5) grouped[ev.category].push(ev);
  });
  // Remove empty
  CAT_ORDER.forEach(c => { if (grouped[c].length === 0) delete grouped[c]; });

  const famousPeople = await buildFamousPeople(wikiBirths, monthName, day);

  return { grouped, hasExactYear: exactYearEvents.length > 0, famousPeople };
}

// ── API ──────────────────────────────────────────────────────────
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
    const total = Object.values(grouped).reduce((s, a) => s + a.length, 0);
    console.log(`  ✓ ${total} events, ${Object.keys(grouped).length} categories, ${famousPeople.length} famous people`);

    return res.json({
      type: 'success',
      name, day: d, month: m, year: y,
      isTodayBirthday, hasExactYear,
      grouped, famousPeople,
      yearContext: yearContext(y)
      // dataNote removed — no note shown to users
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
  console.log(`   CF: ${CF_ACCOUNT_ID ? CF_ACCOUNT_ID.slice(0,8)+'...' : 'NOT SET'} | Token: ${CF_API_TOKEN ? '✓' : '✗'}\n`);
});
