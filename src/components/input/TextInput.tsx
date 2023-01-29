import React from 'react';
import { TextInput as Input, View, Text } from 'react-native';

import { SignInButton as Button } from '../button';

export const TextInput = ({ type }: { type: string }) => {
  return (
    <View
      style={{
        borderWidth: 4,
        borderColor: 'white',
        padding: 20,
        width: '100%',
        height: 20,
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 10,
      }}
    >
      <Text
        style={{
          color: 'white',
          fontSize: 12,
        }}
      >
        Hello
      </Text>
    </View>
  );
};
