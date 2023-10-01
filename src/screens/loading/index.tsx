import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

import { style } from './style';

const Loading = (props: any) => {
  const { navigation, route } = props;
  const { params } = route;
  const { MagicKey } = params;

  const isauth = async () => {
    try {
      const isLoggedIn = await MagicKey.user.isLoggedIn();
      if (isLoggedIn) {
        navigation.replace('HomeTabs');
      } else {
        navigation.replace('SignIn');
      }
    } catch (error) {
      //log error
      navigation.replace('HomeTabs');
    }
  };

  useEffect(() => {
    isauth();
  }, []);

  return (
    <View style={style.default}>
      <View>
        <Text
          style={[
            {
              fontFamily: 'SF-Pro-Rounded-Heavy',
              fontSize: 100,
              color: 'white',
            },
          ]}
        >
          ORBYT
        </Text>
        <ActivityIndicator size={'large'} />
      </View>
    </View>
  );
};

export { Loading };
