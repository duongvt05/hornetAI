"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = 'http://localhost:5000';

type User = {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'worker';
  avatar_url?: string;
}

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

type RegisterData = {
  username: string;
  password: string;
  full_name: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<User | null>(null);
  const [token, setToken]                 = useState<string | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Khôi phục session từ localStorage khi load trang
  useEffect(() => {
    const storedToken = localStorage.getItem('hornet-token');
    const storedUser  = localStorage.getItem('hornet-user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

    setToken(data.token);
    setUser(data.user);
    setIsAuthenticated(true);
    localStorage.setItem('hornet-token', data.token);
    localStorage.setItem('hornet-user', JSON.stringify(data.user));
    setIsLoading(false);
  };

  const register = async (registerData: RegisterData) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('hornet-token');
    localStorage.removeItem('hornet-user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};