/**
 * Skeletal Layout - Minimal version for new design
 * No Header, Sidebar, or existing components
 */

import { Slot } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function TabLayout() {
   return (
      <View className="flex-1 bg-white">
         <Slot />
      </View>
   );
}
