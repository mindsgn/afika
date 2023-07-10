import React from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { connect } from 'react-redux';

import { network, colors } from '../../constants';
import { AnimationAction, WalletAction } from '../../redux';

const SwitchNetworkCard = (props: any) => {
  const { switchNetwork, providerUrl, settings, address, currency } = props;
  const { updateSwitchNetwork } = AnimationAction(props);
  const { getTokenList, getChainId, switchToNetwork } = WalletAction(props);
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
  const cardY = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (switchNetwork) {
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      Animated.timing(cardY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();

      Animated.timing(cardY, {
        toValue: 700,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [switchNetwork]);

  React.useEffect(() => {
    getTokenList(address, settings, currency);
    getChainId(providerUrl);
  }, [providerUrl]);
  return (
    <Animated.View
      style={[
        {
          width: '100%',
          backgroundColor: 'black',
          height: '80%',
          bottom: '0%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        },
        {
          opacity: cardOpacity,
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
            updateSwitchNetwork(!switchNetwork);
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
          NETWORK
        </Text>
      </View>
      <View
        style={{
          padding: 10,
        }}
      >
        {network.map((item: any) => {
          return (
            <TouchableOpacity
              key={item.name}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                margin: 10,
              }}
              onPress={() => {
                updateSwitchNetwork(!switchNetwork);
                switchToNetwork(item);
              }}
            >
              {item.icon}
              <Text
                style={{
                  color: 'white',
                  marginLeft: 10,
                }}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

const mapStateToProps = (state: any) => {
  return {
    switchNetwork: state.animation.switchNetwork,
    providerUrl: state.wallet.providerUrl,
    settings: state.wallet.settings,
    address: state.wallet.address,
    marketTokenList: state.wallet.marketTokenList,
    currency: state.wallet.currency,
  };
};

export default connect(mapStateToProps)(SwitchNetworkCard);
