import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useWallet } from '../../context';

import { style } from './style';
import { colors } from '../../constants';

const Tokens = () => {
  const { rates: exchangeRate, marketData } = useWallet();
  const { rates } = exchangeRate;

  const isNegative = (price: number) => {
    if (price < 0) return true;
    return false;
  };

  const getFiatValue = () => {};

  return (
    <View style={style.default}>
      <FlatList
        data={marketData}
        renderItem={({ item }) => {
          const {
            name,
            image,
            current_price,
            price_change_24h,
            symbol,
            price_change_percentage_24h,
          } = item;

          const fiatPrice = parseFloat(current_price);

          return (
            <View key={item.id} style={style.tokenCard}>
              <View
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Image source={{ uri: `${image}` }} style={style.cardImage} />
                <View>
                  <Text style={style.cardName}>{name}</Text>
                  <View style={style.cardDetails}>
                    <Text>{`${symbol} `}</Text>
                    {isNegative(parseFloat(price_change_24h)) ? (
                      <Icon
                        name="arrow-down-outline"
                        size={20}
                        color={colors.red}
                      />
                    ) : (
                      <Icon
                        name="arrow-up-outline"
                        size={20}
                        color={colors.green}
                      />
                    )}
                    <Text>{` ${parseFloat(price_change_percentage_24h).toFixed(
                      2
                    )}%`}</Text>
                  </View>
                </View>
              </View>
              <View>
                <Text style={style.tokenPricePositive}>{`R ${(
                  fiatPrice * rates.ZAR
                ).toFixed(2)}`}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

export { Tokens };
