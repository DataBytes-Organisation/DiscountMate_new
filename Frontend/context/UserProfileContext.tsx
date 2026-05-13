import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchProfile } from "../services/profile";
import { UserProfile } from "../types/UserProfile";

type ProfileUpdater =
   | UserProfile
   | null
   | ((current: UserProfile | null) => UserProfile | null);

type UserProfileContextValue = {
   profile: UserProfile | null;
   loading: boolean;
   refreshProfile: () => Promise<UserProfile | null>;
   setCachedProfile: (nextProfile: ProfileUpdater) => void;
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
   const [profile, setProfile] = useState<UserProfile | null>(null);
   const [loading, setLoading] = useState(true);

   const refreshProfile = async (): Promise<UserProfile | null> => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
         setProfile(null);
         setLoading(false);
         return null;
      }

      setLoading(true);
      try {
         const nextProfile = await fetchProfile();
         setProfile(nextProfile);
         return nextProfile;
      } catch (error) {
         console.error("Error refreshing user profile:", error);
         setProfile(null);
         return null;
      } finally {
         setLoading(false);
      }
   };

   const setCachedProfile = (nextProfile: ProfileUpdater) => {
      setProfile((current) =>
         typeof nextProfile === "function"
            ? (nextProfile as (current: UserProfile | null) => UserProfile | null)(current)
            : nextProfile
      );
   };

   useEffect(() => {
      refreshProfile();
   }, []);

   return (
      <UserProfileContext.Provider
         value={{
            profile,
            loading,
            refreshProfile,
            setCachedProfile,
         }}
      >
         {children}
      </UserProfileContext.Provider>
   );
}

export function useUserProfile() {
   const context = useContext(UserProfileContext);
   if (!context) {
      throw new Error("useUserProfile must be used within a UserProfileProvider");
   }

   return context;
}
