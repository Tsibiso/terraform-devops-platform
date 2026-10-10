
const API = {
  health: "/health",
  properties: "/api/properties",
  latest: "/api/telemetry/latest?limit=10",
  alerts: "/api/alerts?limit=10",
  generate: "/api/telemetry/generate",
};

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function number(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setHealth(id, text, state) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = `health-status ${state}`;
}

function showNotice(message, isError = false) {
  const notice = $("#notice");
  notice.textContent = message;
  notice.classList.remove("hidden", "error");
  if (isError) notice.classList.add("error");
}

function clearNotice() {
  $("#notice").classList.add("hidden");
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function renderProperties(properties) {
  const body = $("#properties-table");
  $("#property-table-count").textContent =
    `${properties.length} PROPERTIES`;
  $("#property-count").textContent = number(properties.length, 0);

  if (!properties.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-cell">No readings yet. Generate your first batch.</td></tr>';
    return;
  }

  body.innerHTML = properties.map((property) => `
    <tr>
      <td>
        <div class="property-cell">
          <span class="property-icon">⌂</span>
          <div>
            <div class="property-name">${escapeHTML(property.property_name)}</div>
            <div class="property-id">${escapeHTML(property.property_id)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHTML(property.site)}</td>
      <td>${number(property.reading_count, 0)}</td>
      <td>${number(property.total_electricity_kwh)} kWh</td>
      <td>${number(property.total_water_kl, 3)} kL</td>
      <td><span class="data-tag">SIMULATED</span></td>
    </tr>
  `).join("");
}

function renderRecent(readings) {
  const body = $("#recent-table");

  if (!readings.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty-cell">No telemetry recorded yet. Generate a batch to begin.</td></tr>';
    return;
  }

  body.innerHTML = readings.map((reading) => `
    <tr>
      <td>${escapeHTML(reading.property_name)}</td>
      <td>${number(reading.electricity_kwh)} kWh</td>
      <td>${number(reading.water_kl, 3)} kL</td>
      <td>${reading.anomaly
        ? '<span class="alert-pill">HIGH USAGE</span>'
        : '<span class="data-tag">NORMAL</span>'}</td>
      <td>${escapeHTML(dateTime(reading.timestamp))}</td>
    </tr>
  `).join("");
}

function renderAlerts(alerts) {
  $("#alert-count").textContent =
    `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;
  $("#alert-nav-count").textContent = alerts.length;

  const list = $("#alerts-list");

  if (!alerts.length) {
    list.innerHTML = `
      <div class="empty-state">
        <strong>No anomaly alerts right now.</strong><br>
        The simulator occasionally generates unusually high usage.
        Generate more readings to explore the alert workflow.
      </div>`;
    return;
  }

  list.innerHTML = alerts.map((alert) => `
    <article class="alert-item">
      <span class="alert-icon">!</span>
      <div class="alert-copy">
        <strong>${escapeHTML(alert.property_name)} · ${escapeHTML(alert.severity)}</strong>
        <p>${escapeHTML(alert.message)}</p>
        <p>Electricity: ${number(alert.electricity_kwh)} kWh · Water: ${number(alert.water_kl, 3)} kL</p>
        <p>${escapeHTML(dateTime(alert.timestamp))} · Simulated event</p>
      </div>
    </article>
  `).join("");
}

function renderBarChart(elementId, readings, key, color, unit, digits = 2) {
  const container = document.getElementById(elementId);

  if (!readings.length) {
    container.innerHTML = '<div class="chart-empty">Generate telemetry to populate this chart.</div>';
    return;
  }

  const width = 480;
  const height = 230;
  const left = 42;
  const right = 14;
  const top = 22;
  const bottom = 45;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const values = readings.map((item) => Number(item[key] || 0));
  const maxValue = Math.max(...values, 0.001) * 1.18;
  const step = chartWidth / readings.length;
  const barWidth = Math.min(34, step * 0.53);

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(unit)} by property">`;

  for (let i = 0; i <= 4; i++) {
    const y = top + (chartHeight * i / 4);
    const tickValue = maxValue * (1 - i / 4);
    svg += `
      <line class="chart-gridline" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>
      <text class="chart-label" x="${left - 7}" y="${y + 3}" text-anchor="end">${number(tickValue, digits)}</text>`;
  }

  readings.forEach((reading, index) => {
    const value = values[index];
    const barHeight = value / maxValue * chartHeight;
    const x = left + step * index + (step - barWidth) / 2;
    const y = top + chartHeight - barHeight;
    const label = String(reading.property_name || reading.property_id || "")
      .replace(/\s+(Office|Property|Park|Commercial|Site)$/i, "")
      .slice(0, 9);

    svg += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"
        rx="4" fill="${color}" opacity="0.88">
        <title>${escapeHTML(reading.property_name)}: ${number(value, digits)} ${unit}</title>
      </rect>
      <text class="chart-value" x="${x + barWidth / 2}" y="${Math.max(top + 10, y - 7)}" text-anchor="middle">${number(value, digits)}</text>
      <text class="chart-label" x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle">${escapeHTML(label)}</text>`;
  });

  svg += "</svg>";
  container.innerHTML = svg;
}

async function refreshDashboard() {
  const refreshButton = $("#refresh-btn");
  refreshButton.disabled = true;

  try {
    const health = await getJSON(API.health);
    setHealth(
      "api-status",
      health.status === "healthy" ? "Online" : "Degraded",
      health.status === "healthy" ? "online" : "offline",
    );
  } catch {
    setHealth("api-status", "Offline", "offline");
    setHealth("db-status", "Unknown", "offline");
    showNotice("The API is unavailable. Check that your FastAPI server is running.", true);
    refreshButton.disabled = false;
    return;
  }

  try {
    const [properties, readings, alerts] = await Promise.all([
      getJSON(API.properties),
      getJSON(API.latest),
      getJSON(API.alerts),
    ]);

    setHealth("db-status", "Connected", "online");
    clearNotice();

    const totalElectricity = properties.reduce(
      (sum, property) => sum + Number(property.total_electricity_kwh || 0), 0,
    );
    const totalWater = properties.reduce(
      (sum, property) => sum + Number(property.total_water_kl || 0), 0,
    );
    const totalReadings = properties.reduce(
      (sum, property) => sum + Number(property.reading_count || 0), 0,
    );

    $("#reading-count").textContent = number(totalReadings, 0);
    $("#electricity-total").textContent = number(totalElectricity);
    $("#water-total").textContent = number(totalWater);

    renderProperties(properties);
    renderRecent(readings);
    renderAlerts(alerts);
    renderBarChart("electricity-chart", properties, "total_electricity_kwh", "#6495ff", "kWh");
    renderBarChart("water-chart", properties, "total_water_kl", "#36d6cf", "kL", 3);
  } catch (error) {
    setHealth("db-status", "Unavailable", "offline");
    showNotice(`Could not load telemetry: ${error.message}`, true);
  } finally {
    refreshButton.disabled = false;
  }
}

async function generateReadings() {
  const button = $("#generate-btn");
  button.disabled = true;
  button.innerHTML = "<span>↻</span> Generating…";

  try {
    const response = await fetch(API.generate, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Generation failed (${response.status})`);
    }

    const result = await response.json();
    await refreshDashboard();
    showNotice(`Success: ${result.count} simulated readings saved to SQLite.`);
  } catch (error) {
    showNotice(`Could not generate readings: ${error.message}`, true);
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>＋</span> Generate readings";
  }
}

$("#generate-btn").addEventListener("click", generateReadings);
$("#refresh-btn").addEventListener("click", refreshDashboard);

document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

refreshDashboard();