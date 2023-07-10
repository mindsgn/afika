import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

import { colors } from '../../constants';

export const TokenCard = ({
  name,
  symbol,
  amount,
  fiatAmount,
  logo,
  currencySymbol,
  onPress,
}: {
  name: string;
  symbol: any;
  amount: any;
  fiatAmount: string;
  logo: string;
  currencySymbol: string;
  onPress: any;
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        height: 70,
        display: 'flex',
        borderRadius: 10,
        padding: 10,
        flexDirection: 'row',
        margin: 5,
        backgroundColor: 'black',
        borderWidth: 2,
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        borderColor: 'white',
      }}
    >
      <View
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: 100,
        }}
      >
        <Image
          style={{
            width: 30,
            height: 30,
          }}
          source={{ uri: logo }}
        />
        <View
          style={{
            marginLeft: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'SF-Pro-Rounded-Bold',
              color: `${colors.white}`,
            }}
          >
            {name}
          </Text>
        </View>
      </View>

      <View
        style={{
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Bold',
            color: `${colors.white}`,
            fontSize: 20,
          }}
        >
          {currencySymbol} {fiatAmount}
        </Text>
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Bold',
            color: `${colors.white}`,
            marginTop: -10,
          }}
        >
          {amount} {symbol}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
