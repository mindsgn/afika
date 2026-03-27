import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/@src/theme/colors';
import { typography } from '@/@src/theme/typography';

export const Button: React.FC<{ 
  label: string; 
  onPress: () => void; 
  width?: number
  testID?: string;
  progress?: boolean;
  backgroundColor?: string;
  color?: string;
}> = ({
  label,
  onPress,
  width = 150,
  testID,
  progress = false,
  backgroundColor = colors.buttonBackground,
  color = colors.buttonTextBackground,
}) => (
  <Pressable testID={testID} style={[styles.button, {
    width,
    backgroundColor
  }]} onPress={onPress}>
    {
      progress?
      <ActivityIndicator />
      :
      <Text 
        style={[
          styles.buttonText,
          {
            color,
          }
        ]}>
          {label}
      </Text>
    }
  </Pressable>
);


const styles = StyleSheet.create({
  button: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: "center"
  },
  buttonText: {
    
    ...typography.button,
    fontWeight: '700',
  },
});

  
