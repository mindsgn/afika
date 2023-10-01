import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { style } from './style';
import { colors } from '../../constants';

const Heading = ({ exit, title }: { exit: any; title: string }) => {
  return (
    <View style={style.default}>
      <TouchableOpacity onPress={exit}>
        <Icon color={colors.white} name="close" size={40} />
      </TouchableOpacity>
      <Text style={style.title}>{title}</Text>
    </View>
  );
};

export { Heading };
