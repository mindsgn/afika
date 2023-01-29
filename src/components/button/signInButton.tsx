import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

export const SignInButton = ({
  color,
  text,
  onPress,
}: {
  color: string;
  text: string;
  onPress(): void;
}) => {
  return (
    <TouchableOpacity
      style={{
        marginBottom: 10,
        backgroundColor: color,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        width: '100%',
        height: 50,
        borderRadius: 10,
      }}
      onPress={onPress}
    >
      <View>
        <Text
          style={{
            color: 'white',
            fontSize: 21,
            fontFamily: 'SF-Pro-Rounded-Heavy',
          }}
        >
          {text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
