import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router'; // Use expo-router for navigation
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const router = useRouter(); 

  // Check for the authToken in AsyncStorage when the component mounts
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = await AsyncStorage.getItem('authToken'); // Retrieve the token from AsyncStorage
      setIsAuthenticated(!!token); // If the token exists, user is authenticated
    };
    checkAuthStatus();
  }, []);  

  // Login function
  const login = async (token: string) => {
    await AsyncStorage.setItem('authToken', token); // Store the token in AsyncStorage
    setIsAuthenticated(true);
    router.push('/profile'); // Redirect to profile page after login
  };

  // Logout function
  const logout = async () => {
    await AsyncStorage.removeItem('authToken'); // Remove the token from AsyncStorage
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
