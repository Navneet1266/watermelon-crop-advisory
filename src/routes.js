const express = require('express');
const router = express.Router();

const db = require('./db');
const { totalGDD, getStage } = require('./gdd');
const { fusariumRisk, weatherWindowDays } = require('./risk');
const { getRecommendations } = require('./nutrients');

// GET /api/fields/:fieldId/advisory
// pulls field data, runs all three engines, returns a single advisory payload
router.get('/fields/:fieldId/advisory', (req, res) => {
  const fieldId = parseInt(req.params.fieldId, 10);

  // reject anything that isn't a positive integer early — don't even touch the DB
  if (isNaN(fieldId) || fieldId < 1) {
    return res.status(400).json({ error: 'fieldId must be a positive integer.' });
  }

  try {
    // get field + its linked crop in one query
    const field = db.prepare(`
      SELECT f.*, c.name AS crop_name, c.base_temp_c
      FROM fields f
      JOIN crops c ON c.id = f.crop_id
      WHERE f.id = ?
    `).get(fieldId);

    if (!field) {
      return res.status(404).json({ error: `Field ${fieldId} not found.` });
    }

    // always use the most recent soil test — farmers send these in periodically
    const soil = db.prepare(`
      SELECT * FROM soil_reports
      WHERE field_id = ?
      ORDER BY report_date DESC
      LIMIT 1
    `).get(fieldId);

    if (!soil) {
      return res.status(404).json({ error: `No soil report found for field ${fieldId}.` });
    }

    // all weather after planting date — needed for full GDD history
    // note: strictly > planting_date because planting day itself has no GDD
    const weather = db.prepare(`
      SELECT * FROM weather_records
      WHERE field_id = ? AND record_date > ?
      ORDER BY record_date ASC
    `).all(fieldId, field.planting_date);

    if (weather.length === 0) {
      return res.status(404).json({ error: `No weather records found for field ${fieldId} after ${field.planting_date}.` });
    }

    // disease risk window size comes from the risk engine's config
    const last3 = weather.slice(-weatherWindowDays);

    // --- run the engines ---
    const gdd = totalGDD(weather, field.base_temp_c);
    const stage = getStage(gdd);
    const risk = fusariumRisk(last3, soil.soil_moisture_pct);
    const nutrients = getRecommendations(stage.stage_name, soil, field.area_ha, field.season);

    res.json({
      field: {
        id:            field.id,
        name:          field.name,
        crop:          field.crop_name,
        area_ha:       field.area_ha,
        planting_date: field.planting_date,
        season:        field.season,
      },
      as_of_date: last3[last3.length - 1].record_date,
      crop_stage: {
        stage_id:        stage.stage_id,
        stage_name:      stage.stage_name,
        accumulated_gdd: parseFloat(gdd.toFixed(2)),
        gdd_range:       { start: stage.gdd_start, end: stage.gdd_end },
        days_of_data:    weather.length,
      },
      disease_risk: {
        fusarium_wilt: {
          risk_score:           risk.score,
          risk_level:           risk.riskLevel,
          advisory:             risk.advisory,
          contributing_factors: risk.factors,
          weather_window_days:  last3.length,
        },
      },
      nutrient_recommendations: nutrients,
    });

  } catch (err) {
    console.error('[advisory]', err.message);
    res.status(500).json({ error: 'Something went wrong.', details: err.message });
  }
});

// POST /api/advisory/calculate
// stateless endpoint — runs all three engines on any scenario you pass in the body
// no database involved, useful for testing custom scenarios on the fly
router.post('/advisory/calculate', (req, res) => {
  const { area_ha, season = 'Rabi', soil, weather } = req.body;

  // basic input checks before we try to calculate anything
  if (!area_ha || isNaN(area_ha) || area_ha <= 0) {
    return res.status(400).json({ error: 'area_ha must be a positive number.' });
  }
  if (!soil || soil.nitrogen_kg_ha == null || soil.phosphorus_kg_ha == null || soil.potassium_kg_ha == null || soil.soil_moisture_pct == null) {
    return res.status(400).json({ error: 'soil must include nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha and soil_moisture_pct.' });
  }
  if (!Array.isArray(weather) || weather.length === 0) {
    return res.status(400).json({ error: 'weather must be a non-empty array of daily records.' });
  }
  for (const [i, day] of weather.entries()) {
    if (day.tmax_c == null || day.tmin_c == null || day.humidity_pct == null) {
      return res.status(400).json({ error: `weather[${i}] is missing tmax_c, tmin_c, or humidity_pct.` });
    }
  }

  try {
    const last3 = weather.slice(-weatherWindowDays);

    const gdd   = totalGDD(weather);
    const stage = getStage(gdd);
    const risk  = fusariumRisk(last3, soil.soil_moisture_pct);
    const nutrients = getRecommendations(stage.stage_name, soil, area_ha, season);

    res.json({
      scenario: { area_ha, season, days_of_weather: weather.length },
      crop_stage: {
        stage_id:        stage.stage_id,
        stage_name:      stage.stage_name,
        accumulated_gdd: parseFloat(gdd.toFixed(2)),
        gdd_range:       { start: stage.gdd_start, end: stage.gdd_end },
      },
      disease_risk: {
        fusarium_wilt: {
          risk_score:           risk.score,
          risk_level:           risk.riskLevel,
          advisory:             risk.advisory,
          contributing_factors: risk.factors,
          weather_window_days:  last3.length,
        },
      },
      nutrient_recommendations: nutrients,
    });

  } catch (err) {
    console.error('[calculate]', err.message);
    res.status(500).json({ error: 'Something went wrong.', details: err.message });
  }
});

module.exports = router;
