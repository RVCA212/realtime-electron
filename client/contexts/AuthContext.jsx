import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001/api' : 'https://your-server-url.com/api');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTokenTimeout, setRefreshTokenTimeout] = useState(null);

  // Initialize token from secure storage on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we're in Electron environment
        if (window.electronAPI) {
          const storedToken = await window.electronAPI.store.get('auth_token');
          if (storedToken) {
            setToken(storedToken);
            return; // fetchUserInfo will be called by the token useEffect
          }
        } else {
          // Fallback to localStorage for web environment
          const storedToken = localStorage.getItem('auth_token');
          if (storedToken) {
            setToken(storedToken);
            return;
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Cleanup refresh timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTokenTimeout) {
        clearTimeout(refreshTokenTimeout);
      }
    };
  }, [refreshTokenTimeout]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        
        // Set up automatic token refresh if token has expiry info
        if (data.tokenExpiry) {
          scheduleTokenRefresh(data.tokenExpiry);
        }
      } else if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await refreshToken();
        if (!refreshed) {
          logout();
        }
      } else {
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      // Try to refresh token before logging out
      const refreshed = await refreshToken();
      if (!refreshed) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Token refresh functionality
  const refreshToken = async () => {
    try {
      const refreshTokenValue = await getStoredValue('refresh_token');
      if (!refreshTokenValue) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue })
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setUser(data.user);
        await storeSecureValue('auth_token', data.token);
        
        if (data.refreshToken) {
          await storeSecureValue('refresh_token', data.refreshToken);
        }
        
        if (data.tokenExpiry) {
          scheduleTokenRefresh(data.tokenExpiry);
        }
        
        return true;
      } else {
        // Refresh token is invalid, clear stored tokens
        await clearStoredTokens();
        return false;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  };

  // Schedule automatic token refresh
  const scheduleTokenRefresh = (expiryTime) => {
    if (refreshTokenTimeout) {
      clearTimeout(refreshTokenTimeout);
    }

    // Refresh token 5 minutes before expiry
    const refreshTime = new Date(expiryTime).getTime() - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const timeoutId = setTimeout(() => {
        refreshToken();
      }, refreshTime);
      
      setRefreshTokenTimeout(timeoutId);
    }
  };

  // Storage helper functions
  const storeSecureValue = async (key, value) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.store.set(key, value);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Failed to store ${key}:`, error);
    }
  };

  const getStoredValue = async (key) => {
    try {
      if (window.electronAPI) {
        return await window.electronAPI.store.get(key);
      } else {
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  };

  const clearStoredTokens = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.store.delete('auth_token');
        await window.electronAPI.store.delete('refresh_token');
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
    } catch (error) {
      console.error('Failed to clear stored tokens:', error);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        
        // Store tokens securely
        await storeSecureValue('auth_token', data.token);
        if (data.refreshToken) {
          await storeSecureValue('refresh_token', data.refreshToken);
        }
        
        // Schedule token refresh if expiry info is available
        if (data.tokenExpiry) {
          scheduleTokenRefresh(data.tokenExpiry);
        }
        
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const register = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        
        // Store tokens securely
        await storeSecureValue('auth_token', data.token);
        if (data.refreshToken) {
          await storeSecureValue('refresh_token', data.refreshToken);
        }
        
        // Schedule token refresh if expiry info is available
        if (data.tokenExpiry) {
          scheduleTokenRefresh(data.tokenExpiry);
        }
        
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  };

  const logout = async () => {
    // Clear refresh timeout
    if (refreshTokenTimeout) {
      clearTimeout(refreshTokenTimeout);
      setRefreshTokenTimeout(null);
    }
    
    // Clear state
    setToken(null);
    setUser(null);
    
    // Clear stored tokens
    await clearStoredTokens();
  };

  const apiCall = async (endpoint, options = {}) => {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // If unauthorized, try to refresh token once
    if (response.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // Retry the request with new token
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
      } else {
        await logout();
        throw new Error('Unauthorized');
      }
    }

    return response;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    apiCall,
    refreshToken,
    isAuthenticated: !!token && !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};