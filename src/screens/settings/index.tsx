import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../../components';
import { useAuth } from '../../context';
import { colors } from '../../constants';

import { style } from './style';

const Settings = (props: any) => {
  const { route, navigation } = props;
  const { params } = route;
  const { MagicKey } = params;
  const { setAuth } = useAuth();

  const logout = async () => {
    try {
      const response = await MagicKey.user.logout();
      if (response) {
        setAuth(null);
        navigation.replace('Loading');
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <View style={style.default}>
      <View />
      <View>
        <Button title={'LOGOUT'} color={colors.red} onPress={() => logout()} />
      </View>
    </View>
  );
};

export { Settings };
