// ═══════════════════════════════════════════════════════════════
//  Birthday in History — Server v3
//  AI: Cloudflare Workers AI (llama-3.3-70b)
//  Images: Wikipedia REST API (no key needed)
//  Features: exact DOB first, categories, verified dates
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const https = require('https');
const path = require('path');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Cloudflare config (filled by user — see SETUP.md) ──────────
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'YOUR_ACCOUNT_ID';
const CF_API_TOKEN  = process.env.CF_API_TOKEN  || 'YOUR_API_TOKEN';
const CF_MODEL      = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// ── Built-in HTTPS helpers ──────────────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = { ...options };
    if (payload) {
      opts.headers = { ...opts.headers, 'Content-Length': Buffer.byteLength(payload) };
    }
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
        } else {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Cloudflare Workers AI call ──────────────────────────────────
async function askCF(systemPrompt, userPrompt, maxTokens = 3000) {
  const data = await httpsRequest(
    {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CF_API_TOKEN}`
      }
    },
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.2
    }
  );

  let text = '';
  if (data?.result?.response) text = data.result.response;
  else if (typeof data === 'string') text = data;
  else throw new Error('Unexpected CF response: ' + JSON.stringify(data).slice(0, 200));

  // Strip markdown fences if any
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  // Extract JSON array or object if there's surrounding text
  const arrMatch = text.match(/\[[\s\S]*\]/);
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (arrMatch) return arrMatch[0];
  if (objMatch) return objMatch[0];
  return text;
}

// ── Wikipedia: verify article exists + get image ───────────────
async function wikiLookup(title) {
  if (!title) return { exists: false, image: null, url: null };
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const data = await httpsRequest({
      hostname: 'en.wikipedia.org',
      path: `/api/rest_v1/page/summary/${encoded}`,
      method: 'GET',
      headers: { 'User-Agent': 'BirthdayInHistory/2.0 (educational)' }
    });
    if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
      return { exists: false, image: null, url: null };
    }
    return {
      exists: true,
      image: data.thumbnail?.source || data.originalimage?.source || null,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
      extract: data.extract || null
    };
  } catch { return { exists: false, image: null, url: null }; }
}

// ── Wikipedia "On This Day" — real verified events ─────────────
async function wikiOnThisDay(month, day, type = 'events') {
  try {
    const data = await httpsRequest({
      hostname: 'en.wikipedia.org',
      path: `/api/rest_v1/feed/onthisday/${type}/${month}/${day}`,
      method: 'GET',
      headers: { 'User-Agent': 'BirthdayInHistory/2.0 (educational)' }
    });
    return data?.[type] || [];
  } catch { return []; }
}

// ── Year context ────────────────────────────────────────────────
function yearContext(y) {
  y = parseInt(y);
  const now = new Date().getFullYear();
  if (y < 1800) return { population:'~1 billion', techEra:'Pre-industrial era', milestone:'Age of Enlightenment and revolutions' };
  if (y < 1850) return { population:'~1.2 billion', techEra:'Steam & industrial age', milestone:'Railway and industrial expansion era' };
  if (y < 1900) return { population:'~1.6 billion', techEra:'Industrial revolution era', milestone:'Steel, steam, and empire expansion' };
  if (y < 1920) return { population:'~1.8 billion', techEra:'Early electricity era', milestone:'World wars and rapid industrialization' };
  if (y < 1940) return { population:'~2.3 billion', techEra:'Radio & aviation age', milestone:'Great Depression and social transformation' };
  if (y < 1960) return { population:'~2.5 billion', techEra:'Early electronics era', milestone:'Post-WWII reconstruction and Cold War' };
  if (y < 1970) return { population:'~3.0 billion', techEra:'Space race era', milestone:'Civil rights movement and space exploration' };
  if (y < 1980) return { population:'~3.7 billion', techEra:'Early computer era', milestone:'Moon landing and counterculture revolution' };
  if (y < 1990) return { population:'~4.4 billion', techEra:'Personal computer era', milestone:'Cold War and personal computing revolution' };
  if (y < 2000) return { population:'~5.3 billion', techEra:'Early internet era', milestone:'World Wide Web launched, digital revolution began' };
  if (y < 2005) return { population:'~6.1 billion', techEra:'Dot-com and broadband era', milestone:'Wikipedia launched, smartphones emerging' };
  if (y < 2010) return { population:'~6.6 billion', techEra:'Social media dawn', milestone:'iPhone launched, social networks took over' };
  if (y < 2015) return { population:'~7.0 billion', techEra:'Smartphone era', milestone:'Cloud computing and the app economy boomed' };
  if (y < 2020) return { population:'~7.5 billion', techEra:'AI and big data era', milestone:'Machine learning and streaming dominated culture' };
  if (y < 2023) return { population:'~7.9 billion', techEra:'AI revolution begins', milestone:'COVID-19 reshaped the world, remote work became normal' };
  if (y < 2025) return { population:'~8.0 billion', techEra:'Generative AI era', milestone:'ChatGPT transformed every industry globally' };
  return { population:'~8.2 billion', techEra:'Agentic AI era', milestone:'AI agents, climate action, and geopolitical realignment define the era' };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORIES = ['🌍 World', '🧪 Science', '🎬 Culture', '⚽ Sports'];
const CAT_KEYS   = { '🌍 World':'world', '🧪 Science':'science', '🎬 Culture':'culture', '⚽ Sports':'sports' };

// ── Build events from Wikipedia On This Day + AI enrichment ────
async function buildEvents(month, day, year) {
  const monthName = MONTHS[month - 1];
  const currentYear = new Date().getFullYear(); // 2026 or current

  // Step 1: Get all Wikipedia verified events for this day
  const [wikiEvents, wikiBirths] = await Promise.all([
    wikiOnThisDay(month, day, 'events'),
    wikiOnThisDay(month, day, 'births')
  ]);

  // Step 2: Check if exact DOB year has any wiki event
  const exactYearWikiEvents = wikiEvents.filter(e => e.year === year);
  const hasExactYear = exactYearWikiEvents.length > 0;

  // Step 3: Build a verified event list from Wikipedia (real data)
  // Prioritise: exact year first, then others sorted by interest
  const allWikiEvents = [
    ...exactYearWikiEvents,
    ...wikiEvents.filter(e => e.year !== year)
  ].slice(0, 20); // take up to 20 for AI to pick from

  // Format wiki events for AI
  const wikiEventList = allWikiEvents.map(e => {
    const page = e.pages?.[0];
    return `- Year ${e.year}: ${e.text} [Wikipedia: ${page?.title || 'N/A'}]`;
  }).join('\n');

  // Step 4: Ask AI to categorise and enrich — ONLY from verified wiki list
  const systemPrompt = `You are a historian. You ONLY use events from the provided verified Wikipedia list. 
Never invent events. Never add events not in the list.
Respond ONLY with raw JSON array, no markdown, no explanation.
Today is ${MONTHS[new Date().getMonth()]} ${new Date().getDate()}, ${currentYear}.`;

  const userPrompt = `From this VERIFIED Wikipedia list of events on ${monthName} ${day}, select the best ones and categorise them.
${year ? `PRIORITY: If year ${year} has events, include ALL of them first.` : ''}

VERIFIED EVENTS FROM WIKIPEDIA:
${wikiEventList || 'No Wikipedia events found for this date.'}

Return a JSON array. For each event include:
{
  "year": 1969,
  "fullDate": "${monthName} ${day}, 1969",
  "title": "Short title (max 8 words)",
  "description": "4-5 detailed sentences explaining what happened, why it mattered, and its lasting impact. Be specific and accurate.",
  "category": "one of: 🌍 World, 🧪 Science, 🎬 Culture, ⚽ Sports",
  "categoryKey": "one of: world, science, culture, sports",
  "wikipediaTitle": "exact Wikipedia article title from the list above"
}

Select up to 5 events per category. Spread across all 4 categories if possible. Max 20 total.`;

  let events = [];
  try {
    const raw = await askCF(systemPrompt, userPrompt, 4000);
    events = JSON.parse(raw);
    if (!Array.isArray(events)) events = [];
  } catch(e) {
    console.error('Events AI parse error:', e.message);
    // Fallback: use raw wikipedia events directly
    events = allWikiEvents.slice(0, 10).map(e => {
      const page = e.pages?.[0];
      return {
        year: e.year,
        fullDate: `${monthName} ${day}, ${e.year}`,
        title: page?.title || 'Historical Event',
        description: e.text || '',
        category: '🌍 World',
        categoryKey: 'world',
        wikipediaTitle: page?.title || null
      };
    });
  }

  // Step 5: Verify each event against Wikipedia + get images
  const verified = await Promise.all(events.map(async ev => {
    const wiki = await wikiLookup(ev.wikipediaTitle || ev.title);
    return {
      ...ev,
      image: wiki.image || null,
      wikiUrl: wiki.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(ev.wikipediaTitle || ev.title)}`,
      wikiVerified: wiki.exists
    };
  }));

  // Step 6: Group by category, max 5 per category
  const grouped = {};
  CATEGORIES.forEach(cat => { grouped[cat] = []; });

  verified.forEach(ev => {
    const cat = ev.category || '🌍 World';
    if (!grouped[cat]) grouped[cat] = [];
    if (grouped[cat].length < 5) grouped[cat].push(ev);
  });

  return { grouped, hasExactYear };
}

// ── Famous birthdays ────────────────────────────────────────────
async function buildFamousPeople(month, day) {
  const monthName = MONTHS[month - 1];
  const currentYear = new Date().getFullYear();

  const wikiBirths = await wikiOnThisDay(month, day, 'births');
  const birthList = wikiBirths.slice(0, 15).map(b => {
    const page = b.pages?.[0];
    return `- Born ${b.year}: ${b.text} [Wikipedia: ${page?.title || 'N/A'}]`;
  }).join('\n');

  const systemPrompt = `You are a historian. Only use people from the verified list. Never invent people. Return raw JSON only.`;
  const userPrompt = `From this VERIFIED Wikipedia list of people born on ${monthName} ${day}, pick the 4 most historically significant people from different eras and fields.

VERIFIED BIRTHS FROM WIKIPEDIA:
${birthList || 'No births data available.'}

Return JSON array:
[{
  "name": "Full Name",
  "year": 1942,
  "profession": "e.g. Theoretical Physicist",
  "fact": "2-3 sentences about their significance and legacy.",
  "wikipediaTitle": "exact Wikipedia article title"
}]`;

  let people = [];
  try {
    const raw = await askCF(systemPrompt, userPrompt, 1500);
    people = JSON.parse(raw);
    if (!Array.isArray(people)) people = [];
  } catch(e) {
    console.error('People AI parse error:', e.message);
    // Fallback: use raw wiki births
    people = wikiBirths.slice(0, 4).map(b => {
      const page = b.pages?.[0];
      return {
        name: page?.title || 'Unknown',
        year: b.year,
        profession: '',
        fact: b.text || '',
        wikipediaTitle: page?.title || null
      };
    });
  }

  // Verify + get images
  const verified = await Promise.all(people.slice(0, 4).map(async p => {
    const wiki = await wikiLookup(p.wikipediaTitle || p.name);
    return {
      ...p,
      image: wiki.image || null,
      wikiUrl: wiki.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.name)}`
    };
  }));

  return verified;
}

// ── Main API ─────────────────────────────────────────────────────
app.post('/api/birthday', async (req, res) => {
  const { name, day, month, year } = req.body;
  if (!name || !day || !month || !year) return res.status(400).json({ error: 'Missing fields' });

  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  const today = new Date();

  // Future date → "Events are yet to happen"
  if (new Date(y, m - 1, d) > today) return res.json({ type: 'future' });

  const isTodayBirthday = today.getDate() === d && (today.getMonth() + 1) === m;

  try {
    console.log(`\n[${new Date().toISOString()}] Processing: ${name}, ${MONTHS[m-1]} ${d}, ${y}`);

    const [{ grouped, hasExactYear }, famousPeople] = await Promise.all([
      buildEvents(m, d, y),
      buildFamousPeople(m, d)
    ]);

    return res.json({
      type: 'success',
      name, day: d, month: m, year: y,
      isTodayBirthday, hasExactYear,
      grouped,           // { "🌍 World": [...], "🧪 Science": [...], ... }
      famousPeople,
      yearContext: yearContext(y)
    });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ type: 'error', message: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎂  Birthday in History  →  http://localhost:${PORT}`);
  console.log(`   Cloudflare Account: ${CF_ACCOUNT_ID}`);
  console.log(`   Model: ${CF_MODEL}\n`);
});
