import React from "react";
import { View } from "react-native";

import RegisterHeroSection from "../../components/auth/RegisterHeroSection";


export default function RegisterPage() {
   return (
      <View className="flex-1 bg-white px-4 pt-6 pb-10">
         <RegisterHeroSection />
      </View>
   );
}
