import { useEffect, useMemo, useState } from "react";
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from "react-native";
import PocketCore, { Recipient } from "@/modules/pocket-module";
import { SendMethod } from "@/@src/types/send";
import { Title } from "./primatives/title";
import { HapticPressable } from "./primatives/haptic-pressable";
import Avatar from "./avatar";
// import { getWalletAddressByPhone } from "@/@src/lib/firebase/wallet-address";
import { isAddress, getAddress } from 'ethers';

/**
 * Shortens an Ethereum address for UI display.
 * @param address The full 42-character address
 * @param chars Number of characters to show at the beginning and end
 * @returns Shortened string or a fallback if invalid
 */
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address || !isAddress(address)) {
    return 'Invalid Address';
  }

  // Optional: Use getAddress to ensure the checksum (case-sensitivity) is correct
  const cleanAddress = getAddress(address);
  
  const start = cleanAddress.substring(0, chars + 2); // Includes '0x'
  const end = cleanAddress.substring(42 - chars);
  
  return `${start}...${end}`;
};

export default function RecipientInput({
  method,
  name,
  phone,
  onChangeName,
  onChangePhone,
  onSelectRecipient,
  next,
  onPress
}: {
  method: SendMethod;
  name: string;
  phone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSelectRecipient: (r: Recipient) => void;
  next:() => void;
  onPress:() => void;
}) {
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [label, setLabel] = useState<string>("Phone number");
  
  const phonePlaceholder = useMemo(() => {
    if (method === "phone") return "+27...";
    if (method === "email") return "email@example.com";
    if (method === "ethereum") return "0x...";
    return "Phone number";
  }, [method]);

  const labelPlaceholder = useMemo(() => {
    if (method === "phone") return "+27...";
    if (method === "email") return "email@example.com";
    if (method === "ethereum") return "0x...";
    return "Phone number";
  }, [method]);

  useEffect(() => {
    const getAll = async() => {
      const data = await PocketCore.getAllRecipients()
      const reciptientList = JSON.parse(data || "[]") as Recipient[]
      const map = new Map<string, Recipient>();

      for (const item of [...reciptientList]) {
        if (item?.uuid) map.set(item.uuid, item);
      }

      setSuggestions(Array.from(map.values()));
    } 
    getAll()
  },[]) 

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View></View>
        <TouchableOpacity onPress={onPress}>
          <Title>+</Title>
        </TouchableOpacity>
      </View>
      <View>
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((item) => {
              if (item.phone === "" && item.walletAddress === "")  return null
              return(
                  <HapticPressable
                    key={item.uuid}
                    style={styles.suggestionItem}
                    onPress={() => {
                      onChangeName(item.name || "");
                      onChangePhone(item.phone || "");
                      onSelectRecipient(item);
                      next();
                    }}
                  >
                    <View style={[
                      {
                        marginVertical: 10,
                        marginHorizontal: 10,
                      }
                      ]}>
                        <Avatar seed={`${item.name}`} size={50} />
                    </View>
                    
                    <View>
                      <Text style={styles.suggestionName}>{item.name || "Unnamed"}</Text>
                      {
                        method === "phone"?
                        <Text style={styles.suggestionMeta}>
                          {[item.phone, item.email].filter(Boolean).join(" • ")}
                        </Text>
                        :
                        <Text style={styles.suggestionMeta}>
                          {shortenAddress(item.walletAddress)}
                        </Text>
                      }
                    </View>
                  </HapticPressable>
            )
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
    marginTop: 24,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  suggestions: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center"

  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionMeta: {
    fontSize: 12,
    color: "#666",
  },
});
