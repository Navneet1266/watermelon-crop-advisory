// GDD = Growing Degree Days
// tracks heat accumulation since planting to determine which growth stage the crop is in
// reference: watermelon base temp is 12°C (below this, plant growth essentially stops)

const stages = require('../config/watermelon_stages.json');

function dailyGDD(tmax, tmin, tbase = 12) {
  const avg = (tmax + tmin) / 2;
  return avg > tbase ? avg - tbase : 0; // never goes negative
}

function totalGDD(weatherRecords, tbase = 12) {
  let sum = 0;
  for (const day of weatherRecords) {
    sum += dailyGDD(day.tmax_c, day.tmin_c, tbase);
  }
  return sum;
}

// matches accumulated GDD to one of the 5 watermelon growth stages
function getStage(gdd) {
  const match = stages.find(s => gdd >= s.gdd_start && gdd <= s.gdd_end);
  // if gdd somehow exceeds all ranges (shouldn't happen), default to last stage
  return match || stages[stages.length - 1];
}

module.exports = { dailyGDD, totalGDD, getStage };
