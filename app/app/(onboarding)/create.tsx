import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {useRouter} from 'expo-router';

const PIN_LENGTH = 5;

export default function PinScreen() {
  const [pin, setPin] = useState<string[]>([]);
  const router = useRouter();

  const onPressNumber = async (value: string) => {
    if (pin.length >= PIN_LENGTH) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((p) => [...p, value]);
  };

  const onDelete = async () => {
    if (pin.length === 0) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <Pressable
        key={label}
        testID={`create-pin-key-${label}`}
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
    <View style={styles.container} testID="create-pin-screen">
      <View style={styles.numberContainer}>
        <Text style={styles.title}>Create New PIN</Text>
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
          testID="create-pin-delete"
          onPress={onDelete}
          style={({ pressed }) => [
            styles.key,
            pressed && styles.keyPressed,
          ]}
        >
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>
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

  // filled circle (placeholder color when digit is entered)
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
});