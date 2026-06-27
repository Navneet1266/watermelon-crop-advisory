// Fusarium Wilt risk scoring
// reads all thresholds, point values and advisory messages from risk_rules.json
// so business rules can be updated without touching this file

const config = require('../config/risk_rules.json');

function fusariumRisk(weatherWindow, soilMoisture) {
  let score = 0;
  const reasons = [];

  for (const rule of config.rules) {

    if (rule.id === 'temp_range') {
      // average across the whole window, not just today
      const avgTemp = weatherWindow.reduce((sum, d) => sum + (d.tmax_c + d.tmin_c) / 2, 0) / weatherWindow.length;
      if (avgTemp >= rule.condition.min && avgTemp <= rule.condition.max) {
        score += rule.points;
        reasons.push(`3-day avg temp ${avgTemp.toFixed(1)}°C is within ${rule.condition.min}–${rule.condition.max}°C risk range (+${rule.points} pts)`);
      }
    }

    if (rule.id === 'consecutive_humidity') {
      // has to be above threshold on ALL days — one dry day breaks the chain
      if (weatherWindow.every(d => d.humidity_pct >= rule.condition.threshold)) {
        score += rule.points;
        reasons.push(`Relative humidity >= ${rule.condition.threshold}% on all ${weatherWindow.length} days (+${rule.points} pts)`);
      }
    }

    if (rule.id === 'soil_moisture') {
      if (soilMoisture >= rule.condition.threshold) {
        score += rule.points;
        reasons.push(`Soil moisture at ${soilMoisture}% of capacity (>= ${rule.condition.threshold}% threshold) (+${rule.points} pts)`);
      }
    }
  }

  // find the matching risk level band — fallback to LOW if score somehow doesn't fit any range
  const band = config.risk_levels.find(l => score >= l.min_score && score <= l.max_score)
    || config.risk_levels[config.risk_levels.length - 1];

  return {
    score,
    riskLevel: band.level,
    advisory:  band.advisory,
    factors:   reasons,
  };
}

// expose the window size so callers don't need to import risk_rules.json themselves
const weatherWindowDays = config.weather_window_days;

module.exports = { fusariumRisk, weatherWindowDays };
