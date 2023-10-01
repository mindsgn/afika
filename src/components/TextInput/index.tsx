import React from 'react';
import { TextInput } from 'react-native';
import { style } from './style';

const Input = ({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: any;
}) => {
  return (
    <TextInput
      value={value}
      multiline={false}
      numberOfLines={1}
      maxLength={9}
      style={style.default}
      onChangeText={onChangeText}
    />
  );
};

export { Input };
