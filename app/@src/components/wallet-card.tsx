import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { BodyText, Input, PrimaryButton } from '@/@src/components/Primitives';
import useWallet from '../store/wallet';

type Props = {
};

export default function WalletCard({ }: Props) {
  const { walletAddress } = useWallet();

  return (
    <View style={styles.card} testID="wallet-card">
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
});
