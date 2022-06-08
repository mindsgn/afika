/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */
import { withWalletConnect } from '@walletconnect/react-native-dapp';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import Load from './apps/screen/load/load.screen';
import Onboarding from './apps/screen/onboarding/onboarding.screen';
import Home from './apps/screen/home';
import Error from './apps/screen/error/error.screen';
import { store, persistor } from './apps/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';

StatusBar.setHidden(true);

const Stack = createNativeStackNavigator();

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
                <NavigationContainer>
                    <Stack.Navigator
                        screenOptions={{
                            headerShown: false
                        }}
                    >
                        <Stack.Screen name="Load" component={Load} />
                        <Stack.Screen name="Home" component={Home} />
                        <Stack.Screen name="Error" component={Error} />
                        <Stack.Screen
                            name="Onboarding"
                            component={Onboarding}
                        />
                    </Stack.Navigator>
                </NavigationContainer>
            </PersistGate>
        </Provider>
    );
};

export default withWalletConnect(App, {
    bridge: 'https://bridge.walletconnect.org',
    clientMeta: {
        url: 'https://orbyt.org',
        icons: [
            'https://www.orbyt.org/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.7fce87d2.png&w=64&q=75'
        ],
        name: 'orbyt',
        description: 'connect orbyt to web3'
    },
    redirectUrl: 'orbyt://',
    storageOptions: {
        asyncStorage: AsyncStorage as any
    }
});
