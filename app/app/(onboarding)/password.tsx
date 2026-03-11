import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import useWallet, { WalletTransaction } from '@/@src/store/wallet';

const PIN_LENGTH = 5;
const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' = process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

export default function PasswordScreen() {
  const {
    setWalletAddress,
    setTransactions,
    clearWalletState,
  } = useWallet();
  const [confirmationPin, setConfirmationPin] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const onPressNumber = async (value: string) => {
    if (confirmationPin.length >= PIN_LENGTH) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmationPin((p) => [...p, value]);
  };

  const onDelete = async () => {
    if (confirmationPin.length === 0) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmationPin((p) => p.slice(0, -1));
  };

  const getData = async(password: string) => {
    try{
      setStatus('Unlocking wallet...');
      const dataDir = new Directory(Paths.document);
      await PocketCore.initWalletSecure(dataDir.uri, password)
      const walletAddress = await PocketCore.openOrCreateWallet('Main Wallet');
      setWalletAddress(walletAddress);

      await PocketCore.syncInboundTransactions(DEFAULT_NETWORK);
      const txTransacttionResponse = await PocketCore.listAllTransactions(DEFAULT_NETWORK, 100, 0);
      const transactions = JSON.parse(txTransacttionResponse) as WalletTransaction[];
      setTransactions(Array.isArray(transactions) ? transactions : []);
      // console.log('Transactions:', txTransacttionResponse);

      // const txResponse = await PocketCore.getBalance(DEFAULT_NETWORK);
      // console.log("Balance: " ,txResponse)

      //const transactions = JSON.parse(txResponse) as WalletTransaction[];
      //console.log('Transactions:', transactions);


      //setTransactions(Array.isArray(transactions) ? transactions : []);
      
      
      router.replace({
        pathname: "/(home)",
        params: {
          password: confirmationPin.join('')
        }
      });
      
    } catch(error) {
      clearWalletState();
      router.replace({
        pathname: "/error",
        params: {
          title: "",
          message: `${error}`
        }
      });
    }
  }

  useEffect(() => {
    if (confirmationPin.length === PIN_LENGTH) {
      const password = SecureStore.getItem("password");
      if (password === confirmationPin.join('')) {
        getData(confirmationPin.join(''));
      } else {
        setStatus('Incorrect PIN. Try again.');
        setConfirmationPin([]);
      }
    }
  }, [confirmationPin]);

  const renderDot = (index: number) => {
    const filled = index < confirmationPin.length;

    return (
      <View
        key={index}
        style={[
          styles.dot,
          filled ? styles.dotFilled : styles.dotEmpty,
        ]}
      />
    );
  };

  const renderButton = (label: string, onPress: () => void) => {
    return (
      <Pressable
        key={label}
        testID={`unlock-pin-key-${label}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.key,
          pressed && styles.keyPressed,
        ]}
      >
        <Text style={styles.keyText}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="unlock-screen">
      <View style={styles.numberContainer}>
        <Text style={styles.title}>Enter PIN</Text>
          <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) =>
            renderDot(i)
          )}
        </View>
      </View>
      
      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
          renderButton(String(n), () => onPressNumber(String(n)))
        )}

        <View style={styles.keyPlaceholder} />

        {renderButton('0', () => onPressNumber('0'))}

        <Pressable
          testID="unlock-pin-delete"
          onPress={onDelete}
          style={({ pressed }) => [
            styles.key,
            pressed && styles.keyPressed,
          ]}
        >
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>

      {status ? <Text testID="unlock-status" style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  numberContainer:{
    height: 120,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 32,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 48,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotEmpty: {
    borderWidth: 1.5,
    borderColor: '#5A5A64',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#4F7FFF',
  },
  keypad: {
    width: '80%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
  },
  key: {
    width: '30%',
    height: 10,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15151A',
  },
  keyPressed: {
    backgroundColor: '#1F1F26',
  },
  keyText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '600',
  },
  keyPlaceholder: {
    width: '30%',
  },
  status: {
    marginTop: 24,
    color: '#B5B5BE',
    fontSize: 12,
    width: '80%',
    textAlign: 'center',
  },
});