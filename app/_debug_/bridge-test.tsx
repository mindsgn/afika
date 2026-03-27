import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import PocketCore from '@/modules/pocket-module';

export default function BridgeTestScreen() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testDirectCall = async () => {
    setLoading(true);
    try {
      console.log('🔧 [BRIDGE] Testing direct PocketCore.openOrCreateWallet');
      
      // Call the function directly without any initialization
      const address = await PocketCore.openOrCreateWallet('Direct Test');
      
      console.log('🔧 [BRIDGE] Raw result:', address);
      console.log('🔧 [BRIDGE] Result type:', typeof address);
      console.log('🔧 [BRIDGE] Result length:', address?.length);
      
      setResult(address || 'NULL');
    } catch (error) {
      console.error('🔧 [BRIDGE] Direct call failed:', error);
      setResult(`ERROR: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bridge Test</Text>
      <Text style={styles.subtitle}>Tests Go-to-JavaScript bridge directly</Text>
      
      <Button
        title="Test Direct Call"
        onPress={testDirectCall}
        disabled={loading}
      />
      
      <Text style={styles.resultTitle}>Result:</Text>
      <Text style={styles.result}>{result}</Text>
      
      <Text style={styles.note}>
        If this returns a valid address, the Go code works.
        If this returns null, the bridge is broken.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  result: {
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
});
