
# Quick NewsGPT Backend (Render-ready)

**Tagline:** "NewsGPT — जो खबरें समझे भी और समझाए भी, Smart AI के साथ!"
**Creator:** Kailash Gautam (Founder, Quick NewsGPT)

## What this package contains
- `server.js` : Express backend with endpoints:
  - `/` health check
  - `/news` demo summaries
  - `/create-link` (POST) create trackable redirect link
  - `/r/:id?to=...` redirect + click logging (daily)
  - `/stats` returns daily click counts
  - `/send-summary` sends daily summary email (Total clicks + Unique links)
- `data.json` : storage (JSON file)
- `.env.example` : EMAIL_USER, EMAIL_PASS, EMAIL_TO placeholders
- `.render.yaml` : Render auto-deploy config
- `package.json`

---

## Quick Deploy (GitHub + Render)

1. Create a GitHub repository (e.g. `quick-newsgpt-backend-v2`) and push this folder as the repository root.

Example commands:
```bash
git init
git add .
git commit -m "Quick NewsGPT backend v2"
git branch -M main
git remote add origin https://github.com/<your-username>/quick-newsgpt-backend-v2.git
git push -u origin main
```

2. On Render:
- New -> Web Service -> Connect to GitHub -> select the repo
- Build Command: `npm install`
- Start Command: `npm start`
- (If using monorepo, set Root Directory to this folder)

3. Set Environment Variables on Render (Environment tab):
- `EMAIL_USER` = your Gmail address (e.g. your@gmail.com)
- `EMAIL_PASS` = Gmail App Password (create via Google Account -> Security -> App passwords)
- `EMAIL_TO` = recipient email (kcg.patrika@gmail.com)

4. (Optional) Cron Job on Render:
- New -> Cron Job
- Command: `curl https://<your-render-url>/send-summary`
- Schedule: `0 2 * * *`  (This uses UTC; for 8 AM IST set appropriate UTC time)

---

## Test locally
Install deps and run:
```bash
npm install
node server.js
# Open http://localhost:3000/news  and http://localhost:3000/stats
```

---

## Notes
- This is a simple JSON-file backed demo. For production, migrate `data.json` to a proper DB (Postgres/Redis).
- The `/send-summary` email uses Gmail SMTP via nodemailer and app password.
- After deploy, copy Render URL and update your frontend's `src/config.js` BACKEND_URL.

---

## Troubleshooting
- If Render shows `Error: ENOENT: no such file or directory, open '/opt/render/project/src/package.json'` ensure you pushed repo root (this package.json must be at repo root), or set Root Directory in Render to the folder.
- If you get `502`, check logs and ensure process.env.PORT is used (this code uses it).
