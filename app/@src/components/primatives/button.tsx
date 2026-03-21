import React from 'react';
import { Pressable, StyleSheet, Text, TextProps } from 'react-native';
import { colors } from '@/@src/theme/colors';
import { typography } from '@/@src/theme/typography';

export const Button: React.FC<{ label: string; onPress: () => void; testID?: string }> = ({
  label,
  onPress,
  testID,
}) => (
  <Pressable testID={testID} style={styles.button} onPress={onPress}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);


const styles = StyleSheet.create({
  button: {
    width: 200,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.buttonBackground,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.ButtonTitle,
    ...typography.button,
    fontWeight: '700',
  },
});

  
