require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// landing page — just shows what endpoints exist, handy when opening in a browser
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crop Advisory API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f4f0; color: #1a1a1a; padding: 2rem; }
    header { background: #2d6a2d; color: #fff; padding: 1.5rem 2rem; border-radius: 10px; margin-bottom: 2rem; }
    header h1 { font-size: 1.6rem; }
    header p  { margin-top: .4rem; opacity: .85; font-size: .95rem; }
    section   { background: #fff; border-radius: 10px; padding: 1.5rem 2rem; margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    h2        { font-size: 1.05rem; color: #2d6a2d; margin-bottom: 1rem; border-bottom: 1px solid #e0ebe0; padding-bottom: .5rem; }
    table     { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th        { text-align: left; padding: .5rem .75rem; background: #f5f9f5; color: #555; font-weight: 600; border-bottom: 2px solid #d4e8d4; }
    td        { padding: .5rem .75rem; border-bottom: 1px solid #eef4ee; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    a         { color: #2d6a2d; font-family: monospace; font-size: .88rem; word-break: break-all; }
    .badge    { display: inline-block; font-size: .75rem; font-weight: 700; padding: .15rem .45rem; border-radius: 4px; }
    .get      { background: #dff0d8; color: #2d6a2d; }
    .post     { background: #dce8f8; color: #1a4f8a; }
    .desc     { color: #555; font-size: .88rem; }
    .dot      { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #4caf50; margin-right: .4rem; }
  </style>
</head>
<body>
  <header>
    <h1>🌱 Crop Advisory API</h1>
    <p>Daily crop advisories for Watermelon — growth stage, disease risk &amp; nutrient recommendations.</p>
  </header>

  <section>
    <h2><span class="dot"></span>Service Status</h2>
    <table>
      <tr><th>Item</th><th>Value</th></tr>
      <tr><td>Server</td><td><strong style="color:#2d6a2d">Running</strong> on port ${PORT}</td></tr>
      <tr><td>Database</td><td>SQLite (node:sqlite)</td></tr>
      <tr><td>Crop</td><td>Watermelon — Tbase 12°C</td></tr>
    </table>
  </section>

  <section>
    <h2>Endpoints</h2>
    <table>
      <tr><th>Method</th><th>Path</th><th>Description</th></tr>
      <tr>
        <td><span class="badge get">GET</span></td>
        <td><a href="/health">/health</a></td>
        <td class="desc">Health check</td>
      </tr>
      <tr>
        <td><span class="badge get">GET</span></td>
        <td><a href="/api/fields/1/advisory">/api/fields/:fieldId/advisory</a></td>
        <td class="desc">Full daily advisory pulled from the database — crop stage, Fusarium Wilt risk &amp; nutrient recommendations</td>
      </tr>
      <tr>
        <td><span class="badge post">POST</span></td>
        <td><code style="font-size:.85rem">/api/advisory/calculate</code></td>
        <td class="desc">Stateless — run any custom scenario without touching the database. Pass weather, soil &amp; field data in the request body.</td>
      </tr>
    </table>
  </section>

  <section>
    <h2>Try Any Scenario</h2>
    <p style="font-size:.88rem;color:#555;margin-bottom:1rem;">Edit the numbers below and click Calculate — no database needed, results appear instantly.</p>
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
      <div style="flex:1;min-width:280px;">
        <label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.3rem">Field &amp; Soil</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.85rem;margin-bottom:.75rem;">
          <label>Area (ha)<br><input id="area" type="number" value="4.5" step="0.1" min="0.1" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"></label>
          <label>Season<br><select id="season" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"><option>Rabi</option><option>Kharif</option></select></label>
          <label>Nitrogen kg/ha<br><input id="n" type="number" value="120" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"></label>
          <label>Phosphorus kg/ha<br><input id="p" type="number" value="65" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"></label>
          <label>Potassium kg/ha<br><input id="k" type="number" value="190" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"></label>
          <label>Soil Moisture %<br><input id="sm" type="number" value="92" style="width:100%;padding:.35rem;border:1px solid #ccc;border-radius:4px"></label>
        </div>
        <label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.3rem">Weather (one row per day — Tmax, Tmin, RH%)</label>
        <div id="weatherRows" style="font-size:.83rem;"></div>
        <div style="margin-top:.5rem;display:flex;gap:.5rem;">
          <button onclick="addWeatherRow()" style="font-size:.8rem;padding:.3rem .7rem;border:1px solid #aaa;border-radius:4px;cursor:pointer;background:#f5f5f5">+ Add day</button>
          <button onclick="removeWeatherRow()" style="font-size:.8rem;padding:.3rem .7rem;border:1px solid #aaa;border-radius:4px;cursor:pointer;background:#f5f5f5">- Remove day</button>
        </div>
        <button onclick="calculate()" style="margin-top:1rem;background:#2d6a2d;color:#fff;border:none;padding:.5rem 1.2rem;border-radius:5px;cursor:pointer;font-size:.9rem">Calculate</button>
      </div>
      <div style="flex:1.4;min-width:280px;">
        <label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.3rem">Result</label>
        <pre id="result" style="background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:6px;font-size:.78rem;overflow:auto;min-height:120px;white-space:pre-wrap">Click Calculate to see output...</pre>
      </div>
    </div>
  </section>

  <section>
    <h2>Seeded Test Field</h2>
    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Name</td><td>Test Field Alpha</td></tr>
      <tr><td>Crop</td><td>Watermelon, Rabi season, 4.5 ha</td></tr>
      <tr><td>Advisory</td><td><a href="/api/fields/1/advisory">/api/fields/1/advisory</a></td></tr>
    </table>
  </section>

  <section>
    <h2>How It Works</h2>
    <table>
      <tr><th>Engine</th><th>Logic</th></tr>
      <tr>
        <td><strong>Crop Stage</strong></td>
        <td class="desc">GDD = max(((Tmax+Tmin)/2) − 12, 0) accumulated since planting; matched to 5 growth stages.</td>
      </tr>
      <tr>
        <td><strong>Disease Risk</strong></td>
        <td class="desc">Fusarium Wilt scored 0–100: avg temp 20–28°C (+40), RH ≥ 85% all 3 days (+30), soil moisture ≥ 90% (+30).</td>
      </tr>
      <tr>
        <td><strong>Nutrients</strong></td>
        <td class="desc">Soil N/P/K vs stage thresholds — deficient or adequate dose × field area (ha).</td>
      </tr>
    </table>
  </section>
<script>
  const defaultWeather = [
    { tmax: 30, tmin: 22, rh: 87 },
    { tmax: 29, tmin: 21, rh: 89 },
    { tmax: 28, tmin: 20, rh: 86 },
  ];

  function addWeatherRow(vals) {
    const v = vals || { tmax: '', tmin: '', rh: '' };
    const div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.4rem';
    div.innerHTML =
      '<input type="number" placeholder="Tmax°C" value="' + v.tmax + '" style="padding:.3rem;border:1px solid #ccc;border-radius:4px">' +
      '<input type="number" placeholder="Tmin°C" value="' + v.tmin + '" style="padding:.3rem;border:1px solid #ccc;border-radius:4px">' +
      '<input type="number" placeholder="RH%"    value="' + v.rh   + '" style="padding:.3rem;border:1px solid #ccc;border-radius:4px">';
    document.getElementById('weatherRows').appendChild(div);
  }

  function removeWeatherRow() {
    const rows = document.getElementById('weatherRows');
    if (rows.children.length > 1) rows.removeChild(rows.lastChild);
  }

  function getWeatherRows() {
    return Array.from(document.getElementById('weatherRows').children).map(row => {
      const inputs = row.querySelectorAll('input');
      return { tmax_c: parseFloat(inputs[0].value), tmin_c: parseFloat(inputs[1].value), humidity_pct: parseFloat(inputs[2].value) };
    });
  }

  async function calculate() {
    const btn = document.querySelector('button[onclick="calculate()"]');
    btn.textContent = 'Calculating...';
    btn.disabled = true;
    const body = {
      area_ha: parseFloat(document.getElementById('area').value),
      season:  document.getElementById('season').value,
      soil: {
        nitrogen_kg_ha:    parseFloat(document.getElementById('n').value),
        phosphorus_kg_ha:  parseFloat(document.getElementById('p').value),
        potassium_kg_ha:   parseFloat(document.getElementById('k').value),
        soil_moisture_pct: parseFloat(document.getElementById('sm').value),
      },
      weather: getWeatherRows(),
    };
    try {
      const res  = await fetch('/api/advisory/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      document.getElementById('result').textContent = 'Error: ' + e.message;
    }
    btn.textContent = 'Calculate';
    btn.disabled = false;
  }

  // seed the default weather rows on load
  defaultWeather.forEach(addWeatherRow);
</script>
</body>
</html>`);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', require('./routes'));

// catch anything that didn't match
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

app.listen(PORT, () => {
  console.log(`server up → http://localhost:${PORT}`);
  console.log(`advisory  → http://localhost:${PORT}/api/fields/1/advisory`);
});

module.exports = app;
