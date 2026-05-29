import {
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    useFonts,
} from "@expo-google-fonts/poppins";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { AppThemeProvider, useAppTheme } from "../src/theme/ThemeContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { resolved } = useAppTheme();
  const bgStyle = resolved === "dark" ? "#0B0B0E" : "#F6F1E9";
  const scrollbarThumb = resolved === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
  const scrollbarHover = resolved === "dark" ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)";

  return (
    <ThemeProvider value={resolved === "dark" ? DarkTheme : DefaultTheme}>
      {Platform.OS === "web" && (
        <style
          // @ts-ignore
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                background-color: ${bgStyle} !important;
              }
              /* Webkit scrollbar styles */
              ::-webkit-scrollbar {
                width: 10px;
                height: 10px;
              }
              ::-webkit-scrollbar-track {
                background: transparent;
              }
              ::-webkit-scrollbar-thumb {
                background: ${scrollbarThumb};
                border-radius: 5px;
                border: 2px solid transparent;
                background-clip: padding-box;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: ${scrollbarHover};
                border: 2px solid transparent;
                background-clip: padding-box;
              }
              /* Firefox scrollbar styles */
              * {
                scrollbar-width: thin;
                scrollbar-color: ${scrollbarThumb} transparent;
              }
            `,
          }}
        />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="manga/[mangaId]" />
        <Stack.Screen name="reader/[chapterId]" />
      </Stack>

      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
