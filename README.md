# Watermelon Crop Advisory API

Backend service that takes a field's planting date, soil test results, and recent weather data, then returns a single JSON advisory covering three things: where the crop is in its growth cycle, whether Fusarium Wilt is a risk right now, and how much fertilizer to apply.

Built on Node.js and Express with a local SQLite database. No external services, no native addons — just `npm install` and it runs.

---

## Setup

You'll need Node 22.5 or above. The project uses the sqlite module that ships built into Node 22, so there's nothing extra to compile.

```bash
npm install

# put the test field and 3 days of weather into the database
npm run seed

# start the server (default port 3000)
npm start
```

Open `http://localhost:3000` in a browser — it shows all available endpoints and has a live form for testing any scenario without writing curl commands.

If you want to change the port or the database path, copy `.env.example` to `.env` and edit it. The defaults work fine for local development.

---

## Endpoints

### GET /api/fields/:fieldId/advisory

The main one. Give it a field ID and it pulls the field's data from the database, runs all three calculation engines, and returns a single advisory JSON.

```
GET http://localhost:3000/api/fields/1/advisory
```

Sample response (seeded test field, 3 days after planting):

```json
{
  "field": {
    "id": 1,
    "name": "Test Field Alpha",
    "crop": "Watermelon",
    "area_ha": 4.5,
    "planting_date": "2026-06-21",
    "season": "Rabi"
  },
  "as_of_date": "2026-06-24",
  "crop_stage": {
    "stage_id": 1,
    "stage_name": "Germination & Emergence",
    "accumulated_gdd": 39,
    "gdd_range": { "start": 0, "end": 100 },
    "days_of_data": 3
  },
  "disease_risk": {
    "fusarium_wilt": {
      "risk_score": 100,
      "risk_level": "HIGH",
      "advisory": "Immediate chemical drenching required.",
      "contributing_factors": [
        "3-day avg temp 25.0°C is within 20–28°C risk range (+40 pts)",
        "Relative humidity >= 85% on all 3 days (+30 pts)",
        "Soil moisture at 92% of capacity (>= 90% threshold) (+30 pts)"
      ],
      "weather_window_days": 3
    }
  },
  "nutrient_recommendations": [
    {
      "nutrient": "Nitrogen",
      "fertilizer": "Urea",
      "soil_value_kg_ha": 120,
      "threshold_kg_ha": 150,
      "soil_status": "DEFICIENT",
      "dose_per_ha_kg": 110,
      "total_dose_kg": 495,
      "field_area_ha": 4.5
    },
    {
      "nutrient": "Phosphorus",
      "fertilizer": "Single Super Phosphate",
      "soil_value_kg_ha": 65,
      "threshold_kg_ha": 50,
      "soil_status": "ADEQUATE",
      "dose_per_ha_kg": 50,
      "total_dose_kg": 225,
      "field_area_ha": 4.5
    },
    {
      "nutrient": "Potash",
      "fertilizer": "Muriate of Potash",
      "soil_value_kg_ha": 190,
      "threshold_kg_ha": 180,
      "soil_status": "ADEQUATE",
      "dose_per_ha_kg": 30,
      "total_dose_kg": 135,
      "field_area_ha": 4.5
    }
  ]
}
```

Bad field ID returns 400. Field not found returns 404. Missing soil data or weather records also return 404 with a message explaining what's missing.

---

### POST /api/advisory/calculate

Stateless version of the same calculation — no database involved. You send the scenario in the request body and get the advisory back immediately. Useful for testing different input values without having to seed the database.

```
POST http://localhost:3000/api/advisory/calculate
Content-Type: application/json
```

Request body:

```json
{
  "area_ha": 4.5,
  "season": "Rabi",
  "soil": {
    "nitrogen_kg_ha": 120,
    "phosphorus_kg_ha": 65,
    "potassium_kg_ha": 190,
    "soil_moisture_pct": 92
  },
  "weather": [
    { "tmax_c": 30, "tmin_c": 22, "humidity_pct": 87 },
    { "tmax_c": 29, "tmin_c": 21, "humidity_pct": 89 },
    { "tmax_c": 28, "tmin_c": 20, "humidity_pct": 86 }
  ]
}
```

The landing page at `http://localhost:3000` has a form pre-filled with these values — you can change any number and hit Calculate to see the result instantly.

---

### GET /health

Returns `{"status":"ok"}`. Standard health check.

---

## How the calculations work

### Crop stage

Plants don't grow by calendar days — they grow by accumulated heat. Below 12°C, watermelon growth effectively stops, so we only count degrees above that threshold each day:

```
GDD = max( ((Tmax + Tmin) / 2) - 12, 0 )
```

These add up from the day after planting. Once you have the total, it's matched against five stage ranges defined in `config/watermelon_stages.json` (Germination → Vegetative → Flowering → Fruit Development → Ripening).

For the test case: 14 + 13 + 12 = **39 GDD → Germination & Emergence**.

### Fusarium Wilt risk

Fusarium Wilt spreads when temperature, humidity, and soil moisture are all high at the same time. The engine looks at the last 3 days of weather and scores three conditions independently:

- Average temperature between 20–28°C → +40 points  
- Humidity at or above 85% on all 3 days (not just one or two) → +30 points  
- Soil moisture at or above 90% of field capacity → +30 points  

Score 70 and above = HIGH, 40–69 = MODERATE, below 40 = LOW. All thresholds, point values, and the advisory messages are stored in `config/risk_rules.json` so they can be adjusted without changing code.

### Nutrient recommendations

For each nutrient (Nitrogen, Phosphorus, Potash), the engine compares the soil report value to the recommended threshold for the current growth stage. If the soil is below the threshold it's deficient — gets a corrective dose. At or above — gets a smaller maintenance dose. Either way, the per-hectare dose is multiplied by the field area to give the total quantity to apply.

Stage thresholds and dose values come from `config/watermelon_nutrients.json`.

---

## Database

Four tables — `crops`, `fields`, `soil_reports`, `weather_records`. Full definitions are in `schema.sql`. The tables are created automatically on startup (`CREATE TABLE IF NOT EXISTS`) so there's no separate migration to run.

The SQLite file is stored in `data/advisory.db`. That folder gets created automatically if it doesn't exist. It's in `.gitignore` since it's runtime data, not source.

---

## Project structure

```
crop-advisory-api/
├── config/
│   ├── watermelon_stages.json      GDD ranges for each of the 5 growth stages
│   ├── watermelon_nutrients.json   NPK thresholds and fertilizer doses per stage
│   └── risk_rules.json             disease scoring rules, point values, risk bands
├── src/
│   ├── server.js       express app, landing page, health check
│   ├── routes.js       the two API endpoints
│   ├── db.js           sqlite connection — runs schema on every startup
│   ├── gdd.js          heat unit accumulation and stage lookup
│   ├── risk.js         fusarium wilt scoring
│   └── nutrients.js    fertilizer dose calculation
├── tests/
│   └── advisory.test.js
├── seed.js             inserts the assignment test scenario into the database
└── schema.sql          table definitions
```

---

## Tests

```bash
npm test
```

23 unit tests across the three engines. The test scenario uses the exact numbers from the assignment so you can verify the math by hand:

```
Day 1:  (30+22)/2 − 12 = 14 GDD
Day 2:  (29+21)/2 − 12 = 13 GDD
Day 3:  (28+20)/2 − 12 = 12 GDD
Total:  39 → Germination & Emergence

Risk:   avg 25°C in window (+40) + RH ≥ 85% all 3 days (+30) + soil 92% (+30) = 100 → HIGH

N:   120 < 150 threshold → DEFICIENT → 110 kg/ha × 4.5 ha = 495 kg Urea
P:    65 > 50 threshold  → ADEQUATE  →  50 kg/ha × 4.5 ha = 225 kg Single Super Phosphate
K:   190 > 180 threshold → ADEQUATE  →  30 kg/ha × 4.5 ha = 135 kg Muriate of Potash
```
