// fertilizer recommendations based on current crop stage + soil test results
// logic: compare each nutrient in the soil to a threshold for this stage
//        if soil is below threshold → use the higher corrective dose
//        if soil is fine → use the lower maintenance dose
//        final amount is always scaled to the actual field size in hectares

const nutrientConfig = require('../config/watermelon_nutrients.json');

// bridges the JSON nutrient names to the actual DB column names
const dbColumn = {
  Nitrogen:   'nitrogen_kg_ha',
  Phosphorus: 'phosphorus_kg_ha',
  Potash:     'potassium_kg_ha',
};

function getRecommendations(stageName, soilReport, areaHa, season = 'Rabi') {
  const entries = nutrientConfig.filter(n =>
    n.crop === 'Watermelon' &&
    n.stage === stageName &&
    n.Season_of_Planting === season
  );

  return entries.map(n => {
    const soilValue = soilReport[dbColumn[n.nutrient]] ?? 0;
    const deficient = soilValue < n.Soil_availability_NPK_threshold;
    const dosePerHa = deficient ? n.dose_under_threshold_kg_ha : n.dose_above_threshold_kg_ha;

    return {
      nutrient:         n.nutrient,
      fertilizer:       n.fertilizer,
      soil_value_kg_ha: soilValue,
      threshold_kg_ha:  n.Soil_availability_NPK_threshold,
      soil_status:      deficient ? 'DEFICIENT' : 'ADEQUATE',
      dose_per_ha_kg:   dosePerHa,
      total_dose_kg:    parseFloat((dosePerHa * areaHa).toFixed(2)),
      field_area_ha:    areaHa,
    };
  });
}

module.exports = { getRecommendations };
