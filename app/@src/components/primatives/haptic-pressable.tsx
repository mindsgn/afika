import React from 'react';
import { Pressable } from 'react-native';
import { withHaptic, HapticType } from '@/@src/lib/haptics';

type HapticPressableProps = React.ComponentProps<typeof Pressable> & {
  hapticType?: HapticType;
};

export const HapticPressable: React.FC<HapticPressableProps> = ({
  onPress,
  hapticType = 'light',
  ...rest
}) => {
  const handlePress = withHaptic(onPress, hapticType);
  return <Pressable onPress={handlePress} {...rest} />;
};
