import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router'; // Use expo-router for navigation

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const router = useRouter(); 

  // Check for the authToken in localStorage when the component mounts
  useEffect(() => {
    const token = localStorage.getItem('authToken'); // Retrieve the token from localStorage
    setIsAuthenticated(!!token); // If the token exists, user is authenticated
  }, []);  

  // Login function
  const login = (token: string) => {
    localStorage.setItem('authToken', token); // Store the token in localStorage
    setIsAuthenticated(true);
    router.push('/profile'); // Redirect to profile page after login
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('authToken'); // Remove the token from localStorage
    setIsAuthenticated(false);
    router.push('/login'); // Redirect to login page after logout
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
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
