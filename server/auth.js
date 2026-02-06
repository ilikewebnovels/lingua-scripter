/**
 * Authentication Routes & Middleware
 * Simple single-user JWT authentication with file-based credential storage
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to credentials file (stored in data folder for persistence)
const AUTH_FILE = path.join(__dirname, '../data/auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'lingua-scripter-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

// Default credentials (used if no auth file exists)
const DEFAULT_USERNAME = process.env.AUTH_USERNAME || 'admin';
const DEFAULT_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || bcrypt.hashSync('admin', 10);

/**
 * Read credentials from file, fallback to defaults/env vars
 */
async function getCredentials() {
    try {
        const data = await fs.readFile(AUTH_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist, return defaults
        return {
            username: DEFAULT_USERNAME,
            passwordHash: DEFAULT_PASSWORD_HASH
        };
    }
}

/**
 * Save credentials to file
 */
async function saveCredentials(username, passwordHash) {
    const dataDir = path.dirname(AUTH_FILE);
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (e) { /* dir may already exist */ }

    await fs.writeFile(AUTH_FILE, JSON.stringify({
        username,
        passwordHash,
        updatedAt: Date.now()
    }, null, 2));
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const credentials = await getCredentials();

    // Validate credentials
    if (username !== credentials.username) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, credentials.passwordHash);
    if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
        { username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
        success: true,
        token,
        expiresIn: JWT_EXPIRES_IN
    });
});

/**
 * POST /api/auth/verify
 * Verify if current token is valid
 */
router.post('/verify', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ valid: false });
    }

    const token = authHeader.substring(7);

    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ valid: true });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

/**
 * POST /api/auth/change-password
 * Change password (requires current password verification)
 */
router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword, newUsername } = req.body;

    // Verify auth token first
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    try {
        jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const credentials = await getCredentials();

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, credentials.passwordHash);
    if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and save
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const username = newUsername?.trim() || credentials.username;

    try {
        await saveCredentials(username, newPasswordHash);
        res.json({
            success: true,
            message: 'Password changed successfully',
            username
        });
    } catch (error) {
        console.error('Failed to save credentials:', error);
        res.status(500).json({ error: 'Failed to save new password' });
    }
});

/**
 * GET /api/auth/info
 * Get current username (for display in UI)
 */
router.get('/info', async (req, res) => {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        jwt.verify(authHeader.substring(7), JWT_SECRET);
        const credentials = await getCredentials();
        res.json({ username: credentials.username });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

/**
 * Auth middleware - protects routes that require authentication
 * Apply this to all routes that need protection
 */
export const authMiddleware = (req, res, next) => {
    // Skip auth for auth endpoints (they handle their own auth)
    if (req.path.startsWith('/auth/')) {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export default router;
