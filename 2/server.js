// Birthday in History — Server (Groq powered, no node-fetch needed)
const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



// ── Built-in HTTPS helpers ───────────────────────────────────
function httpsPost(hostname, urlPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: urlPath, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
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
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path: urlPath, method: 'GET', headers: { 'User-Agent': 'BirthdayInHistory/1.0' } },
      res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Groq call ────────────────────────────────────────────────
async function askGroq(prompt, maxTokens = 2500) {
  const result = await httpsPost(
    'api.groq.com',
    '/openai/v1/chat/completions',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: `You are a world-class historian with knowledge up to 2025. 
You ONLY state facts you are 100% certain about. 
Never invent or hallucinate events. 
If unsure, pick a different well-known event instead.
Respond ONLY with raw valid JSON — no markdown fences, no explanation. Pure JSON.`
        },
        { role: 'user', content: prompt }
      ]
    }
  );
  let text = result.choices[0].message.content.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
}

// ── Wikipedia image ──────────────────────────────────────────
async function getWikiImage(title) {
  if (!title) return null;
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const data = await httpsGet('en.wikipedia.org', `/api/rest_v1/page/summary/${encoded}`);
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch { return null; }
}

// ── Year context ─────────────────────────────────────────────
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
  if (y < 2023) return { population: '~7.9 billion', techEra: 'AI revolution era', milestone: 'COVID-19 reshaped the world, remote work became normal' };
  return { population: '~8.1 billion', techEra: 'Generative AI era', milestone: 'ChatGPT and generative AI transformed every industry' };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Main API ─────────────────────────────────────────────────
app.post('/api/birthday', async (req, res) => {
  const { name, day, month, year } = req.body;
  if (!name || !day || !month || !year) return res.status(400).json({ error: 'Missing fields' });

  const d = parseInt(day), m = parseInt(month), y = parseInt(year);
  const today = new Date();
  const monthName = MONTHS[m - 1];
  const currentYear = today.getFullYear(); // 2025

  if (new Date(y, m - 1, d) > today) return res.json({ type: 'future' });

  const isTodayBirthday = today.getDate() === d && (today.getMonth() + 1) === m;

  try {
    // Very explicit prompt for accurate, verified events up to 2025
    const eventsPrompt = `I need 5 REAL, VERIFIED historical events that happened on ${monthName} ${d} (any year from ancient times up to ${currentYear}).

STRICT RULES:
- Only include events you are 100% certain actually happened on this EXACT date (${monthName} ${d})
- Include events from a wide range of years — ancient, medieval, 1800s, 1900s, and post-2000 if possible
- Include the year ${y} if a notable event occurred on ${monthName} ${d} ${y}
- Each description must be 3-4 sentences with real context, causes, and impact
- The "fullDate" field must be the complete date like "${monthName} ${d}, 1969"
- wikipediaTitle must be a real, existing Wikipedia article title

Return ONLY this JSON array, nothing else:
[
  {
    "year": 1969,
    "fullDate": "${monthName} ${d}, 1969",
    "title": "Apollo 11 Lands on the Moon",
    "description": "NASA's Apollo 11 mission successfully landed astronauts Neil Armstrong and Edwin 'Buzz' Aldrin on the lunar surface, making them the first humans to walk on the Moon. The landing occurred at 20:17 UTC when the Eagle lunar module touched down in the Sea of Tranquility. Neil Armstrong became the first person to step onto the lunar surface, uttering his iconic words about 'one small step for man.' The mission fulfilled President Kennedy's 1961 challenge and marked the United States' victory in the Space Race against the Soviet Union.",
    "category": "🧪 Science",
    "categoryKey": "science",
    "wikipediaTitle": "Apollo 11",
    "wikiUrl": "https://en.wikipedia.org/wiki/Apollo_11"
  }
]`;

    const peoplePrompt = `Give me 4 REAL, FAMOUS people who were definitely born on ${monthName} ${d} (any year, up to ${currentYear}).
Only include people whose birth on this EXACT date is well-documented.
Return ONLY this JSON array:
[
  {
    "name": "Stephen Hawking",
    "year": 1942,
    "profession": "Theoretical Physicist & Cosmologist",
    "fact": "One of the greatest scientific minds of the 20th century, Hawking made groundbreaking contributions to our understanding of black holes, the Big Bang, and the nature of time — all while living with motor neurone disease for over 50 years.",
    "wikipediaTitle": "Stephen Hawking"
  }
]`;

    const [evRaw, pplRaw] = await Promise.all([
      askGroq(eventsPrompt, 2500),
      askGroq(peoplePrompt, 1200)
    ]);

    let events = [], famousPeople = [];
    try { events = JSON.parse(evRaw); if (!Array.isArray(events)) events = []; } catch(e) { console.error('Events parse:', e.message, '\nRaw:', evRaw.slice(0, 300)); events = []; }
    try { famousPeople = JSON.parse(pplRaw); if (!Array.isArray(famousPeople)) famousPeople = []; } catch(e) { console.error('People parse:', e.message); famousPeople = []; }

    // Fetch Wikipedia images in parallel
    const [evImgs, pplImgs] = await Promise.all([
      Promise.all(events.map(e => getWikiImage(e.wikipediaTitle || e.title))),
      Promise.all(famousPeople.map(p => getWikiImage(p.wikipediaTitle || p.name)))
    ]);

    events = events.map((e, i) => ({ ...e, image: evImgs[i] || null }));
    famousPeople = famousPeople.map((p, i) => ({ ...p, image: pplImgs[i] || null }));

    return res.json({
      type: 'success',
      name, day: d, month: m, year: y,
      isTodayBirthday,
      events,
      famousPeople,
      yearContext: yearContext(y)
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ type: 'error', message: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎂  Birthday in History  →  http://localhost:${PORT}\n`);
});
