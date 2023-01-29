import { AnimationAction, WalletAction } from '@orbyt/redux';
import React from 'react';
import { View, Animated } from 'react-native';
// import SplashScreen from 'react-native-splash-screen';
import { connect } from 'react-redux';

import { style } from './style';

const Load = (props: any) => {
  const { getChainId, getAccount, getTokenList } = WalletAction(props);
  const { connected, navigation, privKey, address } = props;
  const [mounted, setMounted] = React.useState<boolean>(false);
  const textOpacity = React.useRef(new Animated.Value(0)).current;

  async function isConnected() {
    Animated.timing(textOpacity, {
      toValue: 0,
      delay: 1500,
      useNativeDriver: true,
    }).start();
    setTimeout(nextScreen, 1000);
  }

  async function nextScreen() {
    if (connected) {
      navigation.navigate('Home');
    } else {
      navigation.navigate('SignIn');
    }
  }

  React.useEffect(() => {
    setMounted(true);
    if (mounted) {
      Animated.timing(textOpacity, {
        toValue: 1,
        delay: 1500,
        useNativeDriver: true,
      }).start();

      if (privKey) {
        getChainId();
        getAccount(privKey);
        getTokenList(address);
      }
      setTimeout(isConnected, 2000);
    }
  }, [mounted]);

  return (
    <View style={style.default}>
      <View>
        <Animated.Text
          style={[
            {
              fontFamily: 'SF-Pro-Rounded-Heavy',
              fontSize: 60,
              color: 'white',
            },
            {
              opacity: textOpacity,
            },
          ]}
        >
          ORBYT
        </Animated.Text>
      </View>
    </View>
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    connected: state.wallet.connected,
    privKey: state.wallet.privKey,
    address: state.wallet.address,
  };
};

export default connect(mapStateToProps)(Load);
