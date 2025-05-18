'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import Cookies from 'js-cookie';
import axios from 'axios';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  avatar: string | null;
  phone: string | null;
} | null;

interface LoginResponse {
  accessToken: string;
  user: User;
  requiresTwoFactor?: boolean;
}

export const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, twoFactorToken?: string) => Promise<LoginResponse>;
  logout: () => void;
}>({
  user: null,
  loading: true,
  login: async () => ({ accessToken: '', user: {} as User }),
  logout: () => {},
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true); // Ensure loading is true at the start
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        credentials: 'include', // Sends HttpOnly cookies
      });

      console.log('Auth check response:', response);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        const token = localStorage.getItem('access_token_w');
        const response = await fetch(`${API_URL}/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // If token is invalid or not sent, backend returns non-ok status
          setUser(null); // Clear user state
        }
        

      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null); // Clear user state on network or other errors
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, twoFactorToken?: string): Promise<LoginResponse> => {
    try {
      const response = await axios.post<LoginResponse>(`${API_URL}/auth/login`, {
        email,
        password,
        twoFactorToken,
      }, {
        withCredentials: true,
      });

      const { data } = response;

      if (!data.requiresTwoFactor) {
        // Set cookie for additional security
        Cookies.set('access_token_w', data.accessToken);
        
        setUser(data.user);
        await checkAuth(); // Verify the token immediately
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    Cookies.remove('access_token_w');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}