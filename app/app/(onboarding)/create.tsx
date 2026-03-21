import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/@src/components/primatives/screen';
import { Title } from '@/@src/components/primatives/title';
import { HapticPressable } from '@/@src/components/primatives/haptic-pressable';

const PIN_LENGTH = 5;

export default function PinScreen() {
  const [pin, setPin] = useState<string[]>([]);
  const router = useRouter();

  const onPressNumber = async (value: string) => {
    if (pin.length >= PIN_LENGTH) return;
    setPin((p) => [...p, value]);
  };

  const onDelete = async () => {
    if (pin.length === 0) return;
    setPin((p) => p.slice(0, -1));
  };

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      router.replace({
        pathname: '/(onboarding)/confirm',
        params: {
          pin: pin.join(''),
        },
      });   
    }
  }, [pin]);

  const renderDot = (index: number) => {
    const filled = index < pin.length;

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
      <HapticPressable
        key={label}
        testID={`create-pin-key-${label}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.key,
          pressed && styles.keyPressed,
        ]}
      >
        <Text style={styles.keyText}>{label}</Text>
      </HapticPressable>
    );
  };

  return (
    <Screen style={[styles.container]} testID="unlock-pin-screen">
         <View style={styles.numberContainer}>
           <Title>CREATE NEW PIN</Title>
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
