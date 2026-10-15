# Essentials Nearby

A focused improvement to OpenStreetMap's "search a place, then find useful services near it" workflow. Built for the CIE case study *OpenStreetMap UX and Functionality Improvement Challenge*.

**Live demo:** https://YOUR-USERNAME.github.io/osm-essentials/
**Repository:** https://github.com/YOUR-USERNAME/osm-essentials

## Target user
Newcomers, such as first-year students, relocated workers and visitors, who do not know the area and need a pharmacy, ATM, clinic, food or a bus stop quickly.

## Problem
On openstreetmap.org, a search for "pharmacy near Indiranagar, Bengaluru" returns long address lines. These observations were made while logged out:

- Results show no distance and no walking time, so the user cannot tell which place is nearest.
- Each search covers one category. A user who also needs an ATM or clinic must search again.
- Clicking a result opens a place page written for map editors (node ID, version, changeset, raw tags) with no way to compare places.
- There is no option to save a place or keep a shortlist.

**Problem statement:** Newcomers using OpenStreetMap cannot quickly tell which essential services (pharmacy, ATM, clinic) are nearest. Search results show long addresses without distance or walking time, cover only one category per search, and cannot be saved for later.

## Solution
Essentials Nearby lets the user type a place (or use GPS), choose a radius and several categories, and get one list ranked by distance with walking time, plus markers on the map and a saved shortlist.

| OpenStreetMap search | Essentials Nearby |
|---|---|
| One kind of result per search | Many service types in one search |
| No distance or walking time | Ranked nearest first, with distance and walking time |
| Editor-style place pages | Simple cards: name, category, distance, hours if mapped |
| No shortlist | Save places and keep a shortlist with directions links |

## Features
- Place search with Nominatim, or "Me" button for GPS location
- Radius slider (200 m to 5000 m) and 7 category buttons loaded from `categories.json`
- Multi-category search in one request to the Overpass API
- Results sorted by distance or by name, with walking time (about 80 m per minute)
- Click a result to move the map to it; markers with popups
- Shortlist saved in the browser (localStorage) with a Directions link to openstreetmap.org
- Form validation with inline messages, loading skeletons, empty state, and error handling for offline, timeout, rate limit and "No place found"
- Backup Overpass servers; if none can be reached, clearly labelled **DEMO** data is shown (never mixed with real results)
- Responsive layout (phone to desktop)

## Technology
HTML5, Tailwind CSS (CDN), vanilla JavaScript, Leaflet, Fetch API with JSON. Data from OpenStreetMap through Nominatim and the Overpass API.

## Case study requirements
| Requirement | Where |
|---|---|
| Responsive HTML5 + Tailwind CSS | `index.html` |
| At least 3 JavaScript events | `app.js`: submit, input (slider), change (categories, sort), click (card, Save, Clear, location), keydown |
| Input form with validation and feedback | `validate()` in `app.js` |
| Fetch API and JSON handling | `categories.json`, Nominatim `geocode()`, Overpass `fetchPlaces()` |
| Error, loading and empty states | `runSearch()`, `renderResults()` |

## Project files
| File | Purpose |
|---|---|
| `index.html` | Page structure and Tailwind classes |
| `app.js` | Validation, fetch calls, distance calculation, rendering, events |
| `categories.json` | Service categories (id, label, icon, OSM tag) |
| `sample-places.json` | Demo data used only when the live server is unreachable |
| `README.md` | This file |
| `DOCUMENTATION.md` | Full report |

## Run locally
`fetch()` of `categories.json` needs http, so do not open `index.html` by double-clicking. Serve the folder instead:

```
python -m http.server 8000
```

Then open http://localhost:8000. In VS Code you can also use the Live Server extension and choose "Open with Live Server" on `index.html`.

## How to use
1. Type a place, for example `Indiranagar, Bengaluru`.
2. Move the slider to choose the radius.
3. Tick one or more categories (Pharmacy, ATM, Hospital / Clinic and so on).
4. Click **Find essentials**.
5. Click a result to see it on the map. Click **Save** to add it to My shortlist.

## Deploy to GitHub Pages
```
git init
git add .
git commit -m "feat: initial version of Essentials Nearby"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/osm-essentials.git
git push -u origin main
```
Then go to Settings, Pages, choose branch `main` and folder `/ (root)`, and save.

## Commit history (suggested)
1. `docs: add README and problem statement`
2. `feat: responsive layout with Tailwind`
3. `feat: category list loaded from JSON`
4. `feat: search with fetch, validation and error states`
5. `feat: demo data fallback when server is unreachable`
6. `docs: add testing, limitations and AI declaration`
7. `test: add testing evidence screenshots`

## Testing
A sample run for Indiranagar, Bengaluru with Pharmacy selected and a 1000 m radius found 32 places, with Amar Medicals (169 m), Sri Balaji Medicals (285 m) and Sai Ram Medicals (425 m) listed first. Two places were saved to the shortlist. The full test table and screenshots are in the project report.

## Limitations
- Results depend on how completely OpenStreetMap contributors have mapped an area; opening hours and phone numbers are often missing.
- The free public Nominatim and Overpass servers can be slow, blocked on some networks, or rate-limited.
- Walking time is an estimate from straight-line distance, not the real walking route.
- The shortlist is stored only in the user's own browser.
- Benchmark observations were made in one area while logged out.

## AI use declaration
I used Claude (Anthropic) to help generate the initial code structure and the documentation draft. I ran and tested the application myself, carried out the benchmark observations on openstreetmap.org, and took all screenshots myself.

## Credits
Map data © OpenStreetMap contributors. Geocoding by Nominatim. Places from the Overpass API. Map display by Leaflet.