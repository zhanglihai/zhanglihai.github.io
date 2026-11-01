(() => {
  "use strict";

  const root = document.querySelector(".sports-app");
  if (!root) return;

  const DATA_ROOT = "/assets/sports/data";
  const colors = ["#1f6d4d", "#ef8753", "#628fce", "#9674c8"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  async function getJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load data (${response.status})`);
    return response.json();
  }

  const number = (value, digits = 0) => Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const distance = (meters, digits = 1) => number(Number(meters || 0) / 1000, digits);
  const hours = (seconds) => number(Number(seconds || 0) / 3600, 1);

  function metricsHtml(totals) {
    return `<section class="sports-metrics" aria-label="Sports summary">
      <article class="sports-metric"><span>Total distance</span><strong>${distance(totals.distance_m)}</strong><small>km</small></article>
      <article class="sports-metric"><span>Active time</span><strong>${hours(totals.duration_s)}</strong><small>hours</small></article>
      <article class="sports-metric"><span>Activities</span><strong>${number(totals.count)}</strong><small>total</small></article>
      <article class="sports-metric"><span>Calories burned</span><strong>${number(totals.calories)}</strong><small>kcal</small></article>
    </section>`;
  }

  function heroHtml(title, copy, totals, eyebrow = "MY MOTION ARCHIVE") {
    return `<section class="sports-hero">
      <p class="sports-eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p class="sports-hero-copy">${escapeHtml(copy)}</p>
      <div class="sports-hero-meta">
        <span><strong>${distance(totals.distance_m, 0)}</strong>km</span>
        <span><strong>${number(totals.count)}</strong>activities</span>
        <span><strong>${hours(totals.duration_s)}</strong>hours</span>
      </div>
    </section>`;
  }

  function fail(error) {
    root.innerHTML = `<div class="sports-error"><strong>Sports data is temporarily unavailable</strong>${escapeHtml(error.message || error)}</div>`;
  }

  async function renderHome() {
    const data = await getJson(`${DATA_ROOT}/summary.json`);
    const first = data.year_range[0];
    const last = data.year_range[1];
    root.innerHTML = heroHtml(
      "Every step counts.",
      `A year-by-year view of every walk, run, and ride from ${first} to ${last}.`,
      data.totals,
    ) + metricsHtml(data.totals) + `
      <div class="sports-section-heading"><div><p class="sports-eyebrow">YEAR BY YEAR</p><h2>Annual Sports Archive</h2></div><p>Select a year or sport to view its summary</p></div>
      <section class="sports-year-list">${data.years.map((year) => `
        <article class="sports-year-card">
          <a class="sports-year-head" href="/sports/${year.year}/"><strong>${year.year}</strong><span>${number(year.totals.count)} activities &middot; ${distance(year.totals.distance_m)} km &rarr;</span></a>
          <div class="sports-year-sports">${year.sports.map((sport) => `
            <a class="sports-type-link" href="/sports/${year.year}/?sport=${encodeURIComponent(sport.sport_slug)}">
              <b>${escapeHtml(sport.sport)}</b>
              <span>${distance(sport.distance_m)} km &middot; ${hours(sport.duration_s)} hours</span>
              <span>${number(sport.count)} activities &middot; ${number(sport.calories)} kcal</span>
            </a>`).join("")}</div>
        </article>`).join("")}</section>`;
  }

  function monthChart(months, selectedMonth) {
    const values = months.map((item) => Number(item.distance_m || 0) / 1000);
    const width = 720, height = 220, left = 35, bottom = 28, top = 12;
    const innerW = width - left - 10, innerH = height - bottom - top;
    const max = Math.max(...values, 1), step = innerW / 12, barWidth = step * .58;
    const grid = [0, .25, .5, .75, 1].map((ratio) => {
      const y = top + innerH * (1 - ratio);
      return `<line class="sports-grid-line" x1="${left}" y1="${y}" x2="${width - 10}" y2="${y}"/><text class="sports-axis" x="0" y="${y + 3}">${number(max * ratio)}</text>`;
    }).join("");
    const bars = values.map((value, index) => {
      const h = Math.max(value ? 2 : 0, value / max * innerH), x = left + index * step + (step - barWidth) / 2, y = top + innerH - h;
      const active = Number(selectedMonth) === index + 1 ? ' style="fill:#1f6d4d"' : "";
      return `<g><title>${monthNames[index]}: ${number(value, 1)} km</title><rect class="sports-bar"${active} x="${x}" y="${y}" width="${barWidth}" height="${h}"/><text class="sports-axis" text-anchor="middle" x="${x + barWidth / 2}" y="${height - 8}">${monthNames[index]}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly distance">${grid}${bars}</svg>`;
  }

  function compositionHtml(sports, selectedMonth) {
    const values = sports.map((sport) => {
      const aggregate = selectedMonth ? sport.months[Number(selectedMonth) - 1] : sport;
      return { sport: sport.sport, distance: aggregate.distance_m, count: aggregate.count };
    }).filter((item) => item.count > 0).sort((a, b) => b.distance - a.distance);
    const total = values.reduce((sum, item) => sum + item.distance, 0) || 1;
    return values.map((item, index) => `<div class="sports-composition-row">
      <span>${escapeHtml(item.sport)} &middot; ${item.count}</span>
      <div class="sports-composition-track"><div class="sports-composition-fill" style="width:${item.distance / total * 100}%;background:${colors[index % colors.length]}"></div></div>
      <b>${number(item.distance / total * 100, 1)}%</b>
    </div>`).join("") || '<div class="sports-empty">No data available</div>';
  }

  function refreshYear(data, filters) {
    const sport = data.sports.find((item) => item.sport_slug === filters.sport);
    const months = sport ? sport.months : data.months;
    const totals = filters.month ? months[Number(filters.month) - 1] : (sport || data.totals);
    for (const [id, selected] of [["sportsSportFilter", filters.sport], ["sportsMonthFilter", filters.month]]) {
      document.querySelectorAll(`#${id} button[data-value]`).forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.value === selected));
      });
    }
    document.querySelector("#sportsDynamicMetrics").innerHTML = metricsHtml(totals);
    document.querySelector("#sportsMonthChart").innerHTML = monthChart(months, filters.month);
    document.querySelector("#sportsComposition").innerHTML = compositionHtml(sport ? [sport] : data.sports, filters.month);
  }

  async function renderYear() {
    const year = Number(root.dataset.year);
    const data = await getJson(`${DATA_ROOT}/years/${year}.json`);
    const requestedSport = new URLSearchParams(location.search).get("sport") || "";
    const filters = {
      sport: data.sports.some((item) => item.sport_slug === requestedSport) ? requestedSport : "",
      month: "",
    };
    const sportButtons = [{ sport_slug: "", sport: "All sports" }, ...data.sports].map((item) =>
      `<button type="button" class="sports-filter-button" data-value="${escapeHtml(item.sport_slug)}" aria-pressed="false">${escapeHtml(item.sport)}</button>`
    ).join("");
    const monthButtons = [`<button type="button" class="sports-filter-button" data-value="" aria-pressed="false">All year</button>`,
      ...Array.from({ length: 12 }, (_, index) => `<button type="button" class="sports-filter-button" data-value="${index + 1}" aria-pressed="false">${index + 1}</button>`)
    ].join("");
    root.innerHTML = `<a class="sports-back" href="/sports/">&larr; Back to Sports</a>
      ${heroHtml(`${year} Sports Summary`, "Explore cumulative distance, time, activities, and calories by sport and month. Individual activities are not published.", data.totals, "ANNUAL MOTION ARCHIVE")}
      <div class="sports-toolbar" aria-label="Sports filters">
        <div class="sports-filter-row">
          <span class="sports-filter-label" id="sportsSportLabel">Sport</span>
          <div class="sports-filter-options" id="sportsSportFilter" role="group" aria-labelledby="sportsSportLabel">${sportButtons}</div>
        </div>
        <div class="sports-filter-row">
          <span class="sports-filter-label" id="sportsMonthLabel">Month</span>
          <div class="sports-filter-options sports-filter-months" id="sportsMonthFilter" role="group" aria-labelledby="sportsMonthLabel">${monthButtons}</div>
        </div>
      </div>
      <div id="sportsDynamicMetrics"></div>
      <section class="sports-analytics"><article class="sports-panel"><p class="sports-eyebrow">MONTHLY DISTANCE</p><h3>Distance by Month</h3><div class="sports-chart" id="sportsMonthChart"></div></article>
      <article class="sports-panel"><p class="sports-eyebrow">SPORT MIX</p><h3>Distance by Sport</h3><div class="sports-composition" id="sportsComposition"></div></article></section>`;
    for (const [id, key] of [["sportsSportFilter", "sport"], ["sportsMonthFilter", "month"]]) {
      const group = document.querySelector(`#${id}`);
      group.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-value]");
        if (!button || !group.contains(button)) return;
        filters[key] = button.dataset.value;
        refreshYear(data, filters);
      });
    }
    refreshYear(data, filters);
  }

  const renderers = { home: renderHome, year: renderYear };
  Promise.resolve(renderers[root.dataset.sportsPage]?.()).catch(fail);
})();
