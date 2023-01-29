//@ts-ignore
import { SignInButton } from '@orbyt/components';
//@ts-ignore
import { colors } from '@orbyt/constants';
//@ts-ignore
import { WalletAction } from '@orbyt/redux';
import React from 'react';
import { View, Animated, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux';

// import { OnboardingButton as Button } from '../../components/onboarding/button';

import { style } from './style';

const Settings = (props: any) => {
  return <View style={style.default} />;
};

const mapStateToProps = (state: any, props: any) => {
  return { connected: state.connected, markets: state.markets };
};

export default connect(mapStateToProps)(Settings);
