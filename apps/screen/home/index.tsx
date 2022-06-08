import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Settings from './settings/settings.screen';
import Wallet from './wallet/wallet.screen';
import Markets from './markets/markets.screen';
import Icon from 'react-native-vector-icons/Ionicons';

const Tab = createBottomTabNavigator();

const Main = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false
            }}
        >
            <Tab.Screen
                name="Wallet"
                component={Wallet}
                options={{
                    tabBarIcon: () => <Icon name="wallet" size={20} />
                }}
            />
            <Tab.Screen
                name="Markets"
                component={Markets}
                options={{
                    tabBarIcon: () => <Icon name="podium" size={20} />
                }}
            />
            <Tab.Screen
                name="Settings"
                component={Settings}
                options={{
                    tabBarIcon: () => <Icon name="settings" size={20} />
                }}
            />
        </Tab.Navigator>
    );
};

export default Main;
