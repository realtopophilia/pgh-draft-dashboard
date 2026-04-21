# Pittsburgh Draft Dashboard

Near-real-time civic data dashboard for the 2026 NFL Draft in Pittsburgh (April 23–25).
Audience: locals, press, data-curious civic folks. City-wide view, not just downtown.

**Deploy deadline: Wednesday April 22 night → Vercel**

## Framing rules
- Always say "near-real-time" — never "real-time"
- Every data feed's refresh cadence must be visible in layer tooltips AND on the `/about` page
- Geographic scope: City of Pittsburgh proper (not just downtown)

## Stack
- Next.js 16 App Router, TypeScript
- Tailwind CSS 3 + shadcn/ui
- MapLibre GL JS + Protomaps PMTiles (self-hosted, no API key needed for dev — falls back to OSM raster)
- TanStack Query for polling
- gtfs-realtime-bindings for protobuf decoding
- Recharts for side panels
- Deploying to Vercel

## Pittsburgh bounds
```
SW: 40.358, -80.095
NE: 40.501, -79.865
Center: -80.0, 40.44 (lng, lat)
Default zoom: 12
```
Defined in `lib/bounds.ts`.

## Architecture
Browser → polls Next.js API routes → external feeds.
All external calls go through API routes (CORS handling, edge caching, stable JSON contract).
Never call external feeds directly from the browser.

## Data sources & verified endpoints

| Layer | URL | Cadence | Status |
|-------|-----|---------|--------|
| PRT buses | `https://truetime.portauthority.org/gtfsrt-bus/vehicles` | 20s | ✅ Live, ~370 vehicles |
| PRT trains | `https://truetime.portauthority.org/gtfsrt-train/vehicles` | 20s | ✅ Live, ~19 vehicles (SLVR + BLUE) |
| NWS current | `https://api.weather.gov/stations/KPIT/observations/latest` | 10min | ✅ Live |
| NWS forecast | `https://api.weather.gov/gridpoints/PBZ/75,67/forecast/hourly` | 10min | ✅ Live, 96h |
| USGS Mon. River | `https://waterservices.usgs.gov/nwis/iv/?sites=03085000&parameterCd=00065&format=json` | 15min | ✅ Live |
| USGS Ohio River | `https://waterservices.usgs.gov/nwis/iv/?sites=03086000&parameterCd=00065&format=json` | 15min | ✅ Live |
| POGOH bikeshare | Unknown — no public GBFS found | 15s | ❌ Needs DevTools hunt on pogoh.com |
| ParkPGH garages | Unknown — no public API found | 30s | ❌ Needs DevTools hunt on parkpgh.org |
| 511PA traffic | `https://pa.511.org` dev API | 30s | ⏳ Key obtained, not yet integrated |

**POGOH & ParkPGH:** Both sites show live data in the browser but we haven't found their JSON endpoints yet.
Open DevTools → Network → XHR/Fetch on each site and look for JSON responses with availability data.

## What's built (Day 1 complete)

- `app/page.tsx` — main dashboard: map + side panel, layer toggles, live vehicle counts
- `app/api/transit/vehicles/route.ts` — fetches PRT protobuf, decodes, filters to Pittsburgh bounds, returns JSON
- `lib/feeds/prt.ts` — PRT feed utilities, decodes buses + trains in parallel
- `lib/bounds.ts` — Pittsburgh bounds + `inBounds()` helper
- `components/map/DraftMap.tsx` — MapLibre map, dark theme, Pittsburgh bounds locked
- `components/map/layers/TransitLayer.tsx` — amber dots (buses), blue dots (trains), click popup with route/speed/lag note, clusters only at zoom ≤9

## What still needs building

In priority order for the deploy deadline:

1. **Weather widget** — NWS current conditions in the side panel (temp, wind, precip chance for Draft weekend)
2. **River gauge widget** — Monongahela + Ohio levels with flood stage context
3. **ParkPGH garages** — garage availability dots on map + panel (needs endpoint discovery first)
4. **POGOH bikeshare** — station availability (needs endpoint discovery first)
5. **511PA traffic** — speed/incident layer on map
6. **Traffic cameras** — click camera icon → modal with live JPG, refreshes 30s; optional `/cameras` page
7. **Pressure Index** — composite crowd signal in `app/api/pressure-index/route.ts`
8. **Data Provenance page** — `app/about/page.tsx` with all refresh cadences listed
9. **Protomaps vector basemap** — swap OSM raster for Protomaps (get free key at protomaps.com/dashboard)

## Environment variables
Copy `.env.local.example` to `.env.local`:
```
NEXT_PUBLIC_PROTOMAPS_KEY=   # free key from protomaps.com/dashboard
PENNYDOT_511_KEY=            # 511PA dev key
```

## Running locally
```
npm install
npm run dev
# open http://localhost:3000
```

## Deploying
Push to GitHub → import project in Vercel → add env vars in Vercel dashboard → deploy.
