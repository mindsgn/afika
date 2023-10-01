import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { style } from './style';

const TransactionLoadingContainer = () => {
  return (
    <View style={style.default}>
      <ActivityIndicator size={'large'} />
    </View>
  );
};

export { TransactionLoadingContainer };
