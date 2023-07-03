//@ts-ignore
import { COINGECKO_API_V3 } from '@env';
import { colors } from '@orbyt/constants';
import { WalletAction } from '@orbyt/redux';
import React from 'react';
import { tokens } from './../../constants/tokens';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { connect } from 'react-redux';

export const TokenCard = ({
  name,
  symbol,
  amount,
  fiatAmount,
  logo,
  currencySymbol,
}: {
  name: string;
  symbol: any;
  amount: any;
  fiatAmount: string;
  logo: string;
  currencySymbol: string;
}) => {
  return (
    <TouchableOpacity
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
