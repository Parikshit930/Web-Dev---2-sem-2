
/* ═══════════════════════════════════════════════
   STRATOS — Weather Tracker  |  script.js
   Uses: Fetch API + async/await + LocalStorage
   API:  OpenWeatherMap (free tier)
═══════════════════════════════════════════════ */

// ──────────────────────────────────────────────
// 1.  CONFIGURATION
//     → Replace YOUR_API_KEY_HERE with your
//       free key from openweathermap.org
// ──────────────────────────────────────────────
const API_KEY  = "aaaba3f8c92ebee110625feff8327122";
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";
const UNITS    = "metric"; // "imperial" for °F

// ──────────────────────────────────────────────
// 2.  DOM REFERENCES
// ──────────────────────────────────────────────
const cityInput      = document.getElementById("city-input");
const searchBtn      = document.getElementById("search-btn");
const clearBtn       = document.getElementById("clear-btn");
const clearLogBtn    = document.getElementById("clear-log-btn");
const recentsList    = document.getElementById("recents-list");
const consoleBody    = document.getElementById("console-body");

// Result state panels
const resultEmpty    = document.getElementById("result-empty");
const resultLoading  = document.getElementById("result-loading");
const resultError    = document.getElementById("result-error");
const resultData     = document.getElementById("result-data");

// Result data fields
const resultCity     = document.getElementById("result-city");
const resultCountry  = document.getElementById("result-country");
const resultTemp     = document.getElementById("result-temp");
const weatherIcon    = document.getElementById("weather-icon");
const resultCondition= document.getElementById("result-condition");
const statFeels      = document.getElementById("stat-feels");
const statHumidity   = document.getElementById("stat-humidity");
const statWind       = document.getElementById("stat-wind");
const statVis        = document.getElementById("stat-vis");
const resultTimestamp= document.getElementById("result-timestamp");
const errorTitle     = document.getElementById("error-title");
const errorSub       = document.getElementById("error-sub");

// ──────────────────────────────────────────────
// 3.  LOCAL STORAGE HELPERS
//     Keys: "stratos_recents" → JSON array of strings
// ──────────────────────────────────────────────

/** Load recent searches array from localStorage (max 8 items). */
function loadRecents() {
  try {
    return JSON.parse(localStorage.getItem("stratos_recents")) || [];
  } catch {
    return [];
  }
}

/** Save city to recents list — newest first, no duplicates. */
function saveRecent(city) {
  const recents = loadRecents().filter(
    c => c.toLowerCase() !== city.toLowerCase()   // remove duplicate
  );
  recents.unshift(city);       // add to front
  if (recents.length > 8) recents.pop();  // cap at 8
  localStorage.setItem("stratos_recents", JSON.stringify(recents));
}

/** Remove all saved recents from localStorage. */
function clearRecents() {
  localStorage.removeItem("stratos_recents");
}

// ──────────────────────────────────────────────
// 4.  RENDER RECENT SEARCHES
// ──────────────────────────────────────────────

/** Rebuild the chips in the recents list. */
function renderRecents() {
  const recents = loadRecents();
  recentsList.innerHTML = "";

  if (recents.length === 0) {
    recentsList.innerHTML = `<span class="recents-empty">No searches yet</span>`;
    return;
  }

  recents.forEach(city => {
    const chip = document.createElement("button");
    chip.className = "recent-chip";
    chip.textContent = city;
    chip.setAttribute("title", `Search ${city} again`);
    // Clicking a chip triggers a fresh fetch
    chip.addEventListener("click", () => {
      cityInput.value = city;
      fetchWeather(city);
    });
    recentsList.appendChild(chip);
  });
}

// ──────────────────────────────────────────────
// 5.  CONSOLE LOG PANEL
// ──────────────────────────────────────────────

/**
 * Append a styled log line to the on-screen console panel.
 * @param {string} type  — "info" | "await" | "ok" | "err" | "data" | "sys"
 * @param {string} message
 */
function addLog(type, message) {
  const now    = new Date();
  const time   = now.toLocaleTimeString("en-GB", { hour12: false }); // HH:MM:SS

  // Tag labels map
  const tagMap = {
    sys:   "[SYS]",
    info:  "[INFO]",
    await: "[AWAIT]",
    ok:    "[OK]",
    err:   "[ERR]",
    data:  "[DATA]",
  };

  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-tag tag-${type}">${tagMap[type] || "[LOG]"}</span>
    <span class="log-msg">${escapeHtml(message)}</span>
  `;

  consoleBody.appendChild(entry);
  // Auto-scroll to newest entry
  consoleBody.scrollTop = consoleBody.scrollHeight;

  // Also mirror to browser DevTools console for reference
  console[type === "err" ? "error" : "log"](`[Stratos] ${message}`);
}

/** Simple HTML escape to avoid XSS from API responses in logs. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────
// 6.  RESULT STATE SWITCHER
// ──────────────────────────────────────────────

/** Show one result panel and hide the others. */
function showState(state) {
  // state: "empty" | "loading" | "error" | "data"
  resultEmpty.classList.toggle("hidden", state !== "empty");
  resultLoading.classList.toggle("hidden", state !== "loading");
  resultError.classList.toggle("hidden", state !== "error");
  resultData.classList.toggle("hidden", state !== "data");
}

// ──────────────────────────────────────────────
// 7.  RENDER WEATHER DATA
// ──────────────────────────────────────────────

/** Populate all result fields with API response data. */
function renderWeather(data) {
  const temp     = Math.round(data.main.temp);
  const feels    = Math.round(data.main.feels_like);
  const humidity = data.main.humidity;
  const windKph  = Math.round(data.wind.speed * 3.6);   // m/s → km/h
  const visKm    = data.visibility ? (data.visibility / 1000).toFixed(1) : "N/A";
  const iconCode = data.weather[0].icon;
  const iconUrl  = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  const condition= data.weather[0].description;
  const fetchTime= new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  resultCity.textContent      = data.name;
  resultCountry.textContent   = data.sys.country;
  resultTemp.textContent      = temp;
  weatherIcon.src             = iconUrl;
  weatherIcon.alt             = condition;
  resultCondition.textContent = condition;
  statFeels.textContent       = `${feels}°C`;
  statHumidity.textContent    = `${humidity}%`;
  statWind.textContent        = `${windKph} km/h`;
  statVis.textContent         = `${visKm} km`;
  resultTimestamp.textContent = `Last updated: ${fetchTime}`;
}

// ──────────────────────────────────────────────
// 8.  CORE ASYNC FETCH FUNCTION
//     This is the heart of the app — demonstrates
//     async/await and try...catch clearly.
// ──────────────────────────────────────────────

/**
 * Fetch weather data for a given city name.
 * Logs each step to the on-screen console panel.
 * @param {string} city
 */
async function fetchWeather(city) {
  // Guard: ignore empty input
  city = city.trim();
  if (!city) {
    addLog("err", "No city entered. Please type a city name.");
    return;
  }

  // ── Step A: Before fetch ──────────────────
  addLog("info", `Search initiated → "${city}"`);
  addLog("await", "Entering async function fetchWeather()…");
  addLog("info", "BEFORE fetch — synchronous code continues here");

  // Show loading UI + disable button
  showState("loading");
  searchBtn.classList.add("loading");
  searchBtn.disabled = true;

  // Construct the API URL
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${UNITS}`;
  addLog("await", `Awaiting fetch() → ${BASE_URL}?q=${city}&…`);

  // ── Step B: The async operation ──────────
  try {
    // JS pauses HERE at await — event loop is free
    const response = await fetch(url);

    addLog("info", "AFTER fetch — promise resolved, resuming async fn");
    addLog("data", `HTTP ${response.status} ${response.statusText}`);

    // Await JSON parsing (also async)
    addLog("await", "Awaiting response.json()…");
    const data = await response.json();
    addLog("info", "Data received — JSON parsed successfully");

    // ── Step C: Handle API-level errors ──────
    // OpenWeatherMap returns 200 with {cod:404} for unknown cities
    if (!response.ok || data.cod !== 200) {
      const message = data.message || "City not found";
      throw new Error(`API Error ${data.cod}: ${message}`);
    }

    // ── Step D: Success ───────────────────────
    addLog("ok",   `Weather data received for "${data.name}, ${data.sys.country}"`);
    addLog("data", `Temp: ${Math.round(data.main.temp)}°C | Condition: ${data.weather[0].description}`);
    addLog("data", `Humidity: ${data.main.humidity}% | Wind: ${Math.round(data.wind.speed * 3.6)} km/h`);

    renderWeather(data);
    showState("data");

    // Persist city to recent searches
    saveRecent(data.name);
    renderRecents();

  } catch (err) {
    // ── Step E: Error handling ────────────────
    addLog("err", `Fetch failed: ${err.message}`);

    // Determine friendly message
    let title = "Request Failed";
    let sub   = err.message;

    if (err.message.includes("404") || err.message.includes("city not found")) {
      title = "City Not Found";
      sub   = `"${city}" doesn't match any known city. Check spelling.`;
    } else if (!navigator.onLine) {
      title = "No Internet Connection";
      sub   = "Please check your network and try again.";
    } else if (err.message.toLowerCase().includes("401") || err.message.toLowerCase().includes("invalid")) {
      title = "Invalid API Key";
      sub   = "Set a valid API_KEY in script.js (line 5).";
    }

    errorTitle.textContent = title;
    errorSub.textContent   = sub;
    showState("error");

  } finally {
    // ── Step F: Always runs ───────────────────
    addLog("sys", "finally{} block — cleaning up, re-enabling button");
    searchBtn.classList.remove("loading");
    searchBtn.disabled = false;
  }
}

// ──────────────────────────────────────────────
// 9.  EVENT LISTENERS
// ──────────────────────────────────────────────

// Search button click
searchBtn.addEventListener("click", () => {
  fetchWeather(cityInput.value);
});

// Enter key in input
cityInput.addEventListener("keydown", e => {
  if (e.key === "Enter") fetchWeather(cityInput.value);
});

// Clear recents button
clearBtn.addEventListener("click", () => {
  clearRecents();
  renderRecents();
  addLog("sys", "Recent searches cleared from LocalStorage.");
});

// Clear console log button
clearLogBtn.addEventListener("click", () => {
  consoleBody.innerHTML = "";
  addLog("sys", "Console cleared.");
});

// ──────────────────────────────────────────────
// 10.  INITIALISATION
//      Runs once when the page loads.
// ──────────────────────────────────────────────
(function init() {
  showState("empty");
  renderRecents();
  addLog("sys", "DOM ready — event listeners attached.");
  addLog("sys", "LocalStorage recents loaded.");
  addLog("info", "Waiting for user input…");

  // Demo log to explain async execution order
  addLog("info", "Async model: synchronous code runs top-to-bottom;");
  addLog("info", "  fetch() suspends at 'await' → event loop is free.");
  addLog("info", "  Code after 'await' resumes once promise resolves.");
})();
