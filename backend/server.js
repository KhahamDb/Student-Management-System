require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

// --- Auto-run schema.sql on startup ---
// Safe to run every time: schema.sql uses CREATE EXTENSION IF NOT EXISTS
// and CREATE TABLE IF NOT EXISTS, so it won't touch existing data.
async function initSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('Database schema verified/created (students table ready).');
}

// --- Middleware ---
app.use(express.json());

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// --- Validation helpers ---
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistrationInput({ name, email, password, course }) {
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        errors.push('Name must be at least 2 characters.');
    }
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        errors.push('A valid email is required.');
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        errors.push('Password must be at least 8 characters.');
    }
    if (!course || typeof course !== 'string' || course.trim().length < 2) {
        errors.push('Course/Major is required.');
    }

    return errors;
}

// --- Routes ---

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Register a new student
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, course } = req.body || {};

        const errors = validateRegistrationInput({ name, email, password, course });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check for existing email up front for a clean error message
        // (the DB unique constraint is still the real safety net against races)
        const existing = await pool.query(
            'SELECT id FROM students WHERE email = $1',
            [normalizedEmail]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                errors: ['An account with this email already exists.'],
            });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const insertResult = await pool.query(
            `INSERT INTO students (name, email, password_hash, course)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, course, created_at`,
            [name.trim(), normalizedEmail, passwordHash, course.trim()]
        );

        const student = insertResult.rows[0];

        return res.status(201).json({
            success: true,
            message: 'Student registered successfully.',
            student, // note: password_hash is never returned
        });

    } catch (err) {
        // Unique violation race-condition fallback
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                errors: ['An account with this email already exists.'],
            });
        }

        console.error('Error in POST /api/register:', err);
        return res.status(500).json({
            success: false,
            errors: ['Internal server error. Please try again later.'],
        });
    }
});

// List all students (used by the dashboard)
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, course, created_at
             FROM students
             ORDER BY created_at DESC`
        );
        res.json({ success: true, students: result.rows });
    } catch (err) {
        console.error('Error in GET /api/students:', err);
        res.status(500).json({ success: false, errors: ['Internal server error.'] });
    }
});

// Delete a student
app.delete('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, errors: ['Student not found.'] });
        }
        res.json({ success: true, message: 'Student deleted.' });
    } catch (err) {
        console.error('Error in DELETE /api/students/:id:', err);
        res.status(500).json({ success: false, errors: ['Internal server error.'] });
    }
});

async function start() {
    try {
        await initSchema();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database schema. Server not started.', err);
        process.exit(1);
    }
}

start();
