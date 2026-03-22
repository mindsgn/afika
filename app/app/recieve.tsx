import { View, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { Screen } from "@/@src/components/primatives/screen"
import useWallet from "@/@src/store/wallet";
import QRCodeStyled from 'react-native-qrcode-styled';
import { Button } from "@/@src/components/primatives/button";
import { Title } from "@/@src/components/primatives/title";
import { shortenAddress } from "@/@src/components/recipient-input";
import { useState } from "react";
import { Share } from 'react-native';

export default function RecieveScreen() {
  const { walletAddress } = useWallet()
  const [sharing, setSharing] = useState(false)
 
  const share = async() => {
    setSharing(true);
    try {
      await Share.share({
        message: walletAddress
      });
    } catch {
    } finally{
      setSharing(false)
    }
  } 

  return (
    <Screen style={styles.container}>
      <QRCodeStyled
        data={'Styling Pieces'}
        padding={25}
        pieceBorderRadius={'50%'}
        color={'#1F1F1F'}
      />
      <Title>{shortenAddress(walletAddress)}</Title>
      <Button 
        progress={sharing}
        label={"SHARE"} 
        onPress={share}/>
    </Screen>
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
