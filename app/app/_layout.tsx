import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/create" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/confirm" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/password" options={{ headerShown: false }} />
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="send" options={{ headerShown: false }} />
        <Stack.Screen name="error" options={{ headerShown: false }} />
        <Stack.Screen name="recepient" options={{ headerShown: false }} />
        <Stack.Screen name="recieve" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
