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

   // Inject Google Analytics for Expo Web
   useEffect(() => {
      if (typeof document !== 'undefined') {
         // Load GA script
         const script = document.createElement('script');
         script.async = true;
         script.src = "https://www.googletagmanager.com/gtag/js?id=G-KV1PBPHM30";
         document.head.appendChild(script);

         // Configure GA
         const inlineScript = document.createElement('script');
         inlineScript.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-KV1PBPHM30');
         `;
         document.head.appendChild(inlineScript);
      }
   }, []);

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
