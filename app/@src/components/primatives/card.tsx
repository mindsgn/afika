import React from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { colors } from '@/@src/theme/colors';

export const Card: React.FC<ViewProps> = ({ style, children, ...rest }) => (
  <View style={[styles.container, style]} {...rest}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
});

