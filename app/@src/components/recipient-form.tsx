import { View, StyleSheet } from "react-native";
import { Title }  from "@/@src/components/primatives/title"
import { Button }  from "@/@src/components/primatives/button"
import { TextInput,  } from "react-native";
import MethodSelector from "@/@src/components/selector";
import { SendMethod } from "@/@src/types/send";
import { useState } from "react";
import { ensureWalletCoreReady } from "@/@src/lib/core/walletCore";
import PocketCore from "@/modules/pocket-module";
import { useRouter } from "expo-router";
import { isAddress } from "ethers";

export type Recipient = {
  uuid: string;
  name: string;
  phone: string;
  walletAddress: string;
  email: string;
  country: string;
  createdAt: number;
  updatedAt: number;
};

export default function RecipientForm({
  method,
  setMethod
}:{
  method: SendMethod,
  setMethod: (method: SendMethod) => void
}) {
  const router = useRouter()
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false)
  
  const saveRecipeint = async() => {
    setSaving(true)
    try{
      await ensureWalletCoreReady();
      
      const payload: Recipient = {
        uuid: recipientId ?? "",
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
        walletAddress: recipientAddress,
        email: "",
        country: "",
        createdAt: 0,
        updatedAt: 0,
      };

      if (!payload.name) {
        throw new Error("Name is required");
      }
      
      const clean = recipientAddress.trim();
      
      if(!isAddress(clean)){
        throw new Error("ethereum address is required");
      }

      const saved = await PocketCore.saveRecipient(JSON.stringify(payload));
      const parsed = JSON.parse(saved || "{}") as Recipient;
      if (parsed?.uuid) setRecipientId(parsed.uuid);
      
    } catch (error){
      console.log(error)
    } finally{
      setSaving(false);
      router.replace("/send")
    }
  }

  return (
    <View style={{flex:1}}>
      <View style={{flex:1}}>
        <Title>Add Reciptient</Title>
        <MethodSelector
          value={method} 
          onChange={setMethod}
        />
        <TextInput
          testID="recipient-name-input"
          style={styles.input}
          placeholder="Name"
          onChangeText={(text: string) => {
            setRecipientName(text)
          }}
        />
        <TextInput
          testID="recipient-name-input"
          style={styles.input}
          placeholder="0x012E..."
          onChangeText={(text: string) => {
            setRecipientAddress(text)
          }}
        />
      </View>
      <Button
        label={"Add"}
        progress={saving}
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
