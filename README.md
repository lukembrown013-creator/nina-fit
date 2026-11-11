# Nina Fit: Phase 1

A personal fitness tracker that installs to the iPhone Home Screen. Phase 1 covers core logging: dashboard, workouts, nutrition, body, settings and backup. It works offline and keeps all data on the phone.

There is no build step. The folder is the app: plain HTML, CSS and JavaScript.

## Try it on your Mac

1. Unzip the folder.
2. Open Terminal and run:
   ```
   cd ~/Downloads/nina-fit
   python3 -m http.server 8000
   ```
   If your Mac asks to install developer tools the first time, accept, then run it again.
3. Open http://localhost:8000 in Safari or Chrome. To see it phone-sized in Safari: Develop menu, Enter Responsive Design Mode.
4. Press Control-C in Terminal to stop.

Opening `index.html` by double-clicking does not work. The app needs to be served, as above.

## Put it online (free)

The web address you choose here is permanent for Nina: her data is tied to it. Pick the project name once and keep it.

Recommended: GitHub plus Cloudflare Pages, so each later phase goes live automatically.

1. On github.com, create a new **private** repository named `nina-fit`. Leave it empty.
2. Upload the contents of this folder to it (on the repository page: "uploading an existing file", then drag everything in, then Commit). Claude can also push the files for you.
3. Create a free account at cloudflare.com.
4. In the Cloudflare dashboard: Workers & Pages, Create application, Pages, connect to Git, and choose the `nina-fit` repository.
5. Build settings: no framework, leave the build command empty, output directory `/`. Deploy.
6. Cloudflare gives you an address like `https://nina-fit.pages.dev`. That is the app.

Cloudflare's menus change from time to time. If a label differs, look for "Pages" and "Connect to Git".

## Install on her iPhone

1. Open the address in **Safari** (not Chrome).
2. Tap the Share button, then "Add to Home Screen", then Add.
3. Open it from the Home Screen icon from then on. Data logged in the Safari tab and data in the Home Screen app are kept separately, so install first, then start logging.

## Test checklist

- Welcome tour appears once, then the dashboard.
- Settings: set calorie and macro targets; the dashboard ring fills as food is logged.
- "+" button: log food, log weight, log measurements, start a workout.
- Train: create a workout, start it, tick sets (rest timer starts), finish. Start it again: last weights and reps are filled in. Beat a previous best to see the PR celebration.
- Food: add with Quick add, re-add from Recent, save a meal, swipe a row left to delete, swipe the screen to change day.
- Progress: weight trend chart, measurements, strength records.
- Turn on Airplane Mode and reopen the app: it still loads and logs.
- Settings: Export backup, then Restore from backup.

## Updating the app later

Replace the files in the GitHub repository. Cloudflare redeploys by itself. On the phone, the new version appears the second time the app is opened after an update. Her data is not touched by updates.

## What is where

- `index.html`, `styles.css`: page shell and the design system
- `js/app.js`: startup, navigation, quick add, welcome tour
- `js/home.js`, `train.js`, `workout.js`, `food.js`, `progress.js`, `settings.js`: one file per screen
- `js/store.js`: saving and loading data on the phone; backup format
- `js/calc.js`: trends, records, totals, unit conversion
- `js/exercises.js`: the built-in exercise list
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and Home Screen install
