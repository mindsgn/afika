//@ts-ignore
import { colors } from '@orbyt/constants';
import React from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { connect } from 'react-redux';

import RPC from '../../lib/rpc';

export const TokenCard = ({
  name,
  symbol,
  amount,
}: {
  name: string;
  symbol: any;
  amount: any;
}) => {
  return (
    <TouchableOpacity
      style={{
        display: 'flex',
        height: 50,
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
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 100,
            backgroundColor: 'white',
          }}
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

      <View>
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Bold',
            color: `${colors.white}`,
          }}
        >
          R {amount}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
