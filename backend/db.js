const { Pool } = require('pg');
require('dotenv').config();

// node-postgres picks up PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// automatically from the environment, but we pass them explicitly here
// so the source of truth is obvious and .env is clearly required.
const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    max: 10,                     // max clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    // Handles errors on idle clients in the pool (e.g. DB connection drop)
    console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
