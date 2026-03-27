#!/bin/bash

echo "🔍 Checking Android logs for wallet debug information..."
echo ""

# Check for Go debug messages
echo "📱 Go Native Debug Logs:"
adb logcat -d | grep "DEBUG:" | tail -20

echo ""
echo "📱 React Native Debug Logs:"
adb logcat -d | grep "🔧 \[DEBUG\]" | tail -20

echo ""
echo "📱 Error Logs:"
adb logcat -d | grep -E "(ERROR|FATAL)" | tail -10

echo ""
echo "📱 PocketCore Module Logs:"
adb logcat -d | grep "PocketCore" | tail -20

echo ""
echo "📱 SQLCipher Logs:"
adb logcat -d | grep -i "sqlcipher\|sqlite" | tail -10

echo ""
echo "💡 To see live logs, run:"
echo "adb logcat | grep -E 'DEBUG:|🔧|PocketCore|ERROR'"
