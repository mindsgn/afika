import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Share from 'react-native-share';

import { style } from './style';
import { Heading } from '../../components/Heading';
import { useWallet } from '../../context';

const Recieve = (props: any) => {
  const { address } = useWallet();
  const { navigation } = props;

  const ShareTo = () => {
    const options = {
      message: `please send me tokens on ${address}`,
      title: 'Orbyt',
      subject: 'Orbyt',
    };

    Share.open(options)
      .then((res) => {
        // console.log(res);
      })
      .catch((err) => {
        err && console.log(err);
      });
  };

  return (
    <View style={style.default}>
      <Heading
        title="RECIEVE"
        exit={() => {
          navigation.navigate('Home');
        }}
      />
      <QRCode
        size={250}
        enableLinearGradient
        linearGradient={['rgb(255,0,0)', 'rgb(0,255,255)']}
        value={`${address}`}
      />
      <View style={style.main}>
        <TouchableOpacity
          style={style.button}
          onPress={() => {
            ShareTo();
          }}
        >
          <Text style={style.text}>SHARE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export { Recieve };
