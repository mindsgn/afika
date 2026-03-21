import { View, StyleSheet } from "react-native";
import { Title }  from "@/@src/components/primatives/title"
import { Button }  from "@/@src/components/primatives/button"
import { TextInput,  } from "react-native";
import MethodSelector from "./selector";

export default function RecipientForm({
  method,
  setMethod
}:{
  method: string,
  setMethod: () => void
}) {
  
  const saveRecipeint = async() => {
    try{
    } catch {
    }
  }

  return (
    <View>
      <Title>Add Reciptient</Title>
      <MethodSelector
        value={method} 
        onChange={setMethod}
      />
      <TextInput
        testID="recipient-name-input"
        style={styles.input}
        placeholder="Name"
      />
      <TextInput
        testID="recipient-phone-input"
        style={styles.input}
      />
      <Button 
        label={"Add"}
        onPress={saveRecipeint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
  },
});
