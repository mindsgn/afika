//@ts-ignore
import { SignInButton } from '@orbyt/components';
//@ts-ignore
import { colors } from '@orbyt/constants';
//@ts-ignore
import { WalletAction } from '@orbyt/redux';
import React from 'react';
import { View, Animated, Text } from 'react-native';
import { connect } from 'react-redux';

// import { OnboardingButton as Button } from '../../components/onboarding/button';

import { style } from './style';

const SignIn = (props: any) => {
  const { connected, navigation, privKey, providerUrl } = props;
  const { connectWithWeb3Auth, getChainId, getAccount } = WalletAction(props);
  const progress = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
    Animated.timing(scale, { toValue: 0.4, useNativeDriver: true }).start();
  }, []);

  React.useEffect(() => {
    if (connected) {
      getChainId(providerUrl);
      getAccount(privKey);
      navigation.navigate('Home');
    }
  }, [connected]);

  return (
    <View style={style.default}>
      <View>
        <Text
          style={[
            {
              color: `${colors.white}`,
              fontSize: 50,
              width: 300,
              fontFamily: 'SF-Pro-Rounded-Heavy',
            },
          ]}
        >
          Sign in your wallet
        </Text>
      </View>
      <View
        style={{
          width: '90%',
          flex: 1,
          padding: 10,
          flexDirection: 'column',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
        }}
      >
        <SignInButton
          color="#F15A24"
          onPress={() => connectWithWeb3Auth()}
          text="SIGN IN WITH GOOGLE"
        />
      </View>
    </View>
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    connected: state.wallet.connected,
    privKey: state.wallet.privKey,
    address: state.wallet.address,
    providerUrl: state.wallet.providerUrl,
    settings: state.wallet.settings,
    marketTokenList: state.wallet.marketTokenList,
  };
};

export default connect(mapStateToProps)(SignIn);
