//@ts-ignore
import {
  WalletCard,
  TokenContainer,
  ReceiveCard,
  SendCard,
} from '@orbyt/components';
//@ts-ignore
import { colors } from '@orbyt/constants';
//@ts-ignore
import { AnimationAction } from '@orbyt/redux';
import { Qrcode } from '@walletconnect/react-native-dapp';
import { ethers } from 'ethers';
import React from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { connect } from 'react-redux';

import { style } from './style';
import RPC from '../../lib/rpc';

const Wallet = (props: any) => {
  const { receive, send } = props;
  const { updateRecieving, updateSending } = AnimationAction(props);
  const [mounted, setMounted] = React.useState<boolean>(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    setMounted(true);

    if (mounted) {
      Animated.timing(opacity, {
        toValue: 1,
        delay: 1000,
        duration: 2500,
        useNativeDriver: true,
      }).start();
    }
  }, [mounted]);

  React.useEffect(() => {}, [send]);

  return (
    <View style={style.default}>
      <WalletCard />
      <Animated.View
        style={[
          {
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            padding: 10,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'space-evenly',
            marginVertical: 5,
          },
          {
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            updateSending(!send);
          }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: `${colors.orange}`,
            width: '50%',
            height: 60,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontFamily: 'SF-Pro-Rounded-Bold',
              fontSize: 25,
            }}
          >
            Send
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            updateRecieving(!receive);
          }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: `${colors.green}`,
            width: '50%',
            height: 60,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <Text
            style={{
              color: 'white',
              fontFamily: 'SF-Pro-Rounded-Bold',
              fontSize: 25,
            }}
          >
            Receive
          </Text>
        </TouchableOpacity>
      </Animated.View>
      <TokenContainer />
      <ReceiveCard />
      <SendCard />
    </View>
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    receive: state.animation.receive,
    send: state.animation.send,
  };
};

export default connect(mapStateToProps)(Wallet);
