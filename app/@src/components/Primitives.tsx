import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextProps, View, ViewProps } from 'react-native';
import { colors } from '@/@src/theme/colors';
import { typography } from '@/@src/theme/typography';
import { withHaptic } from '@/@src/lib/haptics';

export const Screen: React.FC<ViewProps> = ({ style, children, ...rest }) => (
  <View style={[styles.screen, style]} {...rest}>
    {children}
  </View>
);

export const Card: React.FC<ViewProps> = ({ style, children, ...rest }) => (
  <View style={[styles.card, style]} {...rest}>
    {children}
  </View>
);

export const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);

export const BodyText: React.FC<{ children: React.ReactNode; style?: any } & TextProps> = ({ children, style, ...rest }) => (
  <Text style={[styles.body, style]} {...rest}>{children}</Text>
);

export const Input: React.FC<React.ComponentProps<typeof TextInput>> = (props) => (
  <TextInput
    placeholderTextColor={colors.textSecondary}
    {...props}
    style={[styles.input, props.style]}
  />
);

export const PrimaryButton: React.FC<{ label: string; onPress: () => void; testID?: string }> = ({
  label,
  onPress,
  testID,
}) => {
  const handlePress = withHaptic(onPress);
  return (
    <Pressable testID={testID} style={styles.button} onPress={handlePress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: {
    color: colors.textPrimary,
    ...typography.title,
  },
  body: {
    color: colors.textSecondary,
    ...typography.body,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    ...typography.body,
  },
  button: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textPrimary,
    ...typography.body,
    fontWeight: '700',
  },
});
