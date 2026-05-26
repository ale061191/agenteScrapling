# Lead Finder - Prospeccion Comercial Venezuela

## Project Overview
Lead generation system using Scrapling to find potential clients for power bank rental stations in Venezuela. Targets restaurants, clubs, hotels, malls, parks, airports, gyms, hospitals/clinics across 24 Venezuelan states.

## Project Structure
```
agenteScrapling/
├── main.py                          # CLI entry point
├── AGENTS.md                        # This file - project documentation
├── lead_finder/
│   ├── __init__.py
│   ├── config.py                    # Business categories + Venezuela location hierarchy (24 states, ~50 cities)
│   ├── models.py                    # Lead dataclass with state/city/location/status/phone/website/rating
│   ├── storage.py                   # SQLite persistence + filters (category/status/state/city/search)
│   ├── exporter.py                  # CSV + JSON export with state/city fields
│   ├── runner.py                    # Orchestrator: run_all, run_category, run_state, export, stats
│   └── spiders/
│       └── maps.py                  # Google Maps spider (fast + deep mode) with StealthySession
├── leads_data/
│   ├── leads.db                     # SQLite database (75 leads - restaurantes en Los Teques, Miranda)
│   ├── leads.json                   # JSON export for dashboard
│   └── leads.csv                    # CSV backup
└── dashboard/                       # Next.js 14 App Router
    ├── app/
    │   ├── layout.tsx               # Root layout
    │   ├── globals.css              # Tailwind + custom animations
    │   ├── page.tsx                 # Landing page (redirects to /dashboard)
    │   ├── dashboard/
    │   │   └── page.tsx             # Main dashboard with sidebar + 4 sections
    │   └── api/
    │       ├── stats/route.ts       # GET /api/stats
    │       ├── search/route.ts      # POST /api/search (trigger) + GET /api/search?jobId= (poll)
    │       └── leads/
    │           ├── route.ts         # GET /api/leads?category=&status=&state=&city=&search=
    │           └── [id]/route.ts    # GET|PATCH /api/leads/:id
    ├── components/
    │   ├── MetricsCards.tsx         # 4 metric cards (total, phone, website, rating)
    │   ├── StatusPieChart.tsx       # Donut chart - leads by status
    │   ├── CategoryChart.tsx        # Pie chart - leads by category
    │   ├── PipelineBoard.tsx        # Kanban board with HTML5 drag & drop
    │   ├── LeadsTable.tsx           # Full leads table with filters
    │   └── LeadDetailModal.tsx      # Lead detail/edit modal
    └── lib/
        └── data.ts                  # Data layer: reads leads.json + status.json
```

## How to Run

### Scraper (Terminal 1)
```bash
cd "C:\Users\Voltaje Plus\Documents\agenteScrapling"
python main.py run restaurantes Miranda Los_Teques    # Specific city
python main.py run restaurantes Miranda               # All cities in Miranda
python main.py run restaurantes                        # All Venezuela
python main.py run                                     # All categories x all locations
python main.py run --deep ...                          # Deep mode (phone/website)
python main.py export                                  # Export CSV+JSON
python main.py stats                                   # Show stats
python main.py locations                               # List states/cities
```

### Dashboard (Terminal 2)
```bash
cd "C:\Users\Voltaje Plus\Documents\agenteScrapling\dashboard"
npm run dev
# Open http://localhost:3000/dashboard
```

## Architecture & Key Decisions

### Data Flow
1. Python scraper -> SQLite (`leads_data/leads.db`)
2. `python main.py export` -> `leads_data/leads.json`
3. Dashboard reads `leads.json` + `status.json` (status/notes overrides)
4. Dashboard writes status changes to `status.json` (not SQLite, avoid concurrency)

### Lead Status Pipeline
frio -> tibio -> caliente -> contactado -> aceptado | rechazado

### Dashboard Sections (Left Sidebar)
1. **Dashboard** - Metric cards + Status pie chart + Category pie chart + Filters
2. **Pipeline de Leads** - Kanban board (5 columns) with HTML5 drag & drop
3. **Todos los Leads** - Full table with search/filter + detail modal
4. **Buscar Nuevos Leads** - Search form (category/state/city/parish/sector/deep) that triggers scraper via API route, with progress polling and history

### Venezuela Locations (24 states, ~50 cities)
Defined in `lead_finder/config.py` as `VENEZUELA_LOCATIONS` dict.
Also hard-coded in `dashboard/app/dashboard/page.tsx` as `VENEZUELA_LOCATIONS`.
States without accents in TS version (encoding-safe).

### Search from Dashboard
- `POST /api/search` - spawns Python scraper as child process, returns `{ jobId }`
- `GET /api/search?jobId=` - polls job status from `leads_data/search_jobs.json`
- Dashboard polls every 3s, auto-refreshes leads on completion
- Supports parish/sector granularity in search queries

### Key Technical Decisions
- **Scrapling StealthySession** for Google Maps (Cloudflare bypass + stealth)
- **`page.evaluate()`** for extraction (dynamic class names per deployment)
- **SQLite UNIQUE(name, address, phone)** for dedup
- **Dual-file data** for dashboard: `leads.json` (Python export) + `status.json` (dashboard writes)
- **HTML5 Drag & Drop API** (no extra dependencies)
- **CSS animations** via Tailwind + custom keyframes in globals.css
- **No emojis in Python output** (Windows CP-1252 encoding issues)
- **UTF-8 encoding** for all data files (JSON, CSV, DB)

## CSS & Design Guidelines
- Color scheme: bg-gray-50, white cards, blue-600 primary
- Status colors: blue(frio), amber(tibio), red(caliente), purple(contactado), green(aceptado), gray(rechazado)
- Shadow: shadow-sm on cards, shadow-md on hover
- Border radius: rounded-xl (cards), rounded-lg (inputs/buttons)
- Animations: fadeSlideIn (0.35s) for section transitions, cardDrop (0.3s) for pipeline drops
- Sidebar: w-64 fixed, bg-white, border-r, sidebar-link class for items
- Hover effects: card-hover (shadow-md -translate-y-0.5)
- Font: Inter (Tailwind default), sizes: text-xs/10px/sm/base/text-lg/text-xl

## Current State
- 75 leads in DB (restaurantes en Los Teques, Miranda)
- All leads: status=frio, 3 phone (deep mode: +58412...+58424...), 63 with address
- Dashboard compiles and builds cleanly

## Spiders
### MapsSpider (`lead_finder/spiders/maps.py`)
- `search(category, location, deep=False, max_deep=5, state=None, city=None, parish=None, sector=None)`
- Constructs URL: `https://www.google.com/maps/search/{category}+en+{city},+{state},+Venezuela/`
- Fast mode: extracts names, ratings, reviews count, address from search results
- Deep mode: navigates to each place URL, extracts phone/website/address/email/facebook/instagram/twitter
- Phone: tel: links + Venezuelan pattern extract (+58...) + button tooltips
- Website: Sitio web/Website labeled links + first non-Google external link
- Social: facebook.com, instagram.com, twitter.com/x.com links
- Email: mailto: links + regex pattern on page text
- Handles Google consent page (clicks "Aceptar todo")
- Scrolling: 20 scrolls, 600ms delay per scroll

## Environment
- Python 3.14.3: `C:\Users\Voltaje Plus\AppData\Local\Python\bin\python.exe`
- Node.js v24.13.0, npm 11.6.2
- OS: Windows (handle encoding carefully - CP-1252 console)
- Working dir: `C:\Users\Voltaje Plus\Documents\agenteScrapling`
