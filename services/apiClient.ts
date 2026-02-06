/**
 * API Client with Authentication
 * Centralized fetch wrapper that automatically includes auth headers
 */

// Determine API URL based on environment
const getApiUrl = () => {
    // In production, use relative URL (same origin)
    // In development, use localhost:3001
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return '/api';
    }
    return 'http://localhost:3001/api';
};

export const API_URL = getApiUrl();

// Auth token storage key
const TOKEN_KEY = 'lingua_scripter_auth_token';

/**
 * Get stored auth token
 */
export const getAuthToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
};

/**
 * Store auth token
 */
export const setAuthToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Clear auth token
 */
export const clearAuthToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
    return !!getAuthToken();
};

/**
 * Handle 401 responses - redirect to login
 */
const handleUnauthorized = () => {
    clearAuthToken();
    // Dispatch a custom event so components can react
    window.dispatchEvent(new CustomEvent('auth:logout'));
};

/**
 * Authenticated fetch wrapper
 * Automatically adds Authorization header and handles 401 responses
 */
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getAuthToken();

    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        handleUnauthorized();
    }

    return response;
};

/**
 * Login function
 */
export const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Login failed' };
        }

        setAuthToken(data.token);
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Connection failed' };
    }
};

/**
 * Logout function
 */
export const logout = (): void => {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
};

/**
 * Verify current token
 */
export const verifyToken = async (): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) return false;

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        return data.valid === true;
    } catch {
        return false;
    }
};

/**
 * Change password
 */
export const changePassword = async (
    currentPassword: string,
    newPassword: string,
    newUsername?: string
): Promise<{ success: boolean; error?: string; username?: string }> => {
    try {
        const response = await authFetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, newUsername })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to change password' };
        }

        return { success: true, username: data.username };
    } catch (error) {
        return { success: false, error: 'Connection failed' };
    }
};

/**
 * Get current auth info (username)
 */
export const getAuthInfo = async (): Promise<{ username: string } | null> => {
    try {
        const response = await authFetch(`${API_URL}/auth/info`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
};
