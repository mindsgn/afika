import { View, StyleSheet } from "react-native";
import Tag from "@/@src/components/tag";
import { SendMethod } from "@/@src/types/send";

const methods: SendMethod[] = [
  "bank",
  "ethereum",
  "bitcoin",
  "phone",
  "email",
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
    gap: 10,
    marginTop: 16,
  },
});