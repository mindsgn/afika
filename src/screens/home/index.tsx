import React, { useEffect } from 'react';
import { View } from 'react-native';

import { style } from './style';
import {
  WalletCard,
  WalletButtons,
  TransactionContainer,
} from '../../components';
import { useWallet } from '../../context';

const Home = (props: any) => {
  const { route, navigation } = props;
  const { params } = route;
  const { MagicKey } = params;
  const { setMagic } = useWallet();

  useEffect(() => {
    setMagic(MagicKey);
  });

  return (
    <View style={style.default}>
      <WalletCard />
      <WalletButtons
        goToRecieve={() => {
          navigation.navigate('Recieve');
        }}
        goToSend={() => {
          navigation.navigate('Error');
        }}
      />
      <TransactionContainer />
    </View>
  );
};

export { Home };
