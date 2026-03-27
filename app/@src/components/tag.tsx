// components/tag.tsx

import { Text, StyleSheet } from "react-native";
import { HapticPressable } from "./primitives/haptic-pressable";

export default function Tag({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <HapticPressable
      onPress={onPress}
      style={[
        styles.tag,
        selected && styles.selectedTag
      ]}
    >
      <Text
        style={[
          styles.text,
          selected && styles.selectedText
        ]}
      >
        {label}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  selectedTag: {
    backgroundColor: "#1F7A4D",
    borderColor: "#1F7A4D",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#344054",
  },
  selectedText: {
    color: "#FFFFFF",
  },
});
