//@ts-ignore
import {
  WalletCard,
  TokenContainer,
  ReceiveCard,
  SendCard,
  SwitchNetworkCard,
  TokenDataCard,
} from '../../components';
//@ts-ignore
import { colors } from '../../constants';
//@ts-ignore
import { AnimationAction } from '@orbyt/redux';
import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { connect } from 'react-redux';

import { style } from './style';

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
      <SwitchNetworkCard />
      <TokenDataCard />
    </View>
  );
};

const mapStateToProps = (state: any) => {
  return {
    receive: state.animation.receive,
    send: state.animation.send,
  };
};

export default connect(mapStateToProps)(Wallet);
