import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/create" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/confirm" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)/password" options={{ headerShown: false }} />
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="send" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="error" options={{ headerShown: false }} />
    </Stack>
  );
}
