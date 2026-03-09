# 🔧 Cloudflare Workers AI — Setup Guide
# Birthday in History v3

---

## STEP 1 — Create a Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your email
3. Verify your email address
4. You do NOT need to add a domain or credit card for Workers AI free tier

---

## STEP 2 — Get Your Account ID

1. Log in at https://dash.cloudflare.com
2. On the right sidebar of the home page you will see:
   **"Account ID"** — copy this value
3. It looks like: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`
4. Save it — this is your CF_ACCOUNT_ID

---

## STEP 3 — Create an API Token

1. Click your profile icon (top right) → **"My Profile"**
2. Click **"API Tokens"** in the left menu
3. Click **"Create Token"**
4. Click **"Use template"** next to **"Workers AI (Beta)"**
   - OR click "Create Custom Token":
     - Token name: BirthdayInHistory
     - Permissions: Add → Account → Workers AI → Edit
     - Account Resources: Include → Your account
5. Click **"Continue to summary"** → **"Create Token"**
6. COPY THE TOKEN NOW — it only shows once!
   It looks like: `AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`
7. Save it — this is your CF_API_TOKEN

---

## STEP 4 — Set Environment Variables and Run

### Option A — Set in terminal (recommended):

**Mac/Linux:**
```bash
export CF_ACCOUNT_ID="your_account_id_here"
export CF_API_TOKEN="your_api_token_here"
npm install
node server.js
```

**Windows Command Prompt:**
```cmd
set CF_ACCOUNT_ID=your_account_id_here
set CF_API_TOKEN=your_api_token_here
npm install
node server.js
```

**Windows PowerShell:**
```powershell
$env:CF_ACCOUNT_ID="your_account_id_here"
$env:CF_API_TOKEN="your_api_token_here"
npm install
node server.js
```

### Option B — Create a .env file:

Create a file called `.env` in the project root:
```
CF_ACCOUNT_ID=your_account_id_here
CF_API_TOKEN=your_api_token_here
```

Then install dotenv:
```bash
npm install dotenv
```

And add this line to the TOP of server.js:
```js
require('dotenv').config();
```

---

## STEP 5 — Open in browser

```
http://localhost:3000
```

---

## Cloudflare Workers AI — Free Tier Limits

| Model | Free requests/day |
|---|---|
| llama-3.3-70b-instruct-fp8-fast | 10,000 |

More than enough for personal use. No credit card needed.

---

## Troubleshooting

**"10001: Authentication error"**
→ Your API token is wrong. Regenerate it in Step 3.

**"10000: Not found"**  
→ Your Account ID is wrong. Double-check Step 2.

**"Workers AI is not enabled"**
→ Go to https://dash.cloudflare.com → Workers & Pages → Enable Workers AI

**Port 3000 already in use:**
```bash
CF_ACCOUNT_ID=xxx CF_API_TOKEN=yyy PORT=3001 node server.js
```
Then open http://localhost:3001

---

## Wikipedia API

Wikipedia is used for images only — it's completely FREE, no key needed.
The app uses: https://en.wikipedia.org/api/rest_v1/

---

## Full project structure

```
birthday-in-history/
├── server.js          ← Express backend (Cloudflare AI + Wikipedia)
├── package.json       ← Only "express" dependency
├── SETUP.md           ← This file
└── public/
    ├── index.html     ← App UI
    ├── style.css      ← Dark glassmorphism styles
    └── script.js      ← Frontend logic
```
