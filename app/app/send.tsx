import { useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import AmountInput from "@/@src/components/amount-input";
import RecipientInput from "@/@src/components/recipient-input";
import { useFxRate } from '@/@src/lib/locale/useFxRate';
import { SendState, SendMethod } from "@/@src/types/send";
import { nextState, prevState } from "@/@src/store/send";
import { Button } from "@/@src/components/primitives/button";
import PocketCore, { Recipient } from "@/modules/pocket-module";
import { ensureWalletCoreReady } from "@/@src/lib/core/walletCore";
import { sendUSDC } from "@/@src/lib/ethereum/send-usdc";
import useWallet from "@/@src/store/wallet";
import BottomSheet, { BottomSheetRefProps } from "@/@src/components/bottom-sheet";
import { Title } from "@/@src/components/primitives/title";
import { useRouter } from "expo-router";
import RecipientForm from "@/@src/components/recipient-form";
import { convertLocalAmountToUsd } from "@/@src/lib/locale/currency";

export default function SendFlow() {
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const { rate, currency } = useFxRate();
  const router = useRouter()
  const { network } = useWallet();
  const [state, setState] = useState<SendState>("method");
  const [method, setMethod] = useState<SendMethod>("ethereum");
  const [amount, setAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [destination, setDestination] = useState("");
  const ref = useRef<BottomSheetRefProps>(null);
  const onPress = () => {
    router.replace("/recipient")
  };

  const next = () => setState(nextState(state));
  const back = () => setState(prevState(state));

  const nextFromRecipient = async () => {
    try {
      setState("sending")
     
      const isUsd = currency === 'USD';
      const usdcAmount = isUsd ? amount : convertLocalAmountToUsd(amount, rate);
      if (!usdcAmount) {
        return;
      }

      //@ts-expect-error
      await sendUSDC(network, recipientAddress, usdcAmount);
      setState("sent")
    } catch (error) {
      console.log(error)
      setState("error")
    }
  };

  return (
    <View style={styles.container}>
      {state === "method" && (
        <View style={{
          flex: 1,
          width: Dimensions.get("window").width,
          paddingHorizontal: 20,
        }}>
          <RecipientInput
            onPress={onPress}
            method={method}
            name={recipientName}
            phone={recipientPhone}
            onChangeName={(value) => {
              setRecipientName(value);
              setRecipientId(null);
            }}
            onChangePhone={(value) => {
              setRecipientPhone(value);
              setRecipientId(null);
            }}
            onSelectRecipient={(recipient) => {
              setRecipientName(recipient.name || "");
              setRecipientPhone(recipient.phone || "");
              setRecipientAddress(recipient.walletAddress || "");
              setRecipientId(recipient.uuid || null);
            }}
            next={next}
          />
        </View>
      )}

      {state === "amount" && (
        <AmountInput
          handleCompleteSwipe={nextFromRecipient}
          amount={amount}
          currency="R"
          onChange={setAmount}
          name={recipientName}
        />
      )}

      {state === "sending" && (
         <View>
          <View style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center"
          }}>
            <ActivityIndicator />
          </View>
        </View>
      )}

      {state === "error" && (
        <View style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Title>ERROR</Title>
          <Button
            label="RETRY"
            onPress={() => {
              router.push("/send")
            }}  
          />
        </View>
      )}

      {state === "sent" && (
        <View>
          <View style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Title>SUCCESS</Title>
          </View>
          <Button
            label="Done"
            onPress={() => {
              router.push("/(home)")
            }}  
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    justifyContent: "center",
    alignItems: "center"
  },
});
