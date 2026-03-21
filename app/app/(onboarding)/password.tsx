import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import useWallet from '@/@src/store/wallet';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { Screen } from '@/@src/components/primatives/screen';
import { Title } from '@/@src/components/primatives/title';

const PIN_LENGTH = 5;
const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

export default function PasswordScreen() {
  const { setWalletAddress, setNetwork, clearWalletState } = useWallet();
  const [confirmationPin, setConfirmationPin] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  const onPressNumber = async (value: string) => {
    if (confirmationPin.length >= PIN_LENGTH) return;
    setConfirmationPin((p) => [...p, value]);
  };

  const onDelete = async () => {
    if (confirmationPin.length === 0) return;
    setConfirmationPin((p) => p.slice(0, -1));
  };

  const unlock = async () => {
    try {
      setStatus('Unlocking wallet...');
      const dataDir = new Directory(Paths.document);
      await PocketCore.initWalletSecure(dataDir.uri);
      const walletAddress = await PocketCore.openOrCreateWallet('Main Wallet');
      
      try {
        await pocketBackend.saveWallet(walletAddress, DEFAULT_NETWORK)
        // await pocketBackend.listTransactions(walletAddress)
      } catch {
      }

      setWalletAddress(walletAddress);
      setNetwork(DEFAULT_NETWORK);
      router.replace('/(home)');
    } catch (error) {
      clearWalletState();
      router.replace({
        pathname: '/error',
        params: { title: '', message: `${error}` },
      });
    }
  };

  useEffect(() => {
    if (confirmationPin.length === PIN_LENGTH) {
      const password = SecureStore.getItem('password');
      if (password === confirmationPin.join('')) {
        void unlock();
      } else {
        setStatus('Incorrect PIN. Try again.');
        setConfirmationPin([]);
        setTimeout(() => {
          setStatus("")
        }, 2000)
      }
    }
  }, [confirmationPin]);

  const renderDot = (index: number) => {
    const filled = index < confirmationPin.length;
    return (
      <View
        key={index}
        style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
      />
    );
  };

  const renderButton = (label: string, onPress: () => void) => (
    <HapticPressable
      key={label}
      testID={`unlock-pin-key-${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
    >
      <Text style={styles.keyText}>{label}</Text>
    </HapticPressable>
  );


  if (status==="Unlocking wallet..." ){
    return(
      <Screen style={[{
          flex: 1,
          justifyContent: "center",
          alignItems: "center"
      }]}>
        <ActivityIndicator />
        <Title>{status}</Title>
      </Screen>
    )
  } 

  if (status==="Incorrect PIN. Try again."){
    return(
      <Screen style={[{
          flex: 1,
          justifyContent: "center",
          alignItems: "center"
      }]}>
        <Title>{status}</Title>
      </Screen>
    )
  }

  return (
    <Screen style={[styles.container]} testID="unlock-pin-screen">
      <View style={styles.numberContainer}>
        <Title>ENTER PIN</Title>
        <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => renderDot(i))}
        </View>
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
          renderButton(String(n), () => onPressNumber(String(n)))
        )}
        <View style={styles.keyPlaceholder} />
        {renderButton('0', () => onPressNumber('0'))}
        <HapticPressable
          testID="unlock-pin-delete"
          onPress={onDelete}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        >
          <Text style={styles.keyText}>⌫</Text>
        </HapticPressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  numberContainer:{
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    color: '#fff',
    fontSize: 28,
    marginBottom: 32,
    fontWeight: 'bold',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 48,
  },
  dot: {
    width: 50,
    height: 50,
    borderRadius: 7,
  },
  dotEmpty: {
    borderWidth: 3,
    borderColor: '#1F1F1F',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#1F1F1F',
  },
  keypad: {
    width: '80%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
    paddingBottom: 40,
  },
  key: {
    width: '30%',
    height: 50,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F1F1F',
  },
  keyPressed: {
    backgroundColor: '#89808F',
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
    fontWeight: "bold",
    fontSize: 28,
    width: '80%',
    textAlign: 'center',
  },
});
