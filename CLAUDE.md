pgh-draft-dashboard — CLAUDE.md
Read this at the start of every session. It contains everything needed to work on this project without asking for context.


________________


What This Is
The Pittsburgh Draft Dashboard (https://pgh-draft-dashboard.vercel.app/) is a near-real-time civic data map built for the 2026 NFL Draft. It pulls together Pittsburgh's public data feeds — transit, parking, traffic, weather, river levels — onto one map with a "pressure score" summarizing conditions near the event footprint.


Built by Jason Griess (github.com/realtopophilia). Not a fan app — a public-interest tool for locals and visitors trying to navigate the city during major events.


This codebase is the foundation for a permanent city-wide event dashboard (Bird's Eye View). The immediate task is fixing issues identified in a Product Team review conducted April 24, 2026.


________________


Deployment
* Live URL: https://pgh-draft-dashboard.vercel.app/
* Repo: github.com/realtopophilia/pgh-draft-dashboard
* Deployment: Vercel (auto-deploys on push to main)


________________


Product Team Review — April 24, 2026
The dashboard was reviewed during the live NFL Draft event. Overall assessment: the core concept (pressure score + plain English headline) is solid. These are finishing issues, not fundamental problems.


________________


Implementation Tasks
Priority 1 — Before permanent version ships
1. Mobile layout


The right panel (pressure score, garage list, city-wide stats) is the most valuable part of the UI but is designed desktop-first. On a phone it is either off-screen or unusable.


What to do:


* On screens < 768px, stack the right panel below the map rather than beside it
* The pressure score headline + score number should be visible above the fold on mobile without scrolling
* The garage list and city-wide stats can be collapsed by default on mobile with a "Show details" toggle
* Test at 390px width (iPhone 14) and 360px width (common Android)


2. Color-blind accessibility on map layers


The map uses 6+ dot colors to distinguish layer types (pressure, buses, rail, incidents, parking, POGOH, Draft campus). Users with red-green or blue-yellow color blindness cannot reliably distinguish several of these.


What to do:


* Add a secondary visual signal to the two most critical layers: Pressure (red) and Incidents (pink/red). Options: different icon shape, border, or pattern fill
* Check the full layer set against a color-blind simulator (use the Chrome DevTools vision deficiency emulator or https://www.color-blindness.com/coblis-color-blindness-simulator/)
* The layer toggle labels in the right panel are already good — ensure they also show the icon shape/color swatch so users can cross-reference


3. API key audit


Before the permanent version gets press coverage or significant traffic, verify no API keys are exposed in client-side JavaScript.


What to do:


* Open browser DevTools → Network tab → reload page → inspect all outbound requests
* Check request URLs and headers for any API keys or tokens
* Any authenticated feed calls that currently happen client-side should move to a server-side route or Vercel Edge Function
* Specifically check: ParkPGH, any TrueTime endpoints that require auth, any weather API calls


________________


Priority 2 — Polish (can ship anytime)
4. Label POGOH


"POGOH" appears in the map legend and layer toggles without explanation. Visitors and newer residents don't know this is Pittsburgh's bike share system.


What to do:


* In the legend: change "POGOH" to "POGOH (bikes)"
* In the layer toggle button: same change
* No other changes needed


5. Default fewer layers on load


On first load, all layers are visible simultaneously, creating a dense map. Most users only need Pressure + Parking + Buses to answer their core question.


What to do:


* On initial load, default active layers to: Pressure, Buses, Parking
* Rail, Incidents, Cams, POGOH, Draft campus should be available via toggles but off by default
* Persist the user's layer choices in sessionStorage so toggling on a layer doesn't reset on refresh


6. Graceful feed degradation


Currently unclear what happens when a feed goes down mid-event (e.g., ParkPGH outage).


What to do:


* For the garage panel: if ParkPGH data is stale beyond a threshold (suggest: 5 minutes), show a banner "Parking data unavailable — last updated [time]" rather than silently showing stale data
* For the pressure score: if one of its input feeds drops, the score calculation should note which inputs are missing (e.g., "Based on transit data only — parking feed unavailable")
* For the "All feeds live" indicator: this should turn to a warning state if any feed is stale


________________


Priority 3 — Future version (Bird's Eye View)
These are not for the current dashboard but should inform the permanent version:


* Language support: Spanish at minimum. The permanent tool will serve visitors who may not read English. Investigate i18n options for Astro or whatever framework is in use.
* Foot traffic layer: No public feed exists for pedestrian density in Pittsburgh yet. Keep watching WPRDC for new datasets. When available, this becomes the most important layer.
* Event configurability: Abstract the "Draft footprint" concept into a configurable event zone. Allow swapping in different venue locations, event names, and date ranges without code changes.
* Private flight tracking: FAA ASDI feed or FlightAware API for tracking private jet arrivals during major events. Low priority but genuinely interesting data.


________________


Definition of Done (Priority 1 items)
* Right panel readable and usable on 390px mobile screen without horizontal scroll
* Pressure score visible above the fold on mobile
* No API keys visible in client-side network requests
* Color-blind check completed; Pressure and Incidents layers have secondary visual signal
* POGOH labeled as "POGOH (bikes)" in legend and toggles


________________


Relationship to Topophilia Site
Once Priority 1 items are complete, update the work entry on topophilia.city:


* File: src/content/work/pittsburgh-draft-dashboard.mdx
* No frontmatter changes needed — just note in the body that the dashboard has been updated post-Draft


The blog post ("What I built for the Draft — and why it should stay") is drafted and ready to publish. That lives in the topophilia repo, not this one. See topophilia/CLAUDE.md for publishing instructions.


________________


Mainspring Context
This project is part of Mainspring, Jason's AI-first civic tech agency. Full context at:


* Google Drive Folder: https://drive.google.com/drive/folders/1qtklQF6CMrdLbMDh-gLVSg--JRLrgOXL
* Master Context Doc: Google Drive File ID 1q6ZUfc5jtokndDmEtrMMm4HLlKDBxt9xwqu6HpA9FTI