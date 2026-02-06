import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isAuthenticated, verifyToken, logout as apiLogout, login as apiLogin } from '../services/apiClient';

interface AuthContextType {
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            if (isAuthenticated()) {
                const valid = await verifyToken();
                setIsLoggedIn(valid);
            } else {
                setIsLoggedIn(false);
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    // Listen for logout events
    useEffect(() => {
        const handleLogout = () => setIsLoggedIn(false);
        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const result = await apiLogin(username, password);
        if (result.success) {
            setIsLoggedIn(true);
        }
        return result;
    }, []);

    const logout = useCallback(() => {
        apiLogout();
        setIsLoggedIn(false);
    }, []);

    return (
        <AuthContext.Provider value={{ isLoggedIn, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
