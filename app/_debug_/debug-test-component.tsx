import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import PocketCore from './modules/pocket-module/src/PocketModule';
import { Directory, Paths } from 'expo-file-system';

export default function DebugTestComponent() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testWalletFunction = async () => {
    setLoading(true);
    try {
      console.log('🧪 Starting debug test...');
      
      const dataDir = new Directory(Paths.document);
      console.log('🧪 Data dir:', dataDir.uri);
      
      const testResult = await PocketCore.testInitWalletSecure(dataDir.uri);
      console.log('🧪 Test result:', testResult);
      setResult(testResult);
    } catch (error) {
      console.error('🧪 Test failed:', error);
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wallet Debug Test</Text>
      
      <Button
        title="Test InitWalletSecure"
        onPress={testWalletFunction}
        disabled={loading}
      />
      
      {loading && <Text style={styles.status}>Testing...</Text>}
      {result && <Text style={styles.result}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    marginTop: 10,
    color: '#666',
  },
  result: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
