/**
 * Settings API Routes
 */
import express from 'express';
import { readData, writeData, SETTINGS_FILE } from './utils.js';

const router = express.Router();

/**
 * Mask API key for safe display (shows last 4 characters)
 */
const maskApiKey = (key) => {
    if (!key || key.length < 4) return key ? '****' : '';
    return '****' + key.slice(-4);
};

// API keys that should be masked in responses
const SENSITIVE_KEYS = ['apiKey', 'deepseekApiKey', 'openRouterApiKey', 'openaiApiKey'];

// Default settings configuration
const defaultSettings = {
    provider: 'gemini',
    apiKey: '',
    deepseekApiKey: '',
    openRouterApiKey: '',
    openaiApiKey: '',
    openaiEndpoint: '',
    openRouterModelProviders: '',
    model: 'gemini-2.5-flash',
    theme: 'blue',
    fontFamily: 'font-sans',
    fontSize: 1,
    fontColor: '',
    temperature: 0.5,
    sourceLanguage: 'Auto-detect',
    targetLanguage: 'English',
    systemInstruction: 'You are an expert translator specializing in webnovels. First, detect the language of the provided text, then translate it into fluent, natural {{targetLanguage}}. Your primary goal is to preserve the original tone and narrative style. When a glossary is provided, you MUST adhere to it strictly for the specified terms. You may also be provided with Character Information for context (including their original and translated names); use this to ensure consistent character details (like names and pronouns) in your translation.',
    isStreamingEnabled: true,
    isTranslationMemoryEnabled: true,
    isAutoCharacterDetectionEnabled: true,
    reasoningEffort: 'auto'
};

// Get settings (with masked API keys for security)
router.get('/', async (req, res) => {
    const settings = await readData(SETTINGS_FILE, defaultSettings);
    // Mask sensitive API keys in response
    const maskedSettings = { ...settings };
    SENSITIVE_KEYS.forEach(key => {
        if (maskedSettings[key]) {
            maskedSettings[key] = maskApiKey(maskedSettings[key]);
        }
    });
    res.json(maskedSettings);
});

// Save settings (accepts full API keys)
router.post('/', async (req, res) => {
    // For API keys, if masked value is sent (****xxxx), preserve the existing key
    const currentSettings = await readData(SETTINGS_FILE, defaultSettings);
    const newSettings = { ...req.body };

    SENSITIVE_KEYS.forEach(key => {
        if (newSettings[key] && newSettings[key].startsWith('****')) {
            // Masked key sent, preserve the original
            newSettings[key] = currentSettings[key] || '';
        }
    });

    await writeData(SETTINGS_FILE, newSettings);
    res.json(newSettings);
});

export default router;
