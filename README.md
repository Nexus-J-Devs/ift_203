# 🚀 How to Run & Deploy the Scholarship Form Study

## Project Files

| File | Purpose |
|------|---------|
| [`index.html`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/index.HTML) | Landing page — consent + random assignment |
| [`form-a.html`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/form-a.html) | Form A — Progressive Disclosure |
| [`form-b.html`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/form-b.html) | Form B — Conventional |
| [`survey.html`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/survey.html) | Post-form trust survey |
| [`results.html`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/results.html) | Researcher results dashboard |
| [`style.css`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/style.css) | Shared styles |
| [`script.js`](file:///c:/Users/meyou/Desktop/CODEs/IFT%20203/script.js) | Shared logic |

---

## ▶️ Running Locally

### Option 1 — VS Code Live Server (Recommended)
1. Open the `IFT 203` folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.
4. A browser tab opens at `http://127.0.0.1:5500/index.html`.

> **Why not just double-click?** Modern browsers block some features (like `localStorage` reads across pages) when files are opened directly from `file://`. A dev server avoids this.

### Option 2 — Python (no install needed on Windows 11)
```powershell
# In the IFT 203 folder:
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option 3 — Node.js `serve`
```powershell
npx serve .
```
Then open the URL it prints.

---

## 🌐 Deploying for Free on Netlify

### Method A — Drag & Drop (fastest, no account setup)

1. Go to **[netlify.com](https://netlify.com)** and sign up (free).
2. On your dashboard, scroll to the bottom — you'll see a **drag & drop zone**.
3. Open Windows Explorer and navigate to:
   ```
   C:\Users\meyou\Desktop\CODEs\IFT 203
   ```
4. **Select all 7 files** (hold Ctrl, click each) — `index.html`, `form-a.html`, `form-b.html`, `survey.html`, `results.html`, `style.css`, `script.js`.
5. Drag them into the Netlify deploy zone.
6. Netlify gives you a live URL like `https://amazing-name-12345.netlify.app` in seconds.

> ⚠️ **Important:** Drag the files — **not the folder**. Netlify needs the files at the root level.

---

### Method B — Netlify CLI (for repeat deployments)

```powershell
# 1. Install once
npm install -g netlify-cli

# 2. Log in
netlify login

# 3. Deploy from the project folder
cd "C:\Users\meyou\Desktop\CODEs\IFT 203"
netlify deploy --dir . --prod
```

You'll get a permanent URL you can share with participants.

---

### Method C — GitHub + Netlify (best for ongoing updates)

1. Create a free repo on **[github.com](https://github.com)**.
2. Push your files:
   ```powershell
   cd "C:\Users\meyou\Desktop\CODEs\IFT 203"
   git init
   git add .
   git commit -m "Initial scholarship study"
   git remote add origin https://github.com/YOUR_NAME/ift203-study.git
   git push -u origin main
   ```
3. On Netlify: **Add new site → Import from Git → Connect GitHub** → select your repo.
4. Leave build settings blank (it's a static site). Click **Deploy**.
5. Every `git push` auto-deploys. ✅

---

## 📋 How Participants Should Use It

1. Share the Netlify URL with participants.
2. They land on `index.html`, read the consent, check the box, and click the button.
3. They are randomly sent to **Form A** or **Form B**.
4. After the form they go to the **survey**.
5. You visit `results.html` to see aggregated data and download CSV.

---

## 🔬 How the Data Works

- All data lives in **localStorage** in the participant's browser — nothing is sent anywhere.
- Each participant's record is stored under key `scholarshipStudyData` as a JSON array.
- The `results.html` page reads from that same localStorage — so **researcher and participants must use the same browser on the same device** (or you export/import the CSV).
- For a real multi-device study, replace localStorage with a free backend like [Supabase](https://supabase.com) or [Firebase](https://firebase.google.com).

---

## ✅ Quick Test Checklist

- [ ] Landing page shows, consent required before proceeding
- [ ] "Start" button sends to Form A or B randomly
- [ ] Form A: step 1 validates before moving on
- [ ] Form A: CGPA < 3.0 shows ineligible message
- [ ] Form A: Need-based shows income & occupation fields
- [ ] Form A: Merit-based + eligible skips those fields
- [ ] Form B: all 12 fields visible, bank account shown
- [ ] Both forms redirect to survey on submit
- [ ] Survey saves trust score
- [ ] Results page shows charts and table
- [ ] CSV download works
- [ ] Clear data button resets everything
