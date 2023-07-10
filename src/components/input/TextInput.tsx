import React from 'react';
import {
  TextInput as Input,
  View,
  Text,
  KeyboardTypeOptions,
} from 'react-native';

export const TextInput = ({
  placeholder,
  flex = 1,
  title,
  type = 'default',
  onChangeText,
}: {
  placeholder?: string;
  flex?: number;
  title: string;
  type: KeyboardTypeOptions;
  onChangeText?: (text: string) => void;
}) => {
  return (
    <View
      style={{
        borderWidth: 4,
        flex: flex,
        margin: 5,
      }}
    >
      <Text
        style={{
          color: 'white',
          fontSize: 16,
          fontFamily: 'SF-Pro-Rounded-Heavy',
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: 10,
          borderColor: 'white',
          borderWidth: 1,
          padding: 5,
        }}
      >
        <Input
          style={{
            color: 'white',
            fontSize: 16,
            fontFamily: 'SF-Pro-Rounded-Heavy',
          }}
          multiline={false}
          placeholder={placeholder}
          onChangeText={onChangeText}
          keyboardType={type}
        />
      </View>
    </View>
  );
};
