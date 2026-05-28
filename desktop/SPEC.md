# Lead Finder Desktop Application

## Concept & Vision

Una aplicación de escritorio profesional que permite a los equipos de ventas buscar leads en Google Maps y gestionar su pipeline sin depender de servicios en la nube. El sistema combina la potencia del scraping con Scrapling, la gestión visual del Kanban, y la persistencia local para funcionar incluso sin conexión a internet.

La experiencia debe sentirse como una herramienta native - rápida, confiable, y sin las limitaciones del navegador.

## Design Language

### Aesthetic Direction
Inspirado en Notion y Linear: minimalista, limpio, con énfasis en la productividad y la claridad visual.

### Color Palette
- Primary: `#2563EB` (Blue-600)
- Secondary: `#7C3AED` (Violet-600)
- Success: `#16A34A` (Green-600)
- Warning: `#EA580C` (Orange-600)
- Background: `#F9FAFB` (Gray-50)
- Surface: `#FFFFFF` (White)
- Text Primary: `#111827` (Gray-900)
- Text Secondary: `#6B7280` (Gray-500)

### Status Colors (Pipeline)
- Frio: `#3B82F6` (Blue-500) - bg-blue-50
- Tibio: `#F59E0B` (Amber-500) - bg-amber-50
- Caliente: `#EF4444` (Red-500) - bg-red-50
- Contactado: `#8B5CF6` (Violet-500) - bg-purple-50
- Aceptado: `#22C55E` (Green-500) - bg-green-50
- Rechazado: `#9CA3AF` (Gray-400) - bg-gray-100

### Typography
- Font: Inter (system fallback: -apple-system, BlinkMacSystemFont, Segoe UI)
- Headings: 600-700 weight
- Body: 400-500 weight
- Monospace: JetBrains Mono for code/technical data

### Spatial System
- Base unit: 4px
- Padding: 8, 12, 16, 24, 32px
- Border radius: 6px (small), 8px (medium), 12px (large)
- Shadows: subtle (0 1px 2px) → elevated (0 10px 40px)

### Motion Philosophy
- Transitions: 150ms ease-out for interactions
- Page transitions: 250ms fade
- Loading states: subtle pulse animation
- Drag & drop: smooth transform with shadow elevation

## Architecture

### Cross-Platform Desktop App (Electron)

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   GUI Layer     │    │      Backend Layer          │ │
│  │  (Next.js)      │◄──►│   (Python + SQLite)        │ │
│  │  localhost:3000 │    │   localhost:8765           │ │
│  └─────────────────┘    └─────────────────────────────┘ │
│         │                          │                     │
│         │         ┌────────────────┘                     │
│         │         │                                      │
│    ┌────▼─────────▼────┐                                │
│    │   IPC Bridge      │                                │
│    │   (Electron IPC)  │                                │
│    └───────────────────┘                                │
└─────────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌─────────────┐
    │  Windows    │      │    Mac      │
    │  .exe       │      │    .app     │
    └─────────────┘      └─────────────┘
```

### Data Flow

1. **Online Mode:**
   - User triggers search → Electron spawns Python scraper
   - Scraper fetches from Google Maps → saves to SQLite
   - Sync service pushes to Supabase
   - Dashboard reads from SQLite (fast) + Supabase (authoritative)

2. **Offline Mode:**
   - Dashboard reads from local SQLite
   - All operations (status change, notes) save to SQLite
   - When online, sync service pushes to Supabase

### Python Backend (Flask Server)

- Port: 8765 (localhost only)
- Endpoints:
  - `POST /search` - Execute scraping
  - `GET /leads` - Get all leads from SQLite
  - `PATCH /leads/:id` - Update lead status/notes
  - `DELETE /leads/:id` - Delete lead
  - `GET /stats` - Get stats
  - `POST /sync` - Sync to Supabase
  - `GET /health` - Health check

### SQLite Schema (Local)

```sql
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    location TEXT,
    state TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    email TEXT,
    facebook TEXT,
    instagram TEXT,
    twitter TEXT,
    rating REAL,
    reviews_count INTEGER,
    source TEXT DEFAULT 'google_maps',
    source_url TEXT,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'frio',
    changed_at TEXT,
    synced INTEGER DEFAULT 0,
    timestamp TEXT
);

CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    lead_id INTEGER,
    timestamp TEXT,
    synced INTEGER DEFAULT 0
);
```

## Features

### 1. Dashboard (Main View)
- Metric cards: Total leads, Con teléfono, Con website, Rating promedio
- Status pie chart (donut)
- Category pie chart
- Map of Venezuela with accepted leads
- Quick filters

### 2. Pipeline Kanban
- 5 columns: Frio → Tibio → Caliente → Contactado → Aceptado (+ Rechazado)
- Drag & drop cards between columns
- Real-time status update (optimistic UI)
- Click card to open detail modal

### 3. Leads Table
- Full list with search and filters
- Multi-select for bulk operations
- Click to edit, status change inline
- Delete with confirmation

### 4. Search (Buscar Nuevos Leads)
- Category dropdown
- State/City selector
- Parish/Sector optional
- Deep mode toggle (phone, website, email, social)
- Progress indicator
- Cancel button

### 5. Sync Status Indicator
- Shows online/offline status
- Manual sync button
- Last sync timestamp
- Pending changes count

### 6. System Tray (Background Running)
- Minimize to system tray
- Notification on sync complete
- Quick actions menu

## Component Inventory

### LeadCard
- States: default, dragging, dropped, just-updated
- Shows: name, category, rating, city, phone badge
- Hover: shadow elevation, cursor grab

### StatusBadge
- 6 color variants matching status colors
- Pill shape with icon + text

### MetricCard
- States: default, loading (skeleton), hoverable
- Shows: icon, label, value, optional trend

### Modal
- Backdrop blur with overlay
- Slide-up animation
- Close on escape/outside click

### Button
- Variants: primary, secondary, ghost, danger
- States: default, hover, active, disabled, loading
- Sizes: sm, md, lg

### Toast Notifications
- Success (green), Error (red), Info (blue), Warning (amber)
- Auto-dismiss after 4s
- Stack up to 3

## Technical Stack

### Desktop
- Electron 31.x
- electron-builder for packaging
- electron-log for logging
- electron-updater for auto-updates (future)

### GUI
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- Recharts for charts
- React-Leaflet for map

### Backend
- Python 3.11+
- Flask (lightweight API)
- SQLite (local persistence)
- Scrapling (Google Maps scraping)
- Supabase Python client (cloud sync)

### Build
- Windows: NSIS installer (.exe)
- Mac: DMG package (.app)

## Security

- All local data encrypted at rest (SQLite encryption)
- API keys stored in OS keychain (keytar)
- No telemetry or data sent to external servers except Supabase
- Sandboxed renderer process
- Context isolation enabled

## Packaging

### Windows
- Output: `.exe` installer (NSIS)
- Icon: Custom app icon
- Start menu shortcut
- Desktop shortcut (optional)
- Uninstaller included

### Mac
- Output: `.dmg` package
- Code signing (if certificate available)
- Drag-to-Applications installer
- Notarization (if Apple Developer account)