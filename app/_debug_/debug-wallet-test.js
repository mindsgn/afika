// Simple test script to verify wallet functionality
import PocketCore from '../modules/pocket-module/src/PocketModule';

async function testWallet() {
  try {
    console.log('🧪 Starting wallet test...');
    
    // Test 1: Check if module loads
    console.log('✅ Module loaded successfully');
    
    // Test 2: Try to init wallet (this will fail on Android if file system issues)
    try {
      console.log('🧪 Testing initWalletSecure...');
      await PocketCore.initWalletSecure('/tmp/test');
      console.log('✅ initWalletSecure succeeded');
    } catch (error) {
      console.error('❌ initWalletSecure failed:', error);
    }
    
    // Test 3: Try to create/open wallet
    try {
      console.log('🧪 Testing openOrCreateWallet...');
      const address = await PocketCore.openOrCreateWallet('Test Wallet');
      console.log('✅ openOrCreateWallet succeeded, address:', address);
      
      if (!address) {
        console.error('❌ Address is null or empty!');
      } else if (address.length !== 42) {
        console.error('❌ Invalid address length:', address.length);
      } else if (!address.startsWith('0x')) {
        console.error('❌ Address does not start with 0x');
      } else {
        console.log('✅ Address format is valid');
      }
    } catch (error) {
      console.error('❌ openOrCreateWallet failed:', error);
    }
    
  } catch (error) {
    console.error('🧪 Test failed completely:', error);
  }
}

testWallet();
