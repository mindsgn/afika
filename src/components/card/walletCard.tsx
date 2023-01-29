//@ts-ignore
import { ETHLogo, MaticLogo } from '@orbyt/assets';
//@ts-ignore
import { AnimationAction, WalletAction } from '@orbyt/redux';
import { getAddress } from 'ethers/lib/utils';
// import { getAddress } from 'ethers/lib/utils';
import React from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { connect } from 'react-redux';

const WalletCard = (props: any) => {
  const { networkID, ens, address, currencySymbol, privKey } = props;
  const { updateSwitchNetwork } = AnimationAction(props);
  const { getChainId, getAccount, getTokenList } = WalletAction(props);
  const [mounted, setMounted] = React.useState<boolean>(false);
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
  const [balance, setBalance] = React.useState<number | null>(null);
  const truncateRegex = /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;

  const truncateEthAddress = (address: string) => {
    if (address === '') return null;
    const match = address.match(truncateRegex);
    if (!match) return address;
    return `${match[1]}…${match[2]}`;
  };

  React.useEffect(() => {
    if (mounted) {
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      }).start();
    }
    getChainId();
    getAccount(privKey);
    getTokenList(address);
    setMounted(true);
  }, [mounted]);

  return (
    <Animated.View
      style={{
        minHeight: 200,
        opacity: cardOpacity,
        display: 'flex',
        backgroundColor: 'black',
        borderRadius: 10,
        margin: 10,
        padding: 20,
        borderColor: 'white',
        borderWidth: 2,
      }}
    >
      <View>
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Bold',
            color: 'white',
            fontSize: 20,
          }}
        >
          {ens && ens ? ens : address && truncateEthAddress(address)}
        </Text>
      </View>
      <View
        style={{
          marginTop: -20,
        }}
      >
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Heavy',
            color: 'white',
            fontSize: 45,
          }}
        >
          {`${currencySymbol}`}
        </Text>
      </View>
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: '2%',
          bottom: '4%',
          borderRadius: 100,
          minWidth: 50,
          minHeight: 50,
          maxWidth: 50,
          maxHeight: 50,
        }}
      >
        {networkID && networkID === 137 ? (
          <MaticLogo
            width={50}
            height={50}
            onPress={updateSwitchNetwork(true)}
          />
        ) : networkID && networkID === 1 ? (
          <ETHLogo width={50} height={50} onPress={updateSwitchNetwork(true)} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const mapStateToProps = (state: any) => {
  return {
    connected: state.wallet.connected,
    privKey: state.wallet.privKey,
    user: state.wallet.user,
    error: state.wallet.error,
    networkID: state.wallet.networkID,
    ens: state.wallet.ens,
    address: state.wallet.address,
    currencySymbol: state.wallet.currencySymbol,
    currency: state.wallet.currency,
  };
};

export default connect(mapStateToProps)(WalletCard);
