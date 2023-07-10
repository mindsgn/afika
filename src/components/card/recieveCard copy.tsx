import React from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux';

import { colors } from '../../constants';
import RPC from '../../lib/rpc';
import { AnimationAction } from '../../redux';

const ReceiveCard = (prop: any) => {
  const { receive, privKey } = prop;
  const { updateRecieving } = AnimationAction(prop);
  const cardY: any = React.useRef(new Animated.Value(700)).current;

  const [address, setAddress] = React.useState<string>('null');

  const getAccounts = async () => {
    try {
      const response = await RPC.getAccounts(privKey);
      setAddress(response);
    } catch (error) {}
  };

  React.useEffect(() => {
    if (receive) {
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
  }, [receive]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: '100%',
          backgroundColor: 'black',
          height: '80%',
          bottom: '0%',
          padding: 10,
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
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          margin: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            updateRecieving(!receive);
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
          RECIEVE
        </Text>
      </View>
      <View
        style={[
          {
            display: 'flex',
            width: '100%',
            height: 300,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            borderWidth: 4,
          },
        ]}
      >
        <QRCode
          size={250}
          enableLinearGradient
          linearGradient={['rgb(255,0,0)', 'rgb(0,255,255)']}
          value={`${address}`}
        />
      </View>
    </Animated.View>
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    receive: state.animation.receive,
    privKey: state.wallet.privKey,
  };
};

export default connect(mapStateToProps)(ReceiveCard);
