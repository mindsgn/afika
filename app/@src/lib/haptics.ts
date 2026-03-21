import * as Haptics from 'expo-haptics';

export type HapticType = 'light' | 'medium' | 'heavy';

const hapticStyleMap: Record<HapticType, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export async function triggerHaptic(type: HapticType = 'light'): Promise<void> {
  try {
    await Haptics.impactAsync(hapticStyleMap[type]);
  } catch {
    // Haptics are best-effort; ignore failures.
  }
}

export function withHaptic<T extends (...args: any[]) => any>(
  handler?: T,
  type: HapticType = 'light',
): ((...args: Parameters<T>) => ReturnType<T>) | undefined {
  if (!handler) return undefined;
  return ((...args: Parameters<T>) => {
    void triggerHaptic(type);
    return handler(...args);
  }) as (...args: Parameters<T>) => ReturnType<T>;
}
