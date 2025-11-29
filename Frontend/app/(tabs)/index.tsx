/**
 * Skeletal Homepage - Minimal version for new design
 * Replace this with your new homepage content
 */

import React from 'react';
import { View, Text } from 'react-native';

export default function HomeScreen() {
   return (
      <View className="flex-1 bg-white justify-center items-center p-5">
         <Text className="text-2xl font-bold text-gray-800 mb-2.5">Welcome to DiscountMate</Text>
         <Text className="text-base text-gray-600 text-center">Your new homepage starts here</Text>
      </View>
   );
}
