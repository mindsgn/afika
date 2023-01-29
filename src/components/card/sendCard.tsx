import { colors } from '@orbyt/constants';
import { AnimationAction } from '@orbyt/redux';
import React from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux';

import { ShareCard } from './shareCard';
import { SignInButton as Button } from '../button';
import { TextInput } from '../input';

const SendCard = (prop: any) => {
  const { send } = prop;
  const [sendTo, setSendTo] = React.useState<string>('');
  const [tokenBalance, seTokenBalance] = React.useState<string>('');
  const [fiatbalance, setFiatBalance] = React.useState<string>('');
  const [amount, setAmount] = React.useState<string>('');
  const { updateSending } = AnimationAction(prop);
  const cardY = React.useRef(new Animated.Value(700)).current;

  React.useEffect(() => {
    if (send) {
      Animated.timing(cardY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(cardY, {
        toValue: 700,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [send]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: '100%',
          backgroundColor: 'black',
          height: '80%',
          bottom: '0%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        },
        {
          transform: [
            {
              translateY: cardY,
            },
          ],
        },
      ]}
    >
      <View
        style={{
          width: '90%',
        }}
      >
        <TouchableOpacity
          onPress={() => {
            updateSending(!send);
          }}
        >
          <Icon color="white" name="close" size={40} />
        </TouchableOpacity>
        <TextInput type="send to" />
        <TextInput type="send amount" />
        <Button text="Next" onPress={() => {}} color={colors.green} />
      </View>
    </Animated.View>
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    send: state.animation.send,
  };
};

export default connect(mapStateToProps)(SendCard);
