const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/advisory.db');

// make sure the data folder exists before SQLite tries to open the file
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// WAL is faster for read-heavy workloads
db.exec('PRAGMA journal_mode = WAL');
// SQLite doesn't enforce foreign keys by default, have to turn it on per-connection
db.exec('PRAGMA foreign_keys = ON');

// run the schema on connect — CREATE IF NOT EXISTS means it's safe to repeat on every startup
const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
