const money = (n) => "$" + Number(n || 0).toFixed(4),
  fmt = (n) => Number(n || 0).toLocaleString();
function positionTooltip(event, tip) {
  if (!event || !tip) return;
  tip.style.left = "0px";
  tip.style.top = "0px";
  const pad = 12,
    w = tip.offsetWidth,
    h = tip.offsetHeight;
  let left = event.clientX + pad,
    top = event.clientY + pad;
  if (left + w > window.innerWidth - pad) left = event.clientX - w - pad;
  if (top + h > window.innerHeight - pad) top = event.clientY - h - pad;
  tip.style.left =
    Math.max(pad, Math.min(left, window.innerWidth - w - pad)) + "px";
  tip.style.top =
    Math.max(pad, Math.min(top, window.innerHeight - h - pad)) + "px";
}
function bindTooltips() {
  document.querySelectorAll(".bar").forEach((bar) => {
    const tip = bar.querySelector("span");
    if (tip)
      bar.addEventListener("mousemove", (event) => positionTooltip(event, tip));
  });
}
function tooltip(x) {
  const day =
    x.period.length === 10
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(x.period + "T00:00:00Z"))
      : "";
  return (
    "<strong>" +
    (x.period.length === 10 ? formatDay(x.period) : x.period) +
    "</strong>" +
    (day ? " (" + day + ")" : "") +
    "<br>Input: " +
    fmt(x.input_tokens) +
    " tokens · " +
    money(x.input_cost) +
    "<br>Output: " +
    fmt(x.output_tokens) +
    " tokens · " +
    money(x.output_cost) +
    "<br>Thinking: " +
    fmt(x.reasoning_tokens) +
    " tokens<br><strong>Total cost: " +
    money(x.cost) +
    "</strong>"
  );
}
function chart(rows) {
  if (!rows.length) return '<p class="muted">No data yet.</p>';
  let max = Math.max(...rows.map((x) => Number(x.cost) || 0), 0.000001);
  return (
    '<div class="chart">' +
    rows
      .map(
        (x) =>
          '<div class="bar" style="height:' +
          Math.max(2, (Number(x.cost) / max) * 100) +
          '%">' +
          (Number(x.cost) > 0
            ? '<b class="bar-label">' + money(x.cost) + "</b>"
            : "") +
          "<span>" +
          tooltip(x) +
          "</span></div>",
      )
      .join("") +
    '</div><div class="muted" style="display:flex;justify-content:space-between"><span>' +
    (rows[0].period.length === 10
      ? formatDay(rows[0].period)
      : rows[0].period) +
    "</span><span>" +
    (rows[rows.length - 1].period.length === 10
      ? formatDay(rows[rows.length - 1].period)
      : rows[rows.length - 1].period) +
    "</span></div>"
  );
}
function providerCards(rows) {
  if (!rows.length) return "";
  return (
    '<div class="provider-cards">' +
    rows
      .map(
        (x) =>
          '<div class="provider-card"><div class="provider-name">' +
          x.provider +
          '</div><div class="provider-cost">' +
          money(x.cost) +
          '</div><div class="muted">' +
          fmt(x.total_tokens) +
          " tokens · " +
          fmt(x.requests) +
          " requests</div></div>",
      )
      .join("") +
    "</div>"
  );
}
function providerChart(rows) {
  if (!rows.length) return '<p class="muted">No provider data yet.</p>';
  let max = Math.max(...rows.map((x) => Number(x.cost) || 0), 0.000001);
  return rows
    .map(
      (x) =>
        '<div style="display:flex;align-items:center;gap:10px;margin:12px 0"><div style="width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        x.provider +
        '</div><div style="height:22px;background:#62a0ff;border-radius:3px;width:' +
        Math.max(2, (Number(x.cost) / max) * 70) +
        '%" title="' +
        money(x.cost) +
        '"></div><div>' +
        money(x.cost) +
        "</div></div>",
    )
    .join("");
}
const waterEnergy = {
    small: { low: 0.05, central: 0.15, high: 0.3 },
    medium: { low: 0.3, central: 1.5, high: 3 },
    frontier: { low: 100, central: 175, high: 250 },
    unknown: { low: 0.3, central: 2, high: 10 },
  },
  waterCooling = { low: 0.01, central: 0.4, high: 1 },
  waterGrid = { low: 0.01, central: 0.4, high: 1 },
  waterRegions = {
    global: 4.81,
    US_CA_CAMX: 5.19,
    EU_proxy: 3.22,
    China: 6.02,
    India: 3.45,
    lowWaterDC: 0.2,
  };
function litersFor(tokens, model, region, scenario) {
  const energy = (tokens * waterEnergy[model][scenario]) / 3600000;
  return (
    energy *
    (waterCooling[scenario] + waterRegions[region] * waterGrid[scenario])
  );
}
function waterAmount(liters) {
  if (liters < 0.001) return "< 0.001 L";
  if (liters < 1) return (liters * 1000).toFixed(1) + " mL";
  return liters.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " L";
}
function comparisonCount(value) {
  if (value < 0.1) return "";
  if (value < 10) return value.toFixed(1).replace(/\\.0$/, "");
  return Math.round(value).toLocaleString();
}
function waterComparisons(liters) {
  const items = [
    ["🥛", "glass of water", "glasses of water", 0.25],
    ["🚰", "500 mL bottle", "500 mL bottles", 0.5],
    ["🚽", "toilet flush", "toilet flushes", 6],
    ["🚿", "8-minute shower", "8-minute showers", 65],
    ["🛁", "bathtub", "bathtubs", 300],
    ["🥜", "kg of cashews", "kg of cashews", 4134],
    ["🚛", "milk tanker", "milk tankers", 30000],
    ["🐋", "blue whale", "blue whales", 150000],
    ["🧍", "human body", "human bodies", 42],
    ["🥤", "1.5 L Coke bottle", "1.5 L Coke bottles", 1.5],
    ["🏊", "Olympic swimming pool", "Olympic swimming pools", 2500000],
  ]
    .map(([icon, label, plural, unit]) => ({
      icon,
      label,
      plural,
      count: liters / unit,
    }))
    .filter((item) => item.count >= 0.1)
    .sort((a, b) => a.count - b.count);
  return (
    '<div class="water-comparison-heading">That\'s like:</div><div class="water-comparisons">' +
    (items.length
      ? items
      : [
          {
            icon: "💧",
            label: "liter of water",
            plural: "liters of water",
            count: liters,
          },
        ]
    )
      .map(
        (item, index) =>
          (index ? ' <span class="comparison-or">OR</span> ' : "") +
          '<div class="comparison-card"><div class="comparison-icon">' +
          item.icon +
          '</div><div class="comparison-value">' +
          comparisonCount(item.count) +
          '</div><div class="comparison-label">' +
          (item.count === 1 ? item.label : item.plural) +
          "</div></div>",
      )
      .join("") +
    "</div>"
  );
}
let currentWaterModels = [];
function classifyModel(model) {
  const name = String(model || "").toLowerCase();
  if (
    /opus|o[1-3](?:$|[-.])|gpt-5|gpt-4o(?!-mini)|gemini-2\\.[5-9]-pro|gemini-ultra|llama-4.*(405|70)b|claude-3\\.[5-9]|claude-sonnet-4|deepseek-r1/.test(
      name,
    )
  )
    return "frontier";
  if (
    /mini|nano|haiku|flash-lite|small|tiny|\\b[1-9]b\\b|\\b[1-7]b\\b|free|lite|instant/.test(
      name,
    )
  )
    return "small";
  return "medium";
}
function automaticWater(tokens, region, scenario) {
  return currentWaterModels.length
    ? currentWaterModels.reduce(
        (sum, row) =>
          sum +
          litersFor(
            Number(row.total_tokens || 0),
            classifyModel(row.model),
            region,
            scenario,
          ),
        0,
      )
    : litersFor(tokens, "medium", region, scenario);
}
function waterImpact(tokens) {
  const selected = document.getElementById("water-model")?.value || "auto",
    region = document.getElementById("water-region")?.value || "global";
  const automatic = selected === "auto";
  const breakdown = { small: 0, medium: 0, frontier: 0 };
  currentWaterModels.forEach((row) => {
    const category = classifyModel(row.model);
    breakdown[category] += Number(row.total_tokens || 0);
  });
  const breakdownText =
    automatic && currentWaterModels.length
      ? '<div class="muted">Automatic classification: ' +
        Object.entries(breakdown)
          .filter(([, value]) => value > 0)
          .map(([key, value]) => key + " " + fmt(value) + " tokens")
          .join(" · ") +
        "</div>"
      : "";
  return (
    '<div class="water-controls"><label>Model class <select id="water-model" onchange="renderWater()"><option value="auto"' +
    (automatic ? " selected" : "") +
    '>Automatic (recommended)</option><option value="small"' +
    (selected === "small" ? " selected" : "") +
    '>Low</option><option value="medium"' +
    (selected === "medium" ? " selected" : "") +
    '>Medium</option><option value="frontier"' +
    (selected === "frontier" ? " selected" : "") +
    '>Frontier</option><option value="unknown"' +
    (selected === "unknown" ? " selected" : "") +
    '>Unknown (wide range)</option></select></label><label>Region <select id="water-region" onchange="renderWater()">' +
    Object.entries({
      global: "Global Average",
      US_CA_CAMX: "US – California",
      EU_proxy: "EU Proxy",
      China: "China",
      India: "India",
      lowWaterDC: "Low-Water DC",
    })
      .map(
        ([key, label]) =>
          '<option value="' +
          key +
          '"' +
          (region === key ? " selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    "</select></label></div>" +
    breakdownText +
    '<div class="water-cards">' +
    ["low", "central", "high"]
      .map(
        (scenario) =>
          '<div class="water-card"><div class="muted">' +
          scenario.toUpperCase() +
          ' scenario</div><div class="water-value">' +
          waterAmount(
            automatic
              ? automaticWater(tokens, region, scenario)
              : litersFor(tokens, selected, region, scenario),
          ) +
          '</div><div class="muted">' +
          (scenario === "central" ? "Best estimate" : "Range estimate") +
          "</div></div>",
      )
      .join("") +
    "</div>" +
    waterComparisons(
      automatic
        ? automaticWater(tokens, region, "central")
        : litersFor(tokens, selected, region, "central"),
    ) +
    '<p class="muted">Based on ' +
    fmt(tokens) +
    " total tokens in the selected range. Estimates include data-center cooling and electricity-grid water use. Comparisons are approximate; cashew equivalence uses about 4,134 L per kg.</p>"
  );
}
function renderWater() {
  const target = document.getElementById("water-impact");
  if (target)
    target.innerHTML = waterImpact(Number(target.dataset.tokens || 0));
}
function formatDay(period) {
  const d = new Date(period + "T00:00:00Z");
  return (
    period +
    " " +
    new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      timeZone: "UTC",
    }).format(d)
  );
}
function fillZeros(rows, unit) {
  if (!document.getElementById("include-zeros").checked) return rows;
  const values = new Map(rows.map((x) => [x.period, x]));
  const first = document.getElementById("start-date").value || rows[0]?.period;
  const last = document.getElementById("end-date").value || rows.at(-1)?.period;
  if (!first || !last) return rows;
  const result = [];
  if (unit === "daily") {
    for (
      let d = new Date(first + "T00:00:00Z"),
        end = new Date(last + "T00:00:00Z");
      d <= end;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = d.toISOString().slice(0, 10);
      result.push(
        values.get(key) || {
          period: key,
          cost: 0,
          input_tokens: 0,
          output_tokens: 0,
        },
      );
    }
  } else if (unit === "weekly") {
    let d = new Date(first + "T00:00:00Z"),
      stop = new Date(last + "T00:00:00Z");
    d.setUTCDate(
      d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1),
    );
    for (; d <= stop; d.setUTCDate(d.getUTCDate() + 7)) {
      const year = d.getUTCFullYear(),
        jan = new Date(Date.UTC(year, 0, 1)),
        firstMonday = new Date(
          Date.UTC(year, 0, 1 + ((8 - jan.getUTCDay()) % 7)),
        ),
        week =
          d < firstMonday ? 0 : Math.floor((d - firstMonday) / 604800000) + 1,
        key = year + "-W" + String(week).padStart(2, "0");
      result.push(values.get(key) || { period: key, cost: 0 });
    }
  } else if (unit === "monthly") {
    const start = first.slice(0, 7),
      end = last.slice(0, 7);
    for (
      let d = new Date(start + "-01T00:00:00Z"),
        stop = new Date(end + "-01T00:00:00Z");
      d <= stop;
      d.setUTCMonth(d.getUTCMonth() + 1)
    ) {
      const key = d.toISOString().slice(0, 7);
      result.push(values.get(key) || { period: key, cost: 0 });
    }
  } else if (unit === "annual") {
    for (
      let year = Number(first.slice(0, 4));
      year <= Number(last.slice(0, 4));
      year++
    ) {
      const key = String(year);
      result.push(values.get(key) || { period: key, cost: 0 });
    }
  }
  return result;
}
function localDate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function setPreset(field, preset) {
  const d = new Date();
  if (preset === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  } else if (preset === "month") {
    d.setDate(1);
  } else if (preset === "year") {
    d.setMonth(0, 1);
  }
  document.getElementById(field === "start" ? "start-date" : "end-date").value =
    localDate(d);
}
let refreshTimer;
let countdownTimer;
let refreshRemaining = 0;
function updateCountdown() {
  const target = document.getElementById("refresh-countdown");
  if (target)
    target.textContent =
      refreshRemaining > 0 ? "next in " + refreshRemaining + "s" : "paused";
}
function setRefresh(seconds) {
  if (refreshTimer) clearInterval(refreshTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  refreshRemaining = seconds;
  document
    .querySelectorAll("[data-refresh]")
    .forEach((button) =>
      button.classList.toggle(
        "active",
        Number(button.dataset.refresh) === seconds,
      ),
    );
  updateCountdown();
  if (seconds > 0) {
    refreshTimer = setInterval(() => {
      refreshRemaining = seconds;
      load();
    }, seconds * 1000);
    countdownTimer = setInterval(() => {
      if (refreshRemaining > 0) refreshRemaining--;
      updateCountdown();
    }, 1000);
  }
  load();
}
function selectedRange() {
  const start = document.getElementById("start-date").value,
    end = document.getElementById("end-date").value,
    zeros = document.getElementById("include-zeros").checked;
  let query = [];
  if (start) query.push("start=" + encodeURIComponent(start));
  if (end) query.push("end=" + encodeURIComponent(end));
  if (zeros) query.push("zeros=1");
  return query.length ? "?" + query.join("&") : "";
}
function load() {
  if (typeof htmx === "undefined") return;
  htmx.ajax("GET", "/fragments/dashboard" + selectedRange(), {
    target: "#app",
    swap: "innerHTML",
  });
}
document.body.addEventListener("htmx:afterSwap", (event) => {
  if (event.target.id === "controls") setRefresh(15);
  if (event.target.id === "app") {
    const water = document.getElementById("water-impact");
    currentWaterModels = water?.dataset.models
      ? JSON.parse(water.dataset.models)
      : [];
    bindTooltips();
    renderWater();
  }
});
if (document.getElementById("start-date")) setRefresh(15);
