import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen } from '@/@src/components/primitives/screen';
import { Title } from '@/@src/components/primitives/title';
import { HapticPressable } from '@/@src/components/primitives/haptic-pressable';
import BridgeTest from './bridge-test';

export default function DebugNavigationScreen() {
  return (
    <Screen style={styles.container}>
      <Title>Debug Navigation</Title>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Testing Options</Text>
        
        <HapticPressable
          style={styles.option}
          onPress={() => {
            // Navigate to onboarding to test wallet creation
            console.log('🔧 [NAV] Navigating to onboarding for testing...');
          }}
        >
          <Text style={styles.optionText}>Test Onboarding Flow</Text>
        </HapticPressable>
        
        <HapticPressable
          style={styles.option}
          onPress={() => {
            // Navigate to wallet recovery
            console.log('🔧 [NAV] Navigating to wallet recovery...');
          }}
        >
          <Text style={styles.optionText}>Wallet Recovery</Text>
        </HapticPressable>
        
        <HapticPressable
          style={styles.option}
          onPress={() => {
            // Test direct wallet creation
            console.log('🔧 [NAV] Testing direct wallet creation...');
          }}
        >
          <Text style={styles.optionText}>Direct Wallet Test</Text>
        </HapticPressable>
        
        <HapticPressable
          style={styles.option}
          onPress={() => {
            // Navigate to bridge test
            console.log('🔧 [NAV] Navigating to bridge test...');
          }}
        >
          <Text style={styles.optionText}>Bridge Test</Text>
        </HapticPressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <Text style={styles.infoText}>
          This screen provides access to debugging tools for the Android wallet address issue.
        </Text>
        <Text style={styles.infoText}>
          • Onboarding: Tests the complete wallet creation flow with fallbacks
        </Text>
        <Text style={styles.infoText}>
          • Recovery: Access to fallback addresses and manual recovery
        </Text>
        <Text style={styles.infoText}>
          • Direct Test: Bypasses normal flow for isolated testing
        </Text>
        <Text style={styles.infoText}>
          • Bridge Test: Tests Go-to-JavaScript bridge directly
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Status</Text>
        <Text style={styles.statusText}>
          Check console logs for 🔧 [DEBUG] messages to see detailed execution flow.
        </Text>
        <Text style={styles.statusText}>
          Use Android Logcat to see Go native debug output.
        </Text>
        <Text style={styles.statusText}>
          Bridge Test can isolate Go vs JavaScript bridge issues.
        </Text>
      </View>

      <BridgeTest />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  section: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  option: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
    lineHeight: 20,
  },
  statusText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888',
    lineHeight: 20,
  },
});
