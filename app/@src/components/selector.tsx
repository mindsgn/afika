// components/send/MethodSelector.tsx

import { View, StyleSheet } from "react-native";
import Tag from "@/@src/components/tag";
import { SendMethod } from "@/@src/types/send";

const methods: SendMethod[] = [
  // "phone",
  // "bank",
  "ethereum",
  // "bitcoin",
  // "email",
];

export default function MethodSelector({
  value,
  onChange,
}: {
  value: SendMethod | null;
  onChange: (m: SendMethod) => void;
}) {
  return (
    <View style={styles.container}>
      {methods.map((m) => (
        <Tag
          key={m}
          label={m}
          selected={value === m}
          onPress={() => onChange(m)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
});