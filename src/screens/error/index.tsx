import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useWallet } from '../../context';

import { style } from './style';
import { colors } from '../../constants';

const Error = () => {
  return <View style={style.default}></View>;
};

export { Error };
