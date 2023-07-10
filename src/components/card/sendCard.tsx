import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux';

import { colors } from '../../constants';
import { AnimationAction, WalletAction } from '../../redux';
import { SignInButton as Button } from '../button';
import { TextInput } from '../input';

const SendCard = (prop: any) => {
  const { send, providerUrl, privateKey } = prop;
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const { updateSending } = AnimationAction(prop);
  const { sendPayment } = WalletAction(prop);
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
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            margin: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              updateSending(!send);
            }}
          >
            <Icon color="white" name="close" size={40} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: 'SF-Pro-Rounded-Bold',
              fontSize: 25,
              color: colors.white,
            }}
          >
            SEND
          </Text>
        </View>

        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <TextInput
            placeholder="Public Address, ENS or Phone Number"
            title="Reciever address"
            onChangeText={(address: string) => setAddress(address)}
            type="default"
          />
        </View>

        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <TextInput
            placeholder="0.00"
            title="Send Amount"
            type="numeric"
            onChangeText={(amount: string) => setAmount(amount)}
          />
        </View>

        <Button
          text="Send"
          onPress={() =>
            sendPayment(false, true, providerUrl, privateKey, address, amount)
          }
          color={colors.green}
        />
      </View>
    </Animated.View>
  );
};

const mapStateToProps = (state: any) => {
  return {
    send: state.animation.send,
    providerUrl: state.wallet.providerUrl,
    privateKey: state.wallet.privKey,
  };
};

export default connect(mapStateToProps)(SendCard);
