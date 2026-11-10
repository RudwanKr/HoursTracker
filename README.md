# Hours Tracker

A personal, static, neo-brutalist web app for tracking hours worked per week across multiple jobs — hosted on GitHub Pages, synced via a private GitHub repository.

## Features

- Track hours for multiple jobs simultaneously
- Live timer per job (survives refresh, works across devices)
- Weekly, monthly, and all-time statistics
- Required hours prorated by active days (paused days don't count)
- Overtime shows as negative remaining / positive balance
- Data stored in a private GitHub repo — no backend required
- Fully offline-capable data model (online-only sync, no PWA/SW)

---

## Deployment

### 1 — App repo (public, GitHub Pages)

1. Create a **public** GitHub repository (e.g. `hours-tracker`).
2. Push all files from this folder to `main`.
3. Go to **Settings → Pages** → Deploy from branch `main`, root `/`.
4. GitHub will give you a URL like `https://yourusername.github.io/hours-tracker/`.

### 2 — Data repo (private)

1. Create a **private** GitHub repository (e.g. `hours-data`).
2. Optionally create an initial `data.json`:
   ```json
   { "version": 1, "jobs": [], "sessions": [] }
   ```

### 3 — Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Fine-grained personal access tokens**.
2. Click **Generate new token**.
3. Set the name, expiration, and restrict access to **only** the private `hours-data` repo.
4. Under **Repository permissions**, grant **Contents: Read and write**.
5. Copy the token (you'll only see it once).

### 4 — Configure the app

1. Open the deployed site.
2. Click **Settings** in the header.
3. Enter:
   - **GitHub Owner / Username** — your GitHub username
   - **Repository Name** — `hours-data`
   - **Branch** — `main`
   - **File Path** — `data.json`
   - **Personal Access Token** — paste your token
4. Click **Test Connection** to verify, then **Save**.
5. Repeat on each device you want to use.

---

## How it works

### Sign conventions

| Term | Definition |
|---|---|
| **Required hours** | `weeklyHours × (activeDays / 7)` for the period |
| **Worked hours** | Sum of all sessions in the period |
| **Remaining** | `required − worked` (negative = overtime) |
| **Balance** | `worked − required` (positive = surplus/overtime; negative = owed) |

### Day-based proration

Hours are prorated by **active days**, not calendar days. A job has *active periods* (start → end date ranges). Days outside any period (e.g. while paused) do not contribute to `requiredHours`. This means:

- A 14h/week job active only Wednesday–Saturday has **8h** required that week (4/7 × 14).
- Pausing on Tuesday means only Sun–Tue (3 days) count → **6h** required.
- **Weeks are independent** — there is no carry-over of balance between weeks.

### Changing `weeklyHours` (v1 limitation)

In v1, `weeklyHours` is a single value per job and applies to **all weeks** of that job retroactively. If you change it, all historical required hours recalculate. A future version may store per-period rates.

### Midnight-crossing sessions

Sessions that cross local midnight are split at midnight so each day gets its correct worked hours.

---

## Backup

Use **Settings → Export JSON** at any time to download a full backup of your data. Use **Import JSON** to restore (this overwrites all current data — confirm before proceeding).

---

## Assumptions / choices made where the spec was silent

| Decision | Chosen approach |
|---|---|
| Short session threshold | < 5 seconds triggers a confirmation prompt |
| Session crossing midnight in dialog | If end time < start time, end is treated as next-day |
| `weeklyHours` on job edit | Applied globally to all weeks (documented above) |
| DST handling | Day arithmetic uses `Date.UTC()` integer days; durations use UTC timestamps |

---

## Development

No build step, no npm, no bundler. Serve the files statically:

```bash
# Python
python -m http.server 8080

# Node (via npx)
npx serve .
```

Then open `http://localhost:8080`.

Run the test suite by opening `http://localhost:8080/tests/calc.test.html` in your browser.

---

## File structure

```
/
├── index.html              # App shell + hash router entry point
├── css/
│   ├── tokens.css          # Design tokens (colors, spacing, fonts)
│   ├── base.css            # Reset, typography, layout grid
│   └── components.css      # All component styles (buttons, cards, tabs…)
├── js/
│   ├── app.js              # Bootstrap, routing, event wiring
│   ├── state.js            # In-memory store + mutations
│   ├── calc.js             # Pure date/stats functions
│   ├── storage.js          # localStorage cache + GitHub API client
│   ├── timer.js            # Timer start/stop + live ticking
│   ├── utils.js            # Formatting, UUID, base64 helpers
│   └── ui/
│       ├── dashboard.js    # Dashboard page renderer
│       ├── jobDetail.js    # Job detail (tabs: Overview/Weeks/Months/Sessions)
│       ├── settings.js     # Settings page renderer
│       └── components.js   # DOM builder helpers, toasts, modals
└── tests/
    └── calc.test.html      # In-browser test suite (section 4.2 cases)
```

