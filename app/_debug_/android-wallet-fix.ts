import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

// Alternative wallet initialization with fallbacks
export async function initializeWalletWithFallbacks(): Promise<string> {
  console.log('🔧 [FALLBACK] Starting wallet initialization with fallbacks...');
  
  const dataDir = new Directory(Paths.document);
  
  try {
    // Method 1: Try standard initWalletSecure
    console.log('🔧 [FALLBACK] Method 1: Trying initWalletSecure');
    await PocketCore.initWalletSecure(dataDir.uri);
    
    const address1 = await PocketCore.openOrCreateWallet('Main Wallet');
    if (address1 && address1.length === 42 && address1.startsWith('0x')) {
      console.log('🔧 [FALLBACK] Method 1 SUCCESS:', address1);
      return address1;
    }
    console.log('🔧 [FALLBACK] Method 1 FAILED: Invalid address', address1);
  } catch (error) {
    console.error('🔧 [FALLBACK] Method 1 ERROR:', error);
  }

  /*
  try {
    // Method 2: Try manual key generation with different data directory
    console.log('🔧 [FALLBACK] Method 2: Trying manual key generation with cleanup');
    
    // First, try to close any existing wallet to clean up
    try {
      await PocketCore.closeWallet();
      console.log('🔧 [FALLBACK] Closed existing wallet');
    } catch (closeError) {
      console.log('🔧 [FALLBACK] No existing wallet to close:', closeError);
    }
    
    // Generate random keys manually
    const masterKey = await generateSecureRandom(32);
    const salt = await generateSecureRandom(16);
    const masterKeyB64 = btoa(String.fromCharCode(...masterKey));
    const saltB64 = btoa(String.fromCharCode(...salt));
    
    console.log('🔧 [FALLBACK] Generated keys, trying init with fresh start...');
    
    // Use a subdirectory to avoid conflicts
    const cleanDataDir = `${dataDir.uri}/method2`;
    await PocketCore.initWalletSecure(cleanDataDir, masterKeyB64, saltB64);
    
    const address2 = await PocketCore.openOrCreateWallet('Main Wallet');
    if (address2 && address2.length === 42 && address2.startsWith('0x')) {
      console.log('🔧 [FALLBACK] Method 2 SUCCESS:', address2);
      return address2;
    }
    console.log('🔧 [FALLBACK] Method 2 FAILED: Invalid address', address2);
  } catch (error) {
    console.error('🔧 [FALLBACK] Method 2 ERROR:', error);
  }

  try {
    // Method 3: Try createEthereumWallet directly with better error handling
    console.log('🔧 [FALLBACK] Method 3: Trying direct wallet creation');
    
    // Close any existing wallet first
    try {
      await PocketCore.closeWallet();
      console.log('🔧 [FALLBACK] Closed existing wallet for Method 3');
    } catch (closeError) {
      console.log('🔧 [FALLBACK] No existing wallet to close for Method 3:', closeError);
    }
    
    // Initialize with fresh wallet
    await PocketCore.initWalletSecure(dataDir.uri);
    
    const address3 = await PocketCore.createEthereumWallet('Main Wallet');
    if (address3 && address3.length === 42 && address3.startsWith('0x')) {
      console.log('🔧 [FALLBACK] Method 3 SUCCESS:', address3);
      return address3;
    }
    console.log('🔧 [FALLBACK] Method 3 FAILED: Invalid address', address3);
  } catch (error) {
    console.error('🔧 [FALLBACK] Method 3 ERROR:', error);
    
    // If Method 3 fails, try one more approach with direct database access
    try {
      console.log('🔧 [FALLBACK] Method 3.1: Trying database reset and retry');
      
      // Try to reset database state
      await PocketCore.closeWallet();
      await PocketCore.initWalletSecure(dataDir.uri);
      
      const address3b = await PocketCore.createEthereumWallet('Main Wallet Retry');
      if (address3b && address3b.length === 42 && address3b.startsWith('0x')) {
        console.log('🔧 [FALLBACK] Method 3.1 SUCCESS:', address3b);
        return address3b;
      }
      console.log('🔧 [FALLBACK] Method 3.1 FAILED: Invalid address', address3b);
    } catch (retryError) {
      console.error('🔧 [FALLBACK] Method 3.1 ERROR:', retryError);
    }
  }
  */

  // If all real wallet methods fail, throw error instead of using mock
  console.log('🔧 [FALLBACK] All real wallet creation methods failed');
  throw new Error('All wallet creation methods failed. Please check Android file permissions and database access.');
}

// Generate cryptographically secure random bytes
async function generateSecureRandom(length: number): Promise<number[]> {
  const array = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser/modern environment
    crypto.getRandomValues(array);
  } else {
    // Fallback for older environments
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  return Array.from(array);
}

// Get stored fallback address
export async function getFallbackAddress(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('fallback_wallet_address');
  } catch {
    return null;
  }
}

// Clear fallback address
export async function clearFallbackAddress(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('fallback_wallet_address');
  } catch {
    // Ignore errors
  }
}
