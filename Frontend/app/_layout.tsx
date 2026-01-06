import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import React from 'react';
import '../global.css';

import { useColorScheme } from '@/hooks/useColorScheme';
import { CartProvider } from './(tabs)/CartContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
   const colorScheme = useColorScheme();
   const [loaded] = useFonts({
      SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
   });

   useEffect(() => {
      if (loaded) {
         SplashScreen.hideAsync();
      }
   }, [loaded]);

   if (!loaded) {
      return null;
   }

   return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
         <CartProvider>
            <Stack>
               <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
               <Stack.Screen name="(auth)" options={{ headerShown: false }} />
               <Stack.Screen name="(product)" options={{ headerShown: false }} />
               <Stack.Screen name="+not-found" />
            </Stack>
         </CartProvider>
      </ThemeProvider>
   );
}
