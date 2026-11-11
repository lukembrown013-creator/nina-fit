# Nina Fit: Phase 2

Phase 1 covered logging: dashboard, workouts, nutrition, body, settings, backup. Phase 2 adds three things on top of that, without changing anything about how Phase 1 works:

- **Account + cloud sync** — optional. The app still works fully offline with no account, exactly like Phase 1. Signing in (Settings → Account & sync) backs up workouts, food, weight, measurements and goals, and keeps them in sync if the app is ever used on a second device.
- **Progress photos** — Progress tab → Photos. These never leave the phone: not backed up, not synced, not in the exported backup file. They live only in this one browser/app install, the same place Phase 1's data already lived.
- **Barcode scanning** — Food → the barcode icon next to "Add food". Scans a packaged food's barcode and looks it up automatically.

There is still no build step for the app itself — it's plain HTML/CSS/JS. What's new is a small server (a Cloudflare Worker) that handles login and sync, which needs a one-time setup below.

## What you need to do (one-time setup)

You already have the site live on Cloudflare from Phase 1 (`nina-fit.lukembrown013.workers.dev` or similar), connected to a GitHub repo that auto-deploys. These steps build on that — you don't need Node, npm, or the command line for any of this; it's all in the Cloudflare dashboard and GitHub's web UI.

### 1. Push the new files to GitHub

Add/replace these in your `nina-fit` repository (GitHub's web UI: open the repo, "Add file" → "Upload files", drag these in, Commit — same as before):
- `worker.js` (new — the server code)
- `migrations/0001_init.sql` (new)
- `wrangler.jsonc` (replace the old one)
- `index.html`, `styles.css` (replaced)
- Everything in `js/` (several files changed, two are new: `sync.js`, `scan.js`)

Don't deploy yet — finish steps 2–4 first, or the first deploy will fail looking for a database that doesn't exist.

### 2. Create the database

In the Cloudflare dashboard: **Storage & Databases → D1 → Create database**. Name it `nina-fit`. Once created, open it and copy the **Database ID** shown on its page.

Back in your GitHub repo, edit `wrangler.jsonc` (pencil icon → edit) and paste that ID in place of `REPLACE_WITH_THE_ID_FROM_WRANGLER_D1_CREATE`. Commit.

### 3. Create the tables

Still in that D1 database's page in the Cloudflare dashboard, find the **Console** (sometimes called "Query") tab. Paste in the contents of `migrations/0001_init.sql` and run it. This creates the two tables the app needs (`users`, `sync_state`) — a one-time step.

### 4. Add the session secret

Go to **Workers & Pages → nina-fit → Settings → Variables and Secrets → Add → Secret**. Name it `SESSION_SECRET`, and for the value, paste any long random string — for example, generate one at [1password.com/password-generator](https://1password.com/password-generator/) (64 characters, all character types) and use that. This is what signs people's login sessions; it never needs to be remembered, just set once.

### 5. Deploy

Now trigger a deploy — either push any small change to GitHub, or in Cloudflare go to the Worker's **Deployments** tab and redeploy the latest commit. Cloudflare will build with the new `wrangler.jsonc`, which wires up the database automatically.

Open the live site afterward and check Settings → Account & sync shows the "Create account" / "I already have an account" buttons. If instead you see a blank or broken page, the most common cause is the database ID in `wrangler.jsonc` not matching step 2 exactly — double-check it.

## Try it locally on your Mac first (optional, recommended)

Same as Phase 1 — serve the folder and open it in a browser:
```
cd ~/Downloads/nina-fit
python3 -m http.server 8000
```
Open http://localhost:8000. Note: signing in and syncing only work once this is actually deployed to Cloudflare (there's no database running locally this way) — but everything else, including the barcode scanner's camera (over `http://localhost`, which browsers treat as a safe origin) and progress photos, can be tried locally first.

## Test checklist (Phase 2 additions — Phase 1's checklist still applies too)

- **Account & sync**: Settings → Create account with a name and passcode. Log some food/weight. Settings → Sync now, then confirm it shows "Last synced" with a recent time.
- **Second device / fresh browser profile**: open the site somewhere that has never logged in (e.g. a private/incognito window), log in with the same name and passcode, choose "Use the cloud copy", and confirm the data matches.
- **Sign out and back in**: data already on the phone stays put; after signing back in it offers the "keep this phone's data" vs "use the cloud copy" choice if both have data.
- **Offline**: Airplane Mode, log something, turn Wi-Fi back on, reopen the app — it syncs automatically within a few seconds (Settings will show an updated "Last synced" time).
- **Progress photos**: Progress → Photos → add one from the camera and one from the photo library. Open one, delete it. Add two and use "Compare with another photo." Export a backup (Settings) and confirm the backup file does **not** contain photos (it's just JSON — open it in a text editor to check if you want).
- **Barcode scanning**: Food → "+" next to a meal → tap the barcode icon → scan a real packaged food. Confirm it finds the product and prefills calories/macros. Try a barcode that won't be in the database (or tap "Type the barcode instead") to confirm the manual fallback works.
- **Camera permission denied**: deny camera access when prompted, confirm the app recovers gracefully (an error toast, not a stuck screen) and still lets you add food manually.

## Limitations worth knowing about

- **Barcode scanning needs network** on first use each session (it loads a small scanning library, then looks up the product) — it won't work mid-flight in Airplane Mode. Manual entry still does, once back online.
- **Sync is last-write-wins**, not a smart merge. If the same account is used on two devices at close to the same moment, whichever syncs second will ask to keep this phone's data or take the cloud copy — it won't try to combine them. For one person using mostly one phone, this won't come up in practice.
- **The GitHub repo is still Public** as of the end of Phase 1 — worth switching to Private in the repo's Settings, since `wrangler.jsonc` doesn't contain secrets but there's no reason to leave it open.

## What is where

- `index.html`, `styles.css`: page shell and the design system
- `js/app.js`: startup, navigation, quick add, welcome tour
- `js/home.js`, `train.js`, `workout.js`, `food.js`, `progress.js`, `settings.js`: one file per screen
- `js/sync.js`: account + cloud sync (new)
- `js/scan.js`: barcode camera scanning (new)
- `js/store.js`: saving and loading data on the phone; backup format
- `js/calc.js`: trends, records, totals, unit conversion
- `js/exercises.js`: the built-in exercise list
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and Home Screen install
- `worker.js`: the server — login, sync, and the food-barcode lookup proxy (new)
- `migrations/0001_init.sql`: database schema (new)
- `wrangler.jsonc`: deploy configuration — holds the database ID, not any secret
