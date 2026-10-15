// Essentials Nearby – focused improvement on OpenStreetMap's "search + find nearby places" workflow.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
const SAVED_KEY = "essentials-saved-v1";

const FALLBACK_CATEGORIES = [
  { id: "pharmacy", label: "Pharmacy", icon: "💊", tag: "amenity", value: "pharmacy" },
  { id: "hospital", label: "Hospital / Clinic", icon: "🏥", tag: "amenity", value: "hospital|clinic" },
  { id: "atm", label: "ATM", icon: "🏧", tag: "amenity", value: "atm" },
  { id: "restaurant", label: "Food", icon: "🍽️", tag: "amenity", value: "restaurant|cafe|fast_food" },
  { id: "supermarket", label: "Grocery", icon: "🛒", tag: "shop", value: "supermarket|convenience" },
  { id: "bus", label: "Bus stop", icon: "🚌", tag: "highway", value: "bus_stop" },
  { id: "police", label: "Police", icon: "🚓", tag: "amenity", value: "police" }
];

const $ = (id) => document.getElementById(id);
const state = { categories: [], center: null, results: [], saved: loadSaved(), markers: new Map(), selected: new Set() };

// ---------- Map ----------
const map = L.map("map").setView([20.59, 78.96], 5);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "© OpenStreetMap contributors"
}).addTo(map);
const markerLayer = L.layerGroup().addTo(map);
let centerMarker = null, radiusCircle = null;

// ---------- Helpers ----------
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
}
function persistSaved() {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved)); } catch { /* storage blocked */ }
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const walkMin = (m) => Math.max(1, Math.round(m / 80)); // ~4.8 km/h
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function setStatus(msg, type = "info") {
  const colors = { info: "text-slate-600", error: "text-red-700 bg-red-50 p-3 rounded-lg", ok: "text-emerald-700" };
  $("status").className = "text-sm " + colors[type];
  $("status").innerHTML = msg;
}
function showError(id, msg) {
  const el = $(id);
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}
function setLoading(on) {
  $("submitBtn").disabled = on;
  $("submitBtn").textContent = on ? "Searching…" : "Find essentials";
}

// ---------- Load JSON config (fetch + JSON) ----------
async function loadCategories() {
  try {
    const res = await fetch("categories.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.categories) || data.categories.length === 0) throw new Error("categories.json has no 'categories' list");
    state.categories = data.categories;
  } catch (err) {
    state.categories = FALLBACK_CATEGORIES;
    setStatus("Could not load categories.json (" + escapeHtml(err.message) + "). Using a reduced default list.", "error");
  }
  renderCategories();
}
function renderCategories() {
  const box = $("categoryBox");
  box.innerHTML = "";
  state.categories.forEach((c) => {
    const lbl = document.createElement("label");
    lbl.className = "cursor-pointer";
    lbl.innerHTML = `<input type="checkbox" value="${c.id}" class="peer sr-only" />
      <span class="inline-block border rounded-full px-3 py-1 text-sm peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:border-emerald-600 peer-focus-visible:ring-2 ring-emerald-500">${c.icon} ${c.label}</span>`;
    // EVENT 1: change on category chips
    lbl.querySelector("input").addEventListener("change", (e) => {
      e.target.checked ? state.selected.add(c.id) : state.selected.delete(c.id);
      if (state.selected.size) showError("catError", "");
    });
    box.appendChild(lbl);
  });
}

// ---------- Validation ----------
function validate() {
  let ok = true;
  const place = $("place").value.trim();
  if (place.length < 3) { showError("placeError", "Enter at least 3 characters for a place."); ok = false; }
  else if (/^[\d\s.,-]+$/.test(place) && !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(place)) {
    showError("placeError", "Enter a place name, or coordinates like 12.97, 77.59."); ok = false;
  } else showError("placeError", "");
  const r = Number($("radius").value);
  if (!(r >= 200 && r <= 5000)) { showError("radiusError", "Radius must be between 200 m and 5000 m."); ok = false; }
  else showError("radiusError", "");
  if (state.selected.size === 0) { showError("catError", "Pick at least one category."); ok = false; }
  return ok;
}

// ---------- API calls ----------
async function geocode(q) {
  const m = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { lat: +m[1], lon: +m[2], name: `${m[1]}, ${m[2]}` };
  const res = await fetch(`${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Geocoding service returned " + res.status);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    const e = new Error(`No place found for “${q}”. Try a nearby landmark or add the city name.`);
    e.userFacing = true; throw e;
  }
  return { lat: +data[0].lat, lon: +data[0].lon, name: data[0].display_name };
}

async function fetchPlaces(lat, lon, radius, cats) {
  const parts = cats.map((c) => {
    const f = c.value.includes("|") ? `["${c.tag}"~"^(${c.value})$"]` : `["${c.tag}"="${c.value}"]`;
    return `node${f}(around:${radius},${lat},${lon});way${f}(around:${radius},${lat},${lon});`;
  }).join("");
  const query = `[out:json][timeout:15];(${parts});out center 80;`;
  try {
    const json = await overpassRequest(query);
    return json.elements.map((el) => {
      const plat = el.lat ?? el.center?.lat, plon = el.lon ?? el.center?.lon;
      const tags = el.tags || {};
      const cat = cats.find((c) => {
        const vals = c.value.split("|");
        return vals.includes(tags[c.tag]);
      }) || cats[0];
      return {
        id: el.type + el.id, lat: plat, lon: plon, cat,
        name: tags.name || `${cat.label} (unnamed)`,
        hours: tags.opening_hours || null,
        phone: tags.phone || tags["contact:phone"] || null,
        dist: haversine(lat, lon, plat, plon)
      };
    }).filter((p) => p.lat != null && p.lon != null);
  } catch (err) {
    throw err;
  }
}

// Fallback: placeholder places placed around the searched point (clearly labelled as demo in the UI).
async function demoPlaces(center, radius, cats) {
  try {
    const res = await fetch("sample-places.json");
    if (!res.ok) return [];
    const data = await res.json();
    const ids = new Set(cats.map((c) => c.id));
    return data.places.filter((p) => ids.has(p.cat)).map((p, i) => {
      const lat = center.lat + p.north / 111320;
      const lon = center.lon + p.east / (111320 * Math.cos((center.lat * Math.PI) / 180));
      const cat = cats.find((c) => c.id === p.cat);
      return { id: "demo" + i, lat, lon, cat, name: p.name + " (demo)", hours: null, phone: null,
        dist: haversine(center.lat, center.lon, lat, lon) };
    }).filter((p) => p.dist <= radius);
  } catch { return []; }
}

// Tries each Overpass mirror in turn (12 s each) so one slow server does not break the app.
async function overpassRequest(query) {
  let lastErr = null;
  for (const url of OVERPASS_SERVERS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: ctrl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) throw new Error(res.status === 429 ? "Server is busy (rate limit)." : "Places service returned " + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.elements)) throw new Error("Unexpected response from places service.");
      return json;
    } catch (err) {
      lastErr = err.name === "AbortError" ? new Error("The places server was too slow.") : err;
    } finally { clearTimeout(t); }
  }
  throw new Error((lastErr ? lastErr.message + " " : "") + "All servers failed. Try a smaller radius or retry in a minute.");
}

// ---------- Rendering ----------
function renderResults() {
  const list = $("results");
  list.innerHTML = "";
  markerLayer.clearLayers();
  state.markers.clear();
  const sorted = [...state.results].sort($("sortSel").value === "name"
    ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.dist - b.dist);

  if (sorted.length === 0 && state.center) {
    list.innerHTML = `<li class="bg-white rounded-xl p-4 text-sm text-slate-600">No matching places found in this radius. Try increasing the radius or choosing more categories. (OpenStreetMap coverage varies by area.)</li>`;
    return;
  }
  sorted.forEach((p) => {
    const li = document.createElement("li");
    li.className = "bg-white rounded-xl shadow-sm p-3 flex gap-3 items-start hover:ring-2 ring-emerald-400 cursor-pointer";
    li.tabIndex = 0;
    const isSaved = state.saved.some((s) => s.id === p.id);
    li.innerHTML = `<div class="text-2xl">${p.cat.icon}</div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold truncate">${escapeHtml(p.name)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(p.cat.label)} · ${fmtDist(p.dist)} · ~${walkMin(p.dist)} min walk</p>
        <p class="text-xs mt-1">${p.hours ? "🕒 " + escapeHtml(p.hours) : "<span class='text-slate-400'>Opening hours not mapped</span>"}${p.phone ? " · 📞 " + escapeHtml(p.phone) : ""}</p>
      </div>
      <button type="button" data-save="${p.id}" class="text-sm border rounded px-2 py-1 ${isSaved ? "bg-emerald-100" : "hover:bg-slate-100"}">${isSaved ? "Saved ✓" : "Save"}</button>`;
    // EVENT 2: click/keyboard on card focuses map
    const focus = () => { map.flyTo([p.lat, p.lon], 17); state.markers.get(p.id)?.openPopup(); };
    li.addEventListener("click", (e) => { if (!e.target.closest("button")) focus(); });
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === li) focus(); });
    // EVENT 3: click on save button
    li.querySelector("button").addEventListener("click", () => toggleSave(p));
    list.appendChild(li);

    const mk = L.marker([p.lat, p.lon]).bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${fmtDist(p.dist)} away`).addTo(markerLayer);
    state.markers.set(p.id, mk);
  });
}

function toggleSave(p) {
  const i = state.saved.findIndex((s) => s.id === p.id);
  if (i >= 0) state.saved.splice(i, 1);
  else state.saved.push({ id: p.id, name: p.name, label: p.cat.label, icon: p.cat.icon, lat: p.lat, lon: p.lon, dist: p.dist });
  persistSaved(); renderSaved(); renderResults();
}
function renderSaved() {
  const ul = $("saved");
  $("savedCount").textContent = state.saved.length ? `(${state.saved.length})` : "";
  if (!state.saved.length) { ul.innerHTML = `<li class="text-slate-500">Nothing saved yet. Tap “Save” on a result to build a shortlist.</li>`; return; }
  ul.innerHTML = state.saved.map((s) => `<li class="flex justify-between gap-2"><span>${s.icon} ${escapeHtml(s.name)}</span>
    <a class="text-emerald-700 underline whitespace-nowrap" target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?route=;${s.lat},${s.lon}">Directions</a></li>`).join("");
}

function drawCenter(lat, lon, radius) {
  if (centerMarker) map.removeLayer(centerMarker);
  if (radiusCircle) map.removeLayer(radiusCircle);
  centerMarker = L.circleMarker([lat, lon], { radius: 8, color: "#047857", fillColor: "#10b981", fillOpacity: 1 }).addTo(map).bindPopup("You are here");
  radiusCircle = L.circle([lat, lon], { radius, color: "#10b981", weight: 1, fillOpacity: 0.05 }).addTo(map);
  map.fitBounds(radiusCircle.getBounds());
}

// ---------- Main search ----------
async function runSearch(preset) {
  if (!validate()) return;
  setLoading(true);
  setStatus("⏳ Locating and searching nearby places…");
  $("results").innerHTML = Array.from({ length: 3 }, () => `<li class="bg-white rounded-xl p-4 animate-pulse h-16"></li>`).join("");
  try {
    const radius = Number($("radius").value);
    const center = preset || await geocode($("place").value.trim());
    state.center = center;
    const cats = state.categories.filter((c) => state.selected.has(c.id));
    drawCenter(center.lat, center.lon, radius);
    let usingDemo = false;
    try {
      state.results = await fetchPlaces(center.lat, center.lon, radius, cats);
    } catch (liveErr) {
      state.results = await demoPlaces(center, radius, cats);
      if (!state.results.length) throw liveErr;
      usingDemo = true;
    }
    renderResults();
    if (usingDemo) {
      setStatus("⚠️ Live OpenStreetMap place server unreachable. Showing <b>DEMO data</b> (placeholder names, not real places) so you can try the app.", "error");
    } else {
      setStatus(state.results.length ? `Found <b>${state.results.length}</b> places near <i>${escapeHtml(center.name.split(",").slice(0, 2).join(","))}</i>.` : "", "ok");
    }
  } catch (err) {
    state.results = []; $("results").innerHTML = ""; markerLayer.clearLayers();
    const offline = !navigator.onLine ? "You appear to be offline. " : "";
    let msg = err.message || "Something went wrong.";
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      msg = "Could not reach the map servers. Check your internet, turn off VPN/ad-blocker for this page, then click Find essentials again.";
    }
    setStatus("⚠️ " + offline + escapeHtml(msg), "error");
  } finally { setLoading(false); }
}

// ---------- Event wiring ----------
// EVENT 4: submit
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
// EVENT 5: input on slider (live label)
$("radius").addEventListener("input", (e) => { $("radiusLabel").textContent = e.target.value + " m"; });
// EVENT 6: change on sort
$("sortSel").addEventListener("change", renderResults);
// EVENT 7: live validation clearing
$("place").addEventListener("input", () => { if ($("place").value.trim().length >= 3) showError("placeError", ""); });
// EVENT 8: geolocation button
$("locBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("⚠️ Geolocation is not supported by this browser.", "error");
  setStatus("⏳ Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => { $("place").value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; runSearch({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: "your location" }); },
    (err) => setStatus("⚠️ Could not get location: " + escapeHtml(err.message) + ". Type a place instead.", "error"),
    { timeout: 10000 }
  );
});
$("clearSaved").addEventListener("click", () => { state.saved = []; persistSaved(); renderSaved(); renderResults(); });

loadCategories();
renderSaved();