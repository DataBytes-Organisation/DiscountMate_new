import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import React from 'react';
import '../global.css';

import { useColorScheme } from '@/hooks/useColorScheme';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { ShoppingListsProvider } from '../context/ShoppingListsContext';
import { ImageSearchProvider } from '../context/ImageSearchContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { NotificationCenterProvider } from '../context/NotificationCenterContext';

SplashScreen.preventAutoHideAsync().catch(() => {
   // The splash screen may already be hidden during fast web reloads.
});

export default function RootLayout() {
   const colorScheme = useColorScheme();
   const [loaded, fontError] = useFonts({
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
      if (loaded || fontError) {
         SplashScreen.hideAsync().catch(() => {
            // Ignore duplicate hide calls during development reloads.
         });
      }
   }, [loaded, fontError]);

   if (!loaded && !fontError) {
      return null;
   }

    return (
       <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <ImageSearchProvider>
             <AuthProvider>
                <ShoppingListsProvider>
                   <CartProvider>
                      <UserProfileProvider>
                         <NotificationCenterProvider>
                            <Stack>
                               <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                               <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                               <Stack.Screen name="(product)" options={{ headerShown: false }} />
                               <Stack.Screen name="(specials)" options={{ headerShown: false }} />
                               <Stack.Screen name="+not-found" />
                            </Stack>
                         </NotificationCenterProvider>
                      </UserProfileProvider>
                   </CartProvider>
                </ShoppingListsProvider>
             </AuthProvider>
          </ImageSearchProvider>
       </ThemeProvider>
    );

}
