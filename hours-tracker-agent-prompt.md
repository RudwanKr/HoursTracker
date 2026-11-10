# PROMPT: Build "Hours Tracker" — a static, GitHub-synced, neo-brutalist web app

You are an expert front-end engineer. Build the application described below from scratch. Read this entire document before writing any code. Follow it strictly. Where this document is explicit, do not improvise. Where it is silent, choose the simplest option and note the choice in `README.md`.

---

## 1. Goal

A personal web app (single user) to track **hours worked per week across multiple jobs/activities**. For each job the user sets a required number of hours per week, starts and stops a timer while working, and sees how many hours remain this week. Remaining hours may go **negative**, which means overtime. Jobs can be **paused, ended, and resumed later**; off days must not count toward the required hours. The user can see statistics **per week, per month, and for the whole job**.

The app is **online only** (no offline support, no service worker, no PWA). It has **no backend**. It is hosted on **GitHub Pages**. Data is stored in a **private GitHub repository** (`data.json`) accessed from the browser through the GitHub REST API, so it works from any device.

---

## 2. Hard constraints

- **Stack:** plain HTML + CSS + vanilla JavaScript using **ES modules**. **No framework, no bundler, no build step, no npm dependencies.** The repo must work by simply serving the files statically.
- **No backend, no database, no SQL.** Data is a single JSON document.
- **Online only.** Do not add a service worker, manifest, or IndexedDB.
- **Security:**
  - The GitHub token is stored **only** in `localStorage` on the user's device. It is never committed, logged, or placed in the URL.
  - Never use `innerHTML` with user-provided strings. Use `textContent` or build elements with `document.createElement`. (Static template strings with no user data are allowed.)
- **Time handling:** use the user's **local time zone**. All day-level logic uses local date strings `YYYY-MM-DD`. Never parse date-only strings with `new Date("YYYY-MM-DD")` (it is treated as UTC). Construct dates with `new Date(y, m - 1, d)` or do integer day arithmetic with `Date.UTC(y, m - 1, d)` to avoid time zone and DST bugs.
- **Week starts on Sunday** (Sunday → Saturday).
- **Browser support:** current Chrome, Safari, Firefox, including mobile. Mobile-first layout.

---

## 3. Design system — NEO-BRUTALISM (strict)

The visual style must be **unmistakably neo-brutalist**. This is a hard requirement, not a suggestion. Every component must follow these rules. If a component could be styled either softly or brutally, choose brutal.

### 3.1 Principles
- Flat, loud, high-contrast, chunky, and slightly raw.
- **Thick solid black borders** on everything interactive or containing content.
- **Hard offset shadows** (no blur) that make elements look like stacked paper blocks.
- **Flat saturated colors** on a cream/off-white background.
- **Bold, uppercase, heavy typography** for headings and labels; monospace for numbers and timers.
- Sharp corners only.

### 3.2 Design tokens (put these in `:root` in `css/tokens.css`)

```css
:root {
  /* Color */
  --bg: #FFFDF5;          /* page background, warm cream */
  --ink: #000000;         /* all text, borders, shadows */
  --paper: #FFFFFF;       /* card background */
  --yellow: #FFDE59;      /* primary accent / highlights */
  --pink: #FF90E8;        /* secondary accent */
  --blue: #8CA9FF;        /* info / paused */
  --green: #7CFFB2;       /* done / overtime / positive balance */
  --orange: #FF9F43;      /* owed hours / behind */
  --red: #FF5C5C;         /* destructive, errors */

  /* Borders & shadows */
  --border: 3px solid var(--ink);
  --border-thick: 4px solid var(--ink);
  --shadow: 6px 6px 0 var(--ink);
  --shadow-sm: 3px 3px 0 var(--ink);
  --shadow-lg: 10px 10px 0 var(--ink);

  /* Shape */
  --radius: 0;            /* NO rounded corners anywhere */

  /* Type */
  --font-display: "Space Grotesk", "Archivo Black", system-ui, sans-serif;
  --font-body: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "Space Mono", ui-monospace, "Courier New", monospace;

  /* Spacing scale */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
}
```

Load **Space Grotesk** (weights 500, 700) and **Space Mono** (weights 400, 700) from Google Fonts with `font-display: swap`, and keep the fallbacks above.

### 3.3 Component rules

| Component | Rules |
|---|---|
| **Page** | Background `--bg`. Content max width ~960px, centered, with generous padding. Optional subtle decorative element is allowed only if flat and bold (e.g., a thick black rule under the header). |
| **Cards / panels** | `background: var(--paper)`, `border: var(--border)`, `box-shadow: var(--shadow)`, `border-radius: 0`, padding `--s4`–`--s5`. Cards may use a flat accent color as background (yellow, pink, blue, green). |
| **Headings** | `font-family: var(--font-display)`, weight 700, **UPPERCASE**, tight letter-spacing (`-0.02em`), large sizes (h1 ≥ 2rem). |
| **Buttons** | Border `--border`, shadow `--shadow-sm`, flat accent background, bold uppercase text, padding `--s3 --s4`. **Hover:** `transform: translate(-2px,-2px)` and shadow grows to `5px 5px 0`. **Active/pressed:** `transform: translate(3px,3px)` and `box-shadow: 0 0 0`. Transition ≤ 100ms, linear/ease-out. Disabled: grey flat background (`#D9D9D9`), no shadow, `cursor: not-allowed`. |
| **Inputs / selects / textareas** | `border: var(--border)`, white background, `border-radius: 0`, font mono for numbers. **Focus:** change background to `--yellow` and add `box-shadow: var(--shadow-sm)`. No soft glow rings. |
| **Labels** | Uppercase, bold, small (0.75–0.85rem), above the input. |
| **Badges / status chips** | Small rectangular chips with `border: 2px solid var(--ink)`, uppercase bold, flat color by status: ACTIVE = green, PAUSED = blue, ENDED = `#D9D9D9`, RUNNING = yellow with a hard-blinking square indicator (step animation, not a smooth fade). |
| **Progress bar** | Rectangular track with `--border-thick`, white inside, filled with a flat color (orange when behind, green when target reached/over). Optional vertical segment dividers (hard lines). No gradients, no rounded ends, no animation easing beyond a simple width change. |
| **Tables** | `border: var(--border)`, header row with flat yellow background and uppercase bold text, thick black row dividers, mono numerals right-aligned. Wrap in a horizontally scrollable container on mobile. |
| **Tabs / navigation** | Chunky rectangular tabs with borders; active tab has a flat accent fill and is visually "pressed" or raised with a shadow. |
| **Modals / dialogs** | Centered card with `--shadow-lg`, thick border, dark solid overlay with **no blur** (`background: rgba(0,0,0,0.6)`). |
| **Toasts / alerts** | Flat colored rectangles with thick border and hard shadow (green success, red error, yellow info). |
| **Charts** | If you draw bar charts, use plain HTML/CSS or inline SVG with thick black outlines and flat fills. No chart libraries. |
| **Timer display** | Very large monospace digits (`HH:MM:SS`), bold, inside a boxed panel with a thick border. |

### 3.4 Forbidden styling (do NOT use)
- `border-radius` other than `0`
- `box-shadow` with blur radius (every shadow must be a hard offset like `6px 6px 0 #000`)
- Gradients (linear, radial, conic)
- `backdrop-filter`, glassmorphism, blur, translucent soft surfaces
- Pastel/low-contrast palettes, thin 1px hairline borders as the main border style
- Soft drop shadows, glows, or inner shadows
- Smooth, slow, or springy animations (keep transitions ≤ 100ms or use `steps()`)
- Emojis as the main iconography (use bold text labels, simple geometric shapes, or simple inline SVG with thick strokes)
- Gray text on white for important content (text is always `--ink` for primary content)

### 3.5 Layout & responsiveness
- Mobile-first. Single column under 640px; card grid (2 columns) from 640px; up to 3 columns from 1000px.
- Tap targets at least 44px high.
- Sticky top header with the app name in a bold box, plus navigation (Dashboard, Settings) as chunky buttons.
- Respect `prefers-reduced-motion` by disabling the blinking indicator animation.
- Keep contrast high; all focus states clearly visible (thick outline `3px solid var(--ink)` with an offset, or the yellow-fill focus style above).

---

## 4. Core concept: everything is computed from days

All required-hours logic is **day-based**:

- A job has a list of **active periods**: `{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" | null }`. `end: null` means the period is still open (job is active).
- Both `start` and `end` dates are **inclusive** active days. The day the user pauses/ends is an active day; the day the user resumes is an active day.
- A day is **active** if it falls inside at least one period. Build the set of active days as a **set of dates** so overlapping periods (e.g., pause and resume on the same day) never double count.
- The **required hours for one active day** = `weeklyHours / 7`.
- **Worked hours** per day come from sessions (see below).
- A week, a month, or the whole job is just the sum over a range of days. Do not use separate formulas per view.

### 4.1 Definitions
- **Week:** Sunday through Saturday (local).
- **requiredHours(range)** = `weeklyHours × (activeDaysInRange / 7)`
- **workedHours(range)** = sum of session time that falls on days in the range (sessions crossing midnight are split at local midnight and each part is assigned to its own day).
- **remaining** = `required − worked` (negative ⇒ overtime).
- **balance** = `worked − required` (positive ⇒ overtime/surplus; negative ⇒ hours owed, i.e. what needs compensation).
- **Weeks stand alone.** There is **no carry-over** of owed or extra hours between weeks.
- The **current week** shows the **full** target for its active days (not a "so far" target).
- Sessions on non-active days (e.g., a manual entry on a paused day) **are allowed** and count as worked time. They simply increase the balance.
- Changing `weeklyHours` applies to **all** weeks of that job (v1 simplification — document this in the README).

### 4.2 Required test cases (implement as automated or in-page tests; they must pass)

Assume `weeklyHours = 14`. Note: Sunday 2026-11-08 starts the week 2026-11-08 → 2026-11-14.

1. Fully active week (period covers Sun–Sat) → required = **14**.
2. Period starts Wednesday 2026-11-11 (open) → active days Wed–Sat = 4 → required = **8**.
3. Period 2026-11-08 → 2026-11-10 (Sun–Tue), then paused → 3 active days → required = **6**.
4. Two periods in one week: Sun–Mon and Thu–Sat → 2 + 3 = 5 active days → required = **10**.
5. Pause and resume on the same day (overlapping periods) → that day counted **once**.
6. Month split: job fully active, week 2026-11-29 → 2026-12-05. November gets 2 days (Nov 29, 30) = **4h**, December gets 5 days (Dec 1–5) = **10h**.
7. A session from 23:00 to 01:00 next day → 1h on the first day and 1h on the second day.
8. Worked 16h in a 14h week → remaining = **−2h**, balance = **+2h**.
9. Whole-job total required = sum of all weekly required; total worked = sum of all sessions; balance = worked − required.

---

## 5. Data model

Single JSON document (`data.json`):

```json
{
  "version": 1,
  "jobs": [
    {
      "id": "uuid",
      "name": "Freelance project",
      "weeklyHours": 14,
      "status": "active",
      "periods": [
        { "start": "2026-11-01", "end": "2026-11-12" },
        { "start": "2026-11-22", "end": null }
      ],
      "timer": { "startedAt": "2026-11-22T08:00:00.000Z" },
      "createdAt": "ISO",
      "updatedAt": "ISO",
      "deletedAt": null
    }
  ],
  "sessions": [
    {
      "id": "uuid",
      "jobId": "uuid",
      "start": "ISO timestamp (UTC)",
      "end": "ISO timestamp (UTC)",
      "note": "",
      "updatedAt": "ISO",
      "deletedAt": null
    }
  ]
}
```

Rules:
- `status` is `"active" | "paused" | "ended"`. It must always be consistent with `periods`: `active` ⇔ the last period has `end: null`. `paused` and `ended` both close the last period with an end date.
- `timer` is `null` when the job is not running. It stores only `startedAt`. Elapsed time is always `now − startedAt` (never a ticking counter), so it survives refreshes and works across devices.
- **Each job has its own timer.** Multiple jobs may run timers at the same time. A single job may only have one timer at a time (starting an already running job is a no-op/disabled).
- Deletions are **soft** (`deletedAt` set) so syncing never resurrects deleted items. Hide soft-deleted items in the UI.
- Every create/update sets `updatedAt` to the current ISO time.
- Use `crypto.randomUUID()` for ids.
- The `version` field is reserved for future migrations. Add a `migrate(data)` function in `storage.js` that currently returns the data unchanged.

---

## 6. Storage and sync (GitHub API, no backend)

The source of truth is `data.json` inside a **private GitHub repo** the user creates (e.g., `hours-data`). The app (hosted on GitHub Pages from a different, public repo) reads and writes it using the GitHub REST API and a **fine-grained personal access token** limited to that one repo with **Contents: Read and write**.

### 6.1 Settings screen
Fields: **GitHub username/owner**, **data repository name**, **branch** (default `main`), **file path** (default `data.json`), **token** (password input). Buttons: **Test connection** and **Save**. Save the settings in `localStorage` under a single key (e.g., `hoursTracker.settings`). Include a short, plain-language help text explaining how to create the private repo and the fine-grained token. Include a "Clear token from this device" button.

### 6.2 API details
- Read: `GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}` with headers `Authorization: Bearer <token>` and `Accept: application/vnd.github+json`. The response has `content` (base64) and `sha`.
- Write: `PUT` the same URL with JSON body `{ message, content (base64), sha, branch }`. If the file does not exist yet (404 on first read), create it by omitting `sha` and start with an empty data document.
- **Base64 and UTF-8:** encode/decode correctly with `TextEncoder`/`TextDecoder` so non-ASCII text (including Arabic) survives. Do not use plain `btoa(string)` on non-ASCII data.
- Keep the last known `sha` in memory.

### 6.3 Save behavior
- After every change, update in-memory state, update the localStorage cache immediately, and then **debounce (≈500 ms)** a push to GitHub.
- **Conflict handling:** if the PUT fails with 409 or 422 (sha mismatch), re-fetch the remote file, **merge**, and retry (max 3 attempts).
- **Merge rule:** union of records by `id`; when the same `id` exists on both sides, keep the one with the **later `updatedAt`**. Soft-deleted records follow the same rule. For `job.timer` and `job.periods`, the job record with the later `updatedAt` wins as a whole.
- Show a persistent **sync indicator** in the header: `SAVED`, `SAVING…`, `ERROR — RETRY` (a retry button). Use the toast style for errors with a human-readable message (invalid token, repo not found, rate limit, network error).
- On app load: show cached data immediately (if any), then fetch the remote file and merge/replace. Also re-fetch when the tab becomes visible again (`visibilitychange`) and when the user presses a **Refresh** button, so a timer started on another device appears.
- Use the localStorage cache only as a speed-up and a safety net for unsent changes — never as the source of truth.
- If settings are missing, show a clear call-to-action card pointing to Settings.

---

## 7. Features and screens

Use hash-based routing (`#/`, `#/job/<id>`, `#/settings`) with no router library.

### 7.1 Dashboard (`#/`)
- Header with app name, sync indicator, Refresh and Settings buttons.
- A **"New job"** button opening a dialog (name, weekly hours; start date defaults to today and can be edited).
- A grid of **job cards**. Each card shows:
  - Name, status chip, weekly hours.
  - **This week:** worked, required (prorated), remaining (shown as e.g. `5H 30M LEFT` or `+2H 10M OVERTIME`), and a progress bar.
  - Big live **timer** when running (`HH:MM:SS`), updating every second via `setInterval`.
  - Buttons: **START** / **STOP** (timer), **PAUSE**, **END**, **RESUME / REOPEN** (as appropriate), **OPEN** (details).
- Filter or toggle to show/hide ended jobs.
- Format durations as `Xh Ym` consistently; keep numbers in the mono font.

### 7.2 Job detail (`#/job/<id>`)
Tabs:
1. **Overview:** whole-job totals (total required, total worked, balance), list of active periods with their dates, edit job (name, weekly hours), soft-delete job (with confirm dialog).
2. **Weeks:** table of **every week** from the first active day to the last relevant week (or the current week): week range (Sun–Sat), active days, required, worked, remaining, **balance** (green if ≥ 0, orange if < 0). Include a total row. This is the main view for deciding compensation.
3. **Months:** same columns grouped by calendar month, computed at day level so straddling weeks split correctly.
4. **Sessions:** list (newest first) with date, start, end, duration, note. Actions: edit, delete (soft), and **Add manual session** (date, start time, end time, note). Validate that `end > start`.

### 7.3 Job lifecycle actions
- **Pause** or **End:** if a timer is running, **stop it first and save the session**. Then close the open period with `end = today (local date)`, and set the status.
- **Resume** (from paused) or **Reopen** (from ended): append a new period `{ start: today, end: null }`, set status `active`. If the last period ended **today**, extend/merge by reopening it (`end = null`) rather than creating an overlapping period, while the active-day set logic still prevents double counting.
- **Start timer:** only allowed when status is `active` and `timer` is `null`. Sets `timer = { startedAt: now }`.
- **Stop timer:** creates a session from `startedAt` to `now`, sets `timer = null`. If the elapsed time is under ~5 seconds, ask for confirmation before saving (to avoid accidental taps), or discard on cancel.
- Edge: a timer left running across midnight is fine; the session is split by day when calculating.

### 7.4 Settings (`#/settings`)
As described in section 6.1, plus **Export JSON** (download current data) and **Import JSON** (file picker, validate structure, confirm before overwrite).

---

## 8. Code structure

```
/
├── index.html
├── README.md
├── css/
│   ├── tokens.css        # design tokens (section 3.2)
│   ├── base.css          # reset, typography, layout
│   └── components.css    # buttons, cards, inputs, chips, tables, tabs, modals, toasts, progress
├── js/
│   ├── app.js            # bootstrap, routing, global state, event wiring
│   ├── state.js          # in-memory store, mutations, updatedAt handling
│   ├── calc.js           # PURE functions: dates, active days, week/month/job stats
│   ├── storage.js        # localStorage cache, GitHub API client, merge, migrate
│   ├── timer.js          # start/stop logic, live ticking
│   ├── ui/
│   │   ├── dashboard.js
│   │   ├── jobDetail.js
│   │   ├── settings.js
│   │   └── components.js # helpers to build DOM elements, dialogs, toasts
│   └── utils.js          # formatting, uuid, base64 UTF-8 helpers
└── tests/
    └── calc.test.html    # in-browser test page covering section 4.2
```

Guidelines:
- `calc.js` must be **pure** (no DOM, no storage, no `Date.now()` inside; pass "today" and data in as arguments) so it is easy to test.
- Keep functions small and documented with short comments. No dead code.
- Use `const`/`let`, strict equality, and `"use strict"` semantics via modules.

---

## 9. Build order (implement in this order and verify each step)

1. **Scaffold + design system:** files, `tokens.css`, `base.css`, `components.css`, and a temporary style-guide section showing every component (buttons, inputs, cards, chips, progress bar, table, tabs, modal, toast) in the neo-brutalist style. **Self-check against section 3.4 (forbidden styling) before moving on.**
2. **`calc.js` + `tests/calc.test.html`:** implement all functions and make every case in section 4.2 pass.
3. **State + localStorage cache** with a working local-only version of jobs and sessions.
4. **Jobs UI:** create, edit, soft-delete, pause, end, resume/reopen with correct periods.
5. **Timers:** start/stop per job, live display, multiple jobs in parallel, session creation.
6. **Statistics screens:** dashboard weekly progress, Weeks tab, Months tab, Overview, Sessions tab with manual add/edit/delete.
7. **GitHub storage + sync:** settings screen, API client, debounced save, conflict handling and merge, sync indicator, visibility refresh.
8. **Export/Import, polish, empty/loading/error states, responsive pass, accessibility pass.**
9. **README + deployment notes.**

---

## 10. Edge cases to handle

- First run with no settings, and first sync when `data.json` does not exist yet.
- Invalid or expired token, wrong repo name, no network, and GitHub rate limiting (show clear error toasts).
- Timer running on another device: after refresh, show it running with the correct elapsed time.
- Two devices saving at nearly the same time (409/422 handling and merge).
- Pausing a job with a running timer (auto-stop and save session).
- A manual session on a paused/off day (allowed; counts as worked).
- Weeks that straddle two months (month stats are day-level).
- Midnight-crossing sessions (split by day).
- Editing or deleting a session that moves hours between weeks (statistics recompute from raw data).
- Invalid input: empty name, weekly hours ≤ 0 or non-numeric, end before start.
- DST changes (use date-string arithmetic for days; use timestamps only for durations).
- XSS safety for job names and notes (never inject as HTML).

---

## 11. Deployment (include in README.md)

1. Create a **public** repo for the app and push the code; enable **Settings → Pages** (deploy from the `main` branch, root).
2. Create a **private** repo (e.g., `hours-data`). Optionally add an initial `data.json` containing `{"version":1,"jobs":[],"sessions":[]}`.
3. Create a **fine-grained personal access token** limited to the private repo with **Contents: Read and write**.
4. Open the deployed site → Settings → enter owner, repo, branch, file path, token → Test connection → Save.
5. Repeat step 4 once on each device.
6. README must also explain the sign conventions (remaining vs balance), the day-based proration logic, the v1 limitation about changing `weeklyHours`, and how to back up using Export JSON.

---

## 12. Acceptance criteria (final checklist)

- [ ] All test cases in section 4.2 pass in `tests/calc.test.html`.
- [ ] A 14h/week job resumed on a Wednesday shows **8h** required for that week; paused after Tuesday shows **6h**.
- [ ] Multiple jobs can have timers running at the same time; each job has at most one.
- [ ] Remaining shows negative/overtime clearly when worked > required.
- [ ] Weeks, Months, and Overview statistics are all consistent with each other (sums match).
- [ ] Pause, End, Resume, and Reopen work and never double-count days.
- [ ] Data syncs through the private GitHub repo; a change on one device appears on another after refresh; conflicts are merged, not lost.
- [ ] The token is only in `localStorage` and never appears in the repo, URL, or logs.
- [ ] The UI strictly follows the neo-brutalist rules in section 3: thick black borders, hard offset shadows with no blur, flat saturated colors, zero border radius, bold uppercase headings, monospace numerals, and **none** of the forbidden styling in section 3.4.
- [ ] Works well on mobile and desktop; all controls are keyboard accessible with clearly visible focus.
- [ ] No frameworks, no build step, no external JS dependencies; deployable as static files on GitHub Pages.

---

## 13. Output expectations

- Deliver the complete file tree with full contents of every file (no placeholders, no "TODO", no truncated code).
- After building, run through section 12 yourself and report any item you could not satisfy, with the reason.
- Keep the final summary short: what was built, where the assumptions are, and how to deploy.
