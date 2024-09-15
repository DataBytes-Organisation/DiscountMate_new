import React, { createContext, useState, useContext, ReactNode } from "react";
import { useRouter } from "expo-router"; // Use expo-router for navigation
import AsyncStorage from "@react-native-async-storage/async-storage"; // Use AsyncStorage for token storage

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const router = useRouter(); // Use useRouter from expo-router

  const login = async (token: string) => {
    try {
      await AsyncStorage.setItem("authToken", token); // Store the token in AsyncStorage
      setIsAuthenticated(true);
      router.push("/profile"); // Redirect to profile page after login
    } catch (error) {
      console.error("Error saving token:", error);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("authToken");
      setIsAuthenticated(false);
      router.push("/login"); // Redirect to login page after logout
    } catch (error) {
      console.error("Error removing token:", error);
    }
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
