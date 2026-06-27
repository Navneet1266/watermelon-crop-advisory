// unit tests for the three advisory engines
// uses the exact test scenario from the assignment (Section 2)

const { dailyGDD, totalGDD, getStage } = require('../src/gdd');
const { fusariumRisk }                 = require('../src/risk');
const { getRecommendations }           = require('../src/nutrients');

// --- shared test data ---

const weather3Days = [
  { tmax_c: 30, tmin_c: 22, humidity_pct: 87 },
  { tmax_c: 29, tmin_c: 21, humidity_pct: 89 },
  { tmax_c: 28, tmin_c: 20, humidity_pct: 86 },
];

const soilReport = {
  nitrogen_kg_ha:    120.0,
  phosphorus_kg_ha:   65.0,
  potassium_kg_ha:   190.0,
  soil_moisture_pct:  92.0,
};

const FIELD_HA = 4.5;

// ─── GDD engine ───────────────────────────────────────────────────────────────

describe('GDD engine (gdd.js)', () => {

  test('day 1: (30+22)/2 - 12 = 14', () => {
    expect(dailyGDD(30, 22)).toBe(14);
  });

  test('day 2: (29+21)/2 - 12 = 13', () => {
    expect(dailyGDD(29, 21)).toBe(13);
  });

  test('day 3: (28+20)/2 - 12 = 12', () => {
    expect(dailyGDD(28, 20)).toBe(12);
  });

  test('GDD is 0 when avg temp is below base temp', () => {
    expect(dailyGDD(10, 8)).toBe(0); // avg = 9, below 12
  });

  test('total GDD over 3 days = 39', () => {
    const records = weather3Days.map(d => ({ tmax_c: d.tmax_c, tmin_c: d.tmin_c }));
    expect(totalGDD(records)).toBe(39);
  });

  test('GDD 39 → Germination & Emergence (stage 1)', () => {
    const s = getStage(39);
    expect(s.stage_id).toBe(1);
    expect(s.stage_name).toBe('Germination & Emergence');
  });

  test('GDD 250 → Vegetative & Vining', () => {
    expect(getStage(250).stage_name).toBe('Vegetative & Vining');
  });

  test('GDD 550 → Flowering & Fruit Set', () => {
    expect(getStage(550).stage_name).toBe('Flowering & Fruit Set');
  });

  test('GDD 850 → Fruit Development & Sizing', () => {
    expect(getStage(850).stage_name).toBe('Fruit Development & Sizing');
  });

  test('GDD 1200 → Ripening & Harvest', () => {
    expect(getStage(1200).stage_name).toBe('Ripening & Harvest');
  });
});

// ─── Risk engine ──────────────────────────────────────────────────────────────

describe('Fusarium Wilt risk engine (risk.js)', () => {

  test('full test case: all 3 rules fire → score 100, HIGH', () => {
    const r = fusariumRisk(weather3Days, 92);
    expect(r.score).toBe(100);
    expect(r.riskLevel).toBe('HIGH');
    expect(r.advisory).toBe('Immediate chemical drenching required.');
  });

  test('only temp rule fires → score 40, MODERATE', () => {
    const w = [
      { tmax_c: 30, tmin_c: 22, humidity_pct: 70 },
      { tmax_c: 29, tmin_c: 21, humidity_pct: 70 },
      { tmax_c: 28, tmin_c: 20, humidity_pct: 70 },
    ];
    const r = fusariumRisk(w, 0);
    expect(r.score).toBe(40);
    expect(r.riskLevel).toBe('MODERATE');
  });

  test('only humidity rule fires → score 30, LOW', () => {
    // temp outside 20-28, soil moisture fine
    const w = [
      { tmax_c: 35, tmin_c: 30, humidity_pct: 88 },
      { tmax_c: 35, tmin_c: 30, humidity_pct: 90 },
      { tmax_c: 35, tmin_c: 30, humidity_pct: 86 },
    ];
    expect(fusariumRisk(w, 50).score).toBe(30);
  });

  test('only moisture rule fires → score 30, LOW', () => {
    const w = [
      { tmax_c: 35, tmin_c: 30, humidity_pct: 70 },
      { tmax_c: 35, tmin_c: 30, humidity_pct: 70 },
      { tmax_c: 35, tmin_c: 30, humidity_pct: 70 },
    ];
    expect(fusariumRisk(w, 92).score).toBe(30);
  });

  test('humidity rule needs ALL days >= 85% — one below breaks it', () => {
    const w = [
      { tmax_c: 35, tmin_c: 30, humidity_pct: 90 },
      { tmax_c: 35, tmin_c: 30, humidity_pct: 84 }, // this one fails
      { tmax_c: 35, tmin_c: 30, humidity_pct: 90 },
    ];
    expect(fusariumRisk(w, 0).score).toBe(0);
  });

  test('score 70 is HIGH (boundary)', () => {
    const w = [
      { tmax_c: 30, tmin_c: 22, humidity_pct: 88 },
      { tmax_c: 29, tmin_c: 21, humidity_pct: 87 },
      { tmax_c: 28, tmin_c: 20, humidity_pct: 86 },
    ];
    const r = fusariumRisk(w, 0); // temp + humidity = 70
    expect(r.score).toBe(70);
    expect(r.riskLevel).toBe('HIGH');
  });

  test('score 40 is MODERATE (boundary)', () => {
    const w = [
      { tmax_c: 30, tmin_c: 22, humidity_pct: 70 },
      { tmax_c: 29, tmin_c: 21, humidity_pct: 70 },
      { tmax_c: 28, tmin_c: 20, humidity_pct: 70 },
    ];
    expect(fusariumRisk(w, 0).riskLevel).toBe('MODERATE');
  });

  test('score 0 → LOW, no action', () => {
    const w = [
      { tmax_c: 15, tmin_c: 10, humidity_pct: 60 },
      { tmax_c: 15, tmin_c: 10, humidity_pct: 60 },
      { tmax_c: 15, tmin_c: 10, humidity_pct: 60 },
    ];
    const r = fusariumRisk(w, 0);
    expect(r.riskLevel).toBe('LOW');
    expect(r.advisory).toBe('No action required.');
  });
});

// ─── Nutrient engine ──────────────────────────────────────────────────────────

describe('Nutrient recommendation engine (nutrients.js)', () => {
  const recs = getRecommendations('Germination & Emergence', soilReport, FIELD_HA, 'Rabi');

  test('returns 3 nutrients for Rabi / Germination stage', () => {
    expect(recs).toHaveLength(3);
  });

  test('Nitrogen: 120 < threshold 150 → DEFICIENT → 110 × 4.5 = 495 kg', () => {
    const n = recs.find(r => r.nutrient === 'Nitrogen');
    expect(n.soil_status).toBe('DEFICIENT');
    expect(n.dose_per_ha_kg).toBe(110);
    expect(n.total_dose_kg).toBe(495);
    expect(n.fertilizer).toBe('Urea');
  });

  test('Phosphorus: 65 > threshold 50 → ADEQUATE → 50 × 4.5 = 225 kg', () => {
    const p = recs.find(r => r.nutrient === 'Phosphorus');
    expect(p.soil_status).toBe('ADEQUATE');
    expect(p.dose_per_ha_kg).toBe(50);
    expect(p.total_dose_kg).toBe(225);
  });

  test('Potash: 190 > threshold 180 → ADEQUATE → 30 × 4.5 = 135 kg', () => {
    const k = recs.find(r => r.nutrient === 'Potash');
    expect(k.soil_status).toBe('ADEQUATE');
    expect(k.dose_per_ha_kg).toBe(30);
    expect(k.total_dose_kg).toBe(135);
  });

  test('unknown stage returns empty array', () => {
    expect(getRecommendations('Ripening & Harvest', soilReport, FIELD_HA, 'Rabi')).toHaveLength(0);
  });
});
