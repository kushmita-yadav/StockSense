import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string, inviteCode?: string) => Promise<{ message: string; otp_debug?: string }>;
  verifySignup: (email: string, otp_code: string) => Promise<User>;
  logout: () => Promise<void>;
  requestOTP: (email: string) => Promise<{ message: string; otp_debug?: string }>;
  resetPassword: (email: string, otp_code: string, new_password: string) => Promise<void>;
  isManager: boolean;
  isStaff: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch (err) {
      setUser(null);
      localStorage.removeItem('stocksense_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await api.post('/auth/login', { email, password });
    if (data.access_token) {
      localStorage.setItem('stocksense_token', data.access_token);
    }
    setUser(data.user);
    return data.user;
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    inviteCode?: string
  ): Promise<{ message: string; otp_debug?: string }> => {
    return await api.post('/auth/signup', { name, email, password, invite_code: inviteCode || undefined });
  };

  const verifySignup = async (email: string, otp_code: string): Promise<User> => {
    const data = await api.post('/auth/verify-signup', { email, otp_code });
    if (data.access_token) localStorage.setItem('stocksense_token', data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('stocksense_token');
      setUser(null);
    }
  };

  const requestOTP = async (email: string) => {
    return await api.post<{ message: string; otp_debug?: string }>('/auth/request-otp', { email });
  };

  const resetPassword = async (email: string, otp_code: string, new_password: string) => {
    await api.post('/auth/reset-password', { email, otp_code, new_password });
  };

  const isManager = user?.role === 'INVENTORY_MANAGER';
  const isStaff = user?.role === 'WAREHOUSE_STAFF';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        verifySignup,
        logout,
        requestOTP,
        resetPassword,
        isManager,
        isStaff,
        isAuthenticated,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
