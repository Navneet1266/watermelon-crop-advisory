-- crop advisory system schema
-- SQLite, kept simple on purpose — this is a prototype

CREATE TABLE IF NOT EXISTS crops (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    base_temp_c REAL NOT NULL DEFAULT 12.0, -- base temp used in GDD formula
    description TEXT
);

CREATE TABLE IF NOT EXISTS fields (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_id          INTEGER NOT NULL,
    name             TEXT NOT NULL,
    area_ha          REAL NOT NULL CHECK(area_ha > 0),
    row_spacing_cm   REAL,
    plant_spacing_cm REAL,
    planting_date    TEXT NOT NULL,  -- YYYY-MM-DD, treated as Day 0 (no GDD on this day)
    season           TEXT NOT NULL DEFAULT 'Rabi',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (crop_id) REFERENCES crops(id)
);

-- one soil test report per field per date
CREATE TABLE IF NOT EXISTS soil_reports (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id          INTEGER NOT NULL,
    report_date       TEXT NOT NULL,
    nitrogen_kg_ha    REAL,
    phosphorus_kg_ha  REAL,
    potassium_kg_ha   REAL,
    soil_moisture_pct REAL,  -- percentage of field capacity (0-100)
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (field_id) REFERENCES fields(id),
    UNIQUE(field_id, report_date)
);

-- daily weather per field — can be historical or a forecast
CREATE TABLE IF NOT EXISTS weather_records (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id     INTEGER NOT NULL,
    record_date  TEXT NOT NULL,
    tmax_c       REAL NOT NULL,
    tmin_c       REAL NOT NULL,
    humidity_pct REAL,
    rainfall_mm  REAL DEFAULT 0,
    et0_mm       REAL,
    record_type  TEXT NOT NULL DEFAULT 'historical' CHECK(record_type IN ('historical', 'forecast')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (field_id) REFERENCES fields(id),
    UNIQUE(field_id, record_date)
);
