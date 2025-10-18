# The Club Mahabaleshwar – Booking (v8)

Static, no-build scaffold meant for GitHub Pages. Drop this folder at the repo root and enable **Settings → Pages → main → /(root)**.

## How to Use

1. Upload **your data files**:
   - `data/uploads/rooms.csv` (use `data/uploads/rooms_schema.csv` as header reference)
   - `data/uploads/members.csv` (use `data/uploads/members_schema.csv` as header reference)
   - Replace `public/logo.png` with your club logo PNG

2. Verify & edit configuration in `data/config/`:
   - `rules.json` – booking windows, senior benefit, room limits, group caps
   - `restricted_periods.json` – Diwali/Xmas & Monsoon closure
   - `long_weekends.json` – declared long weekends (affects availability/limits)
   - `tariff.json` – inclusive of GST, parsed from Excel; edit if needed
     - Note: Tariff parsed from sheet 'Tariff Revision w.e.f 22.09 ' of the provided Excel.

3. Open `index.html` via GitHub Pages and test the demo.
   - The UI is intentionally minimal and split across **small files** for quick edits:
     - `src/display.js` – tiny DOM helpers
     - `src/app.js` – calendar + filters + demo rooms

## Edit Flow (safe)

When you need changes, first **only edit 1–2 files** (recommended order):
1. `data/config/rules.json`
2. `data/config/restricted_periods.json`

Commit and push. Then refresh the site with `?v=` cache buster if needed.
