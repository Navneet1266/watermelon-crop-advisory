// seeds the test scenario from the assignment spec
// run with: npm run seed
//
// date setup:
//   planting day = today - 3  (Day 0, GDD not counted here)
//   Day 1 = today - 2
//   Day 2 = today - 1
//   Day 3 = today

require('dotenv').config();

const db = require('./src/db');

function fmt(d) {
  return d.toISOString().split('T')[0];
}

const today   = new Date();
const planted = new Date(today); planted.setDate(today.getDate() - 3);
const day1    = new Date(today); day1.setDate(today.getDate() - 2);
const day2    = new Date(today); day2.setDate(today.getDate() - 1);

// insert crop — 12°C base temp is standard for watermelon
db.prepare(`INSERT OR IGNORE INTO crops (name, base_temp_c) VALUES (?, ?)`)
  .run('Watermelon', 12.0);

const crop = db.prepare(`SELECT id FROM crops WHERE name = 'Watermelon'`).get();

// 4.5 ha field, Rabi season, planted 3 days ago
db.prepare(`
  INSERT OR IGNORE INTO fields
    (crop_id, name, area_ha, row_spacing_cm, plant_spacing_cm, planting_date, season)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(crop.id, 'Test Field Alpha', 4.5, 180, 60, fmt(planted), 'Rabi');

const field = db.prepare(`SELECT id FROM fields WHERE name = 'Test Field Alpha'`).get();

// soil test — N is low (120 vs threshold 150), P and K are fine
db.prepare(`
  INSERT OR REPLACE INTO soil_reports
    (field_id, report_date, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, soil_moisture_pct)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(field.id, fmt(today), 120.0, 65.0, 190.0, 92.0);

// 3 days of weather — humidity stays above 85% all three days (triggers disease rule)
const days = [
  { date: fmt(day1),  tmax: 30, tmin: 22, rh: 87, rain: 12, et0: 4.0 },
  { date: fmt(day2),  tmax: 29, tmin: 21, rh: 89, rain: 15, et0: 3.5 },
  { date: fmt(today), tmax: 28, tmin: 20, rh: 86, rain:  8, et0: 3.2 },
];

const stmt = db.prepare(`
  INSERT OR REPLACE INTO weather_records
    (field_id, record_date, tmax_c, tmin_c, humidity_pct, rainfall_mm, et0_mm)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const d of days) {
  stmt.run(field.id, d.date, d.tmax, d.tmin, d.rh, d.rain, d.et0);
}

console.log('\nSeeded OK');
console.log(`  field id : ${field.id}`);
console.log(`  planted  : ${fmt(planted)}`);
console.log(`  day 1    : ${fmt(day1)}`);
console.log(`  day 2    : ${fmt(day2)}`);
console.log(`  today    : ${fmt(today)}`);
console.log(`\n  try: GET http://localhost:3000/api/fields/${field.id}/advisory\n`);
