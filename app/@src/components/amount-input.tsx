import { View, Text, StyleSheet } from "react-native";
import AmountKeypad from "@/@src/components/amount-keypad";
import Avatar from "@/@src/components/avatar";
import { Body } from "@/@src/components/primatives/body";
import useWallet from "@/@src/store/wallet";
import { useFxRate } from "@/@src/lib/locale/useFxRate";
import { useState } from "react";
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useMemo, useEffect } from "react";
import SwipeButton from "@/@src/components/swipe-button";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";

const SWIPE_THRESHOLD = 250 - 10;

export default function AmountInput({
  amount,
  currency,
  onChange,
  name,
  handleCompleteSwipe
}: {
  amount: string;
  currency: string;
  onChange: (value: string) => void;
  name: string,
  handleCompleteSwipe: () => void
}) {
  const { balances,  } = useWallet();
  const { currency: localeCurrency,  } = useFxRate()
  const [ displayBalance, setDisplayBalance, ] = useState('');
  const { locale, rate } = useFxRate();
  const translateX = useSharedValue(0);
  
  const usdcValue = useMemo(() => {
    const usdc = balances.find((b) => b.symbol === 'USDC');
    if (!usdc) return 0;
    const raw = usdc.usdValue || usdc.balance || '0';
    return Number(raw);
  }, [balances]);
    
  useEffect(() => {
    // setUsdcBalance(usdcValue);
    const usdString = usdcValue.toString();
    const converted = convertUSD(usdString, rate);
    const value = converted ?? usdcValue;
      
    setDisplayBalance(formatCurrency((value - (amount === ""? 0 : parseFloat(amount) )), locale, localeCurrency));
  }, [usdcValue, locale, localeCurrency, rate, amount]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = Math.max(0, Math.min(e.translationX, SWIPE_THRESHOLD));
    })
    .onEnd(() => {
      if (translateX.value >= SWIPE_THRESHOLD - 40) {
        translateX.value = withSpring(SWIPE_THRESHOLD);
        runOnJS(handleCompleteSwipe)();
      } else {
        translateX.value = withSpring(0);
      }
    });

  const handleKey = (key: string) => {
    if (key === "⌫") {
      onChange(amount.slice(0, -1));
      return;
    }

    onChange(amount + key);
  };

  const sliderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }));

  return (
    <View style={styles.container}>
      <View style={{flex: 1}}>
      <View style={styles.avatar}>
        <View
          style={{
            alignSelf: "center",
          }}>
          <Avatar 
            seed={name} size={40}
          />
        </View>
        
        <View style={{
          paddingTop: 20,
          alignSelf: "center"
        }}>
          <Body>{name}</Body>
        </View>
      </View>
        
      <Text style={styles.amount}>
        {currency} {amount || "0"}
      </Text>

      <View style={{
          alignSelf: "center",
          paddingTop: 20
        }}>
          <Body>{displayBalance || formatCurrency(0, locale, localeCurrency)}</Body>
        </View>
      </View>
      <AmountKeypad 
        onPress={handleKey} 
      />
      <SwipeButton
        panGesture={panGesture}
        trackStyle={trackStyle}
        animatedStyle={sliderAnimatedStyle} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 24,
  },
  avatar: {
    textAlign: "center",
    alignSelf: "center",
    padding: 20,
  },
  amount: {
    fontSize: 42,
    fontWeight: "700",
    textAlign: "center",
  },
});