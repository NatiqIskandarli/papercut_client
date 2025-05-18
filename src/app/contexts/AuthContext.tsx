// AuthContext.tsx
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
// import Cookies from 'js-cookie'; // Removed as we rely on HttpOnly cookies
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
  accessToken: string; // Still part of the response, even if primarily using HttpOnly cookie
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
  login: async () => ({ accessToken: '', user: {} as User }), // Return structure matches LoginResponse
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
        // If token is invalid or not sent, backend returns non-ok status
        setUser(null); // Clear user state
       // Cookies.remove('access_token_w'); // Not needed for HttpOnly cookies
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
        withCredentials: true, // Ensures axios sends HttpOnly cookies set by the server
      });

      const { data } = response;

      // The backend sets the HttpOnly cookie.
      // We just update the user state if login is successful and 2FA is not required.
      if (!data.requiresTwoFactor && data.user) {
        setUser(data.user);
        // Optionally, call checkAuth() again to verify the cookie was set and is working.
        // await checkAuth();
      }
      // If requiresTwoFactor is true, the UI should handle modal display.
      // The accessToken is still in 'data' if needed for any immediate non-HttpOnly use (unlikely here).
      return data;
    } catch (error) {
      console.error('Login error:', error);
      // Ensure user state is cleared on login failure if it was somehow set
      setUser(null);
      throw error;
    }
  };

  const logout = async () => { // Made async to potentially await backend logout
    try {
      // Call the backend logout endpoint to clear the HttpOnly cookie
      await axios.post(`${API_URL}/auth/logout`, {}, {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Proceed with client-side cleanup even if backend call fails
    } finally {
      // Cookies.remove('access_token_w'); // Not needed for HttpOnly cookies
      setUser(null); // Clear user state
      // Optionally redirect to login page
      if (typeof window !== 'undefined') {
        // window.location.href = '/login';
      }
    }
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