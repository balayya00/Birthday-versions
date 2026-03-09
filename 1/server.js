// Birthday in History — Server
// Uses ONLY built-in Node.js modules + Express (no node-fetch needed)
const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
app.use(express.json());

// ── Serve the public folder (index.html, style.css, script.js) ──
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_KEY = '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';

// ── Built-in HTTPS request helper ──────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          else resolve(JSON.parse(raw));
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path: urlPath, method: 'GET', headers: { 'User-Agent': 'BirthdayInHistory/1.0' } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Groq AI call ────────────────────────────────────────────
async function askGroq(prompt, maxTokens = 2000) {
  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: 'You are a world-class historian. Respond ONLY with raw valid JSON — no markdown, no code blocks, no explanation. Pure JSON only.'
        },
        { role: 'user', content: prompt }
      ]
    }
  );
  let text = result.choices[0].message.content.trim();
  // Strip accidental markdown fences
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
}

// ── Wikipedia image (no key needed) ────────────────────────
async function getWikiImage(title) {
  if (!title) return null;
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/page/summary/${encoded}`);
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch { return null; }
}

// ── Year context ────────────────────────────────────────────
function yearContext(y) {
  y = parseInt(y);
  if (y < 1800) return { population: '~1 billion', techEra: 'Pre-industrial era', milestone: 'Age of Enlightenment and revolutions' };
  if (y < 1850) return { population: '~1.2 billion', techEra: 'Steam & industrial age', milestone: 'Railway and industrial expansion era' };
  if (y < 1900) return { population: '~1.6 billion', techEra: 'Industrial revolution era', milestone: 'Steel, steam, and empire expansion' };
  if (y < 1920) return { population: '~1.8 billion', techEra: 'Early electricity era', milestone: 'World wars and rapid industrialization' };
  if (y < 1940) return { population: '~2.3 billion', techEra: 'Radio & aviation age', milestone: 'Great Depression and social transformation' };
  if (y < 1960) return { population: '~2.5 billion', techEra: 'Early electronics era', milestone: 'Post-WWII reconstruction and Cold War' };
  if (y < 1970) return { population: '~3.0 billion', techEra: 'Space race era', milestone: 'Civil rights movement and space exploration' };
  if (y < 1980) return { population: '~3.7 billion', techEra: 'Early computer era', milestone: 'Moon landing and counterculture revolution' };
  if (y < 1990) return { population: '~4.4 billion', techEra: 'Personal computer era', milestone: 'Cold War and personal computing revolution' };
  if (y < 2000) return { population: '~5.3 billion', techEra: 'Early internet era', milestone: 'World Wide Web launched, digital revolution began' };
  if (y < 2005) return { population: '~6.1 billion', techEra: 'Dot-com and broadband era', milestone: 'Wikipedia launched, smartphones emerging' };
  if (y < 2010) return { population: '~6.6 billion', techEra: 'Social media dawn', milestone: 'iPhone launched, social networks took over' };
  if (y < 2015) return { population: '~7.0 billion', techEra: 'Smartphone era', milestone: 'Cloud computing and the app economy boomed' };
  if (y < 2020) return { population: '~7.5 billion', techEra: 'AI and big data era', milestone: 'Machine learning and streaming dominated culture' };
  return { population: '~8.0 billion', techEra: 'AI revolution era', milestone: 'Generative AI and climate urgency defined the decade' };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── API endpoint ────────────────────────────────────────────
app.post('/api/birthday', async (req, res) => {
  const { name, day, month, year } = req.body;
  if (!name || !day || !month || !year) return res.status(400).json({ error: 'Missing fields' });

  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  const today = new Date();
  const monthName = MONTHS[m - 1];

  if (new Date(y, m - 1, d) > today) return res.json({ type: 'future' });

  const isTodayBirthday = today.getDate() === d && (today.getMonth() + 1) === m;

  try {
    const eventsPrompt = `Give me 5 real, fascinating historical events that happened on ${monthName} ${d} across different years in history.
Include a mix of categories: world events, science discoveries, culture, sports.
If something notable happened on ${monthName} ${d} ${y} specifically, include it.
Return ONLY a JSON array of exactly 5 objects, no other text:
[{"year":1969,"title":"Apollo 11 Moon Landing","description":"NASA astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon. Armstrong's famous words echoed across the world as humanity achieved the impossible.","category":"🧪 Science","categoryKey":"science","wikipediaTitle":"Apollo 11","wikiUrl":"https://en.wikipedia.org/wiki/Apollo_11"}]`;

    const peoplePrompt = `Give me 4 famous and historically significant people born on ${monthName} ${d} from different eras and fields.
Return ONLY a JSON array of exactly 4 objects, no other text:
[{"name":"Stephen Hawking","year":1942,"profession":"Theoretical Physicist","fact":"Revolutionized our understanding of black holes and cosmology despite battling ALS for 50+ years.","wikipediaTitle":"Stephen Hawking"}]`;

    const hasYearPrompt = `Did any historically significant event happen on ${monthName} ${d} in the year ${y}? Reply with only: {"hasEvents":true} or {"hasEvents":false}`;

    const [evRaw, pplRaw, hasRaw] = await Promise.all([
      askGroq(eventsPrompt, 2000),
      askGroq(peoplePrompt, 1000),
      askGroq(hasYearPrompt, 50)
    ]);

    let events = [], famousPeople = [], hasExactYear = false;
    try { events = JSON.parse(evRaw); if (!Array.isArray(events)) events = []; } catch(e) { console.error('Events parse error:', e.message); events = []; }
    try { famousPeople = JSON.parse(pplRaw); if (!Array.isArray(famousPeople)) famousPeople = []; } catch(e) { console.error('People parse error:', e.message); famousPeople = []; }
    try { hasExactYear = JSON.parse(hasRaw).hasEvents === true; } catch { hasExactYear = false; }

    // Get Wikipedia images in parallel
    const [evImgs, pplImgs] = await Promise.all([
      Promise.all(events.map(e => getWikiImage(e.wikipediaTitle || e.title))),
      Promise.all(famousPeople.map(p => getWikiImage(p.wikipediaTitle || p.name)))
    ]);

    events = events.map((e, i) => ({ ...e, image: evImgs[i] || null }));
    famousPeople = famousPeople.map((p, i) => ({ ...p, image: pplImgs[i] || null }));

    return res.json({
      type: 'success',
      name, day: d, month: m, year: y,
      isTodayBirthday, hasExactYear,
      events, famousPeople,
      yearContext: yearContext(y)
    });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ type: 'error', message: err.message });
  }
});

// ── Catch-all: serve index.html for any unknown route ──────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🎂  Birthday in History running!`);
  console.log(`  → http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
