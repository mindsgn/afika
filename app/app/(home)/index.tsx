import { ScrollView, StyleSheet } from 'react-native';
import { Screen } from '@/@src/components/Primitives';
import WalletCard from '@/@src/components/wallet-card';
import TransactionList from '@/@src/components/transactions';
import ActionCard from '@/@src/components/action';
import { useFirebaseSync } from '@/@src/lib/firebase/useFirebaseSync';
import useWallet from '@/@src/store/wallet';

export default function Home() {
  const { walletAddress } = useWallet();
  useFirebaseSync();

  console.log('🔧 [DEBUG] Home screen - walletAddress:', walletAddress);
  console.log('🔧 [DEBUG] Home screen - address type:', typeof walletAddress);
  console.log('🔧 [DEBUG] Home screen - address length:', walletAddress?.length);
  console.log('🔧 [DEBUG] Home screen - address is null:', walletAddress === null);
  console.log('🔧 [DEBUG] Home screen - address is empty string:', walletAddress === '');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} testID="home-screen">
        <WalletCard />
        <ActionCard />
        <TransactionList />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
    gap: 10,
  },
  title: {
  },
  section: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#224738',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFD8D2',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: '#5C7265',
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 12,
    color: '#1C2C24',
  },
  input: {
    borderWidth: 1,
    borderColor: '#C6D2CA',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
  },
  sendButton: {
    marginTop: 4,
    backgroundColor: '#1F7A4D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: '#294638',
  },
});
