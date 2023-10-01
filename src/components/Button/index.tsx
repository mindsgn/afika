import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../../constants';
import { style } from './style';

const Button = ({
  title,
  onPress,
  color = colors.green,
}: {
  title: string;
  onPress: any;
  color?: string;
}) => {
  return (
    <TouchableOpacity
      style={[
        style.default,
        {
          backgroundColor: color,
        },
      ]}
      onPress={onPress}
    >
      <Text style={style.text}>{title}</Text>
    </TouchableOpacity>
  );
};

export { Button };
