// components/send/AmountKeypad.tsx

import { View, Text, StyleSheet, Pressable } from "react-native";
import { HapticPressable } from "@/@src/components/primitives/haptic-pressable";

const keys = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];

export default function AmountKeypad({
  onPress,
}: {
  onPress: (value: string) => void;
}) {
  
  return (
    <View style={styles.grid}>
      {keys.map((k) => {
        let testID =  `pressable-${k}`
        if(testID=== `pressable-.`) testID = "pressable-dot"
        return(
          <HapticPressable 
            testID={testID}
            key={k} 
            onPress={() => onPress(k)} style={styles.key}>
            <Text style={styles.keyText}>{k}</Text>
          </HapticPressable>
        )
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 24,
    paddingBottom: 100,
  },
  key: {
    width: "33.33%",
    paddingVertical: 24,
    alignItems: "center",
  },
  keyText: {
    fontSize: 28,
    fontWeight: "600",
  },
});
