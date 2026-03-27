import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import useWallet from '@/@src/store/wallet';
import { getFallbackAddress, clearFallbackAddress } from '@/android-wallet-fix';
import { Screen } from '@/@src/components/primitives/screen';
import { Title } from '@/@src/components/primitives/title';

export default function WalletRecoveryScreen() {
  const { walletAddress, setWalletAddress } = useWallet();
  const [fallbackAddress, setLocalFallbackAddress] = useState<string | null>(null);

  useEffect(() => {
    checkForFallbackAddress();
  }, []);

  const checkForFallbackAddress = async () => {
    try {
      const address = await getFallbackAddress();
      setLocalFallbackAddress(address);
      if (address && !walletAddress) {
        console.log('🔧 [RECOVERY] Found fallback address, setting in wallet store:', address);
        setWalletAddress(address);
      }
    } catch (error) {
      console.error('🔧 [RECOVERY] Error checking fallback address:', error);
    }
  };

  const handleUseFallbackAddress = () => {
    if (fallbackAddress) {
      console.log('🔧 [RECOVERY] Using fallback address:', fallbackAddress);
      setWalletAddress(fallbackAddress);
      Alert.alert(
        'Wallet Recovered',
        'Using previously generated wallet address for testing.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'No Fallback Address',
        'No previously generated wallet address found. Please try onboarding again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleClearFallback = () => {
    clearFallbackAddress();
    setLocalFallbackAddress(null);
    Alert.alert(
      'Fallback Cleared',
      'Fallback wallet address has been cleared.',
      [{ text: 'OK' }]
    );
  };

  return (
    <Screen style={styles.container}>
      <Title>Wallet Recovery</Title>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Current Wallet Address:</Text>
        <Text style={styles.addressText}>
          {walletAddress || 'No address set'}
        </Text>
      </View>

      {fallbackAddress && (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>Fallback Address Available:</Text>
          <Text style={styles.fallbackAddress}>{fallbackAddress}</Text>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Use Fallback Address"
              onPress={handleUseFallbackAddress}
            />
            <Button
              title="Clear Fallback"
              onPress={handleClearFallback}
            />
          </View>
        </View>
      )}

      {!fallbackAddress && (
        <View style={styles.noFallbackContainer}>
          <Text style={styles.noFallbackText}>
            No fallback address available. This suggests wallet initialization may have failed completely.
          </Text>
          <Text style={styles.suggestionText}>
            Try clearing app data and going through onboarding again.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  statusContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
  },
  fallbackContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  fallbackAddress: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  useButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#f44336',
  },
  noFallbackContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
  },
  noFallbackText: {
    fontSize: 14,
    marginBottom: 10,
    color: '#333',
  },
  suggestionText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
