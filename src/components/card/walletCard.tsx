//@ts-ignore
import { ETHLogo, MaticLogo } from '@orbyt/assets';
//@ts-ignore
import { AnimationAction, WalletAction } from '@orbyt/redux';
import { getAddress } from 'ethers/lib/utils';
import React from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { connect } from 'react-redux';

const WalletCard = (props: any) => {
  const {
    networkID,
    ens,
    address,
    currencySymbol,
    privKey,
    providerUrl,
    totalBalance,
    settings,
    currency,
  } = props;
  const { updateSwitchNetwork } = AnimationAction(props);
  const { getChainId, getAccount, setBalance, getBalance, getTokenList } =
    WalletAction(props);
  const [mounted, setMounted] = React.useState<boolean>(false);
  const [total, setTotal] = React.useState<number>(0);
  const cardOpacity = React.useRef(new Animated.Value(0)).current;
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
    getChainId(providerUrl);
    getAccount(privKey);
    setMounted(true);
  }, [mounted]);

  React.useEffect(() => {
    getTokenList(address, settings, currency);
  }, [networkID]);

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
        borderWidth: 5,
      }}
    >
      <TouchableOpacity>
        <Text
          style={{
            fontFamily: 'SF-Pro-Rounded-Bold',
            color: 'white',
            fontSize: 20,
          }}
        >
          {ens && ens ? ens : address && truncateEthAddress(address)}
        </Text>
      </TouchableOpacity>
      <View
        style={{
          marginTop: -20,
        }}
      >
        <TouchableOpacity>
          <Text
            style={{
              fontFamily: 'SF-Pro-Rounded-Heavy',
              color: 'white',
              fontSize: 45,
            }}
          >
            {`${currencySymbol} ${totalBalance.toFixed(2)}`}
          </Text>
        </TouchableOpacity>
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
        onPress={() => updateSwitchNetwork(true)}
      >
        {networkID && networkID === 137 ? (
          <MaticLogo width={50} height={50} />
        ) : networkID && networkID === 80001 ? (
          <MaticLogo width={50} height={50} />
        ) : networkID && networkID === 1 ? (
          <ETHLogo width={50} height={50} />
        ) : networkID && networkID === 5 ? (
          <ETHLogo width={50} height={50} />
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
    providerUrl: state.wallet.providerUrl,
    settings: state.wallet.settings,
    totalBalance: state.wallet.totalBalance,
  };
};

export default connect(mapStateToProps)(WalletCard);
