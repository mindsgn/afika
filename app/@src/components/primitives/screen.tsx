import React from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { colors } from '@/@src/theme/colors';

export const Screen: React.FC<ViewProps> = ({ style, children, ...rest }) => (
  <View style={[styles.screen, style]} {...rest}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
});

