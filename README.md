# Pittsburgh Draft Dashboard

Near-real-time civic dashboard for the **2026 NFL Draft in Pittsburgh (April 23–25)**.  
Live at **[pgh-draft-dashboard.vercel.app](https://pgh-draft-dashboard.vercel.app)**

---

## What this is

The NFL Draft is coming to Pittsburgh April 23–25, 2026. Hundreds of thousands of people will move through the city over three days — by bus, light rail, car, bike, and on foot. City services will be strained. Parking will be chaotic. The rivers will be there regardless.

This dashboard is a **city-wide near-real-time civic data view** built for the duration of the event. It's not a fan app or an NFL product — it's a public-interest tool that pulls together the data feeds Pittsburgh already publishes (transit, traffic, parking, weather, river levels) and puts them on one map.

**Audience:** locals trying to get around, press covering the event, and data-curious civic folks who want to see what's actually happening across the city — not just at the stadium.

**Framing:** Near-real-time, always. This dashboard shows where things are right now, with honest labels on how stale each feed is.

---

## Original project spec

> **STACK (committed):**
> - Next.js 15 App Router, TypeScript, deploying to Vercel
> - Tailwind + shadcn/ui
> - MapLibre GL JS + Protomaps (self-hosted PMTiles, no API key)
> - TanStack Query for polling
> - gtfs-realtime-bindings for protobuf
> - Recharts for side panels
>
> **FRAMING:** Use "near-real-time" everywhere, never "real-time." Every data feed's refresh cadence should be visible on the Data Provenance page and in layer tooltips.
>
> **GEOGRAPHIC BOUNDS (City of Pittsburgh proper):**
> ```
> SW: 40.358, -80.095
> NE: 40.501, -79.865
> ```
>
> **DATA SOURCES (verified):**
> - PRT vehicles: `https://truetime.portauthority.org/gtfsrt-bus/` (20s poll)
> - PRT trains: `https://truetime.portauthority.org/gtfsrt-train/` (20s poll)
> - PennDOT 511PA: pa.511.org dev key — speeds, incidents, cameras (30s poll)
> - Traffic cameras: from 511PA feed — JPG stills refreshing ~30s
> - POGOH GBFS: verify URL first; fallback scrape pogoh.com (15s poll)
> - ParkPGH garages: parkpgh.org — find JSON or scrape (30s poll)
> - NWS weather: api.weather.gov/gridpoints/PBZ/… (10min poll)
> - USGS river gauges: waterservices.usgs.gov/nwis/iv (15min poll)
>
> **ARCHITECTURE:**
> Browser → polls Next.js API routes → external feeds. All external calls go through our API routes for CORS, edge caching, and a stable JSON contract.
>
> **TRAFFIC CAMERAS:** clicking a camera icon opens a modal with the live JPG, refreshing every 30 seconds. The modal shows camera name, route, and direction. Optional /cameras page tiles 6–12 cams at once for a "situation room" view.

---

## What's built

**Day 1 complete — PRT transit layer end-to-end:**
- MapLibre GL JS map locked to Pittsburgh city limits
- PRT buses (amber dots) and light rail (blue dots) updated every 20 seconds
- Click any vehicle for a popup: route, vehicle ID, speed, heading, data lag note
- Side panel with live vehicle counts and layer toggles
- API routes proxy all external feeds (CORS, caching, stable JSON contract)

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Map | MapLibre GL JS + Protomaps PMTiles |
| Data fetching | TanStack Query (polling) |
| Transit decoding | gtfs-realtime-bindings (protobuf) |
| Charts | Recharts |
| Deploy | Vercel |

---

## Getting started

```bash
git clone https://github.com/realtopophilia/pgh-draft-dashboard.git
cd pgh-draft-dashboard
npm install
cp .env.local.example .env.local
npm run dev
# open http://localhost:3000
```

The app works without any API keys — it falls back to OpenStreetMap raster tiles.  
For the full dark vector basemap, add a free Protomaps key (see `.env.local.example`).

---

## Architecture

```
Browser → polls /api/* routes → external feeds
```

All external calls go through Next.js API routes. The browser never touches upstream feeds directly. This handles CORS, lets us normalize response shapes, and gives Vercel edge caching a clean target.

**Key files:**
```
app/
  page.tsx                        # main dashboard
  api/transit/vehicles/route.ts   # PRT protobuf → JSON
lib/
  feeds/prt.ts                    # fetch + decode buses & trains
  bounds.ts                       # Pittsburgh city limits + inBounds()
components/
  map/DraftMap.tsx                 # MapLibre setup, OSM fallback
  map/layers/TransitLayer.tsx      # vehicle dots, clustering, popups
```

---

## Data sources

| Feed | Endpoint | Cadence | Status |
|------|----------|---------|--------|
| PRT buses | `truetime.portauthority.org/gtfsrt-bus/vehicles` | 20s | ✅ live |
| PRT trains | `truetime.portauthority.org/gtfsrt-train/vehicles` | 20s | ✅ live |
| NWS current | `api.weather.gov/stations/KPIT/observations/latest` | 10min | ✅ verified, not wired |
| NWS forecast | `api.weather.gov/gridpoints/PBZ/75,67/forecast/hourly` | 10min | ✅ verified, not wired |
| USGS rivers | `waterservices.usgs.gov/nwis/iv/?sites=03085000,03086000` | 15min | ✅ verified, not wired |
| ParkPGH garages | unknown | 30s | ❌ needs XHR hunt on parkpgh.org |
| POGOH bikeshare | unknown | 15s | ❌ needs XHR hunt on pogoh.com |
| 511PA traffic | `pa.511.org` | 30s | ⏳ key in hand, not wired |

**For ParkPGH and POGOH:** open DevTools → Network → XHR/Fetch on their sites and find the JSON endpoint that serves availability data. Once found, drop the URL in the corresponding API route stub.

---

## What to build next (priority order for Wednesday deploy)

1. **Weather widget** — NWS endpoint verified, just needs an API route + side panel component
2. **River gauges** — USGS endpoint verified, needs API route + gauge widget with flood stage context
3. **ParkPGH garages** — map dots + panel, endpoint TBD
4. **POGOH bikeshare** — map dots + panel, endpoint TBD
5. **511PA traffic** — speed/incident layer
6. **Traffic cameras** — camera icon on map → modal with live JPG refreshing every 30s; optional `/cameras` situation room page
7. **Pressure Index** — composite crowd signal from transit + parking + weather
8. **Data Provenance page** — `/about` listing all sources and refresh cadences

---

## Framing rules (important for the public-facing product)

- Say **"near-real-time"** everywhere — never "real-time"
- Every layer tooltip must show its refresh cadence
- The `/about` page must list all data sources with cadences
- Geographic scope is **City of Pittsburgh proper** — bounds in `lib/bounds.ts`

---

## Env vars

```bash
NEXT_PUBLIC_PROTOMAPS_KEY=   # free at protomaps.com/dashboard
PENNYDOT_511_KEY=            # 511PA dev key
```

Add these in the Vercel dashboard under Project → Settings → Environment Variables.
