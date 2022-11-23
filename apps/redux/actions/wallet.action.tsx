import { useWalletConnect } from '@walletconnect/react-native-dapp';
import React from 'react';
import { CONNECT, DISCONNECT, ERROR, GET_COINGECKO } from '../../constants';
import {COINGECKO_API, CLIENT_ID} from "@env";
import Web3Auth, { LOGIN_PROVIDER, OPENLOGIN_NETWORK } from "@web3auth/react-native-sdk";
import * as WebBrowser from "@toruslabs/react-native-web-browser";
const scheme = 'orbyt';
const resolvedRedirectUrl = `${scheme}://openlogin`;

export const WalletAction = (props: any) => {
    const connectWallet = React.useCallback(async() => {
        try {
            const response = await new Web3Auth(WebBrowser, {
                clientId: `${CLIENT_ID}`,
                network: OPENLOGIN_NETWORK.TESTNET,
            });

            const info = await response.login({
              loginProvider: LOGIN_PROVIDER.GOOGLE,
              redirectUrl: resolvedRedirectUrl
            });

            props.dispatch({
                type: CONNECT,
                auth: response,
                connected: true,
                ed25519PrivKey: info.ed25519PrivKey,
                privKey: info.privKey,
                sessionId: info.sessionId,
                user: info.userInfo
            });
            
        } catch (error: any) {
            props.dispatch({
                type: error,
                connected: false,
                error: true
            });
        }
    },[]);

    const disconnectWallet = React.useCallback(async (auth: any) => {
        console.log('response: ', auth)
        try {
            //@ts-ignore
            const response = await auth.logout();

            

            props.dispatch({
                type: DISCONNECT,
                connected: false,
                auth: null,
                ed25519PrivKey: null,
                privKey: null,
                sessionId: null,
                user: null
            });
        } catch (error: any) {
            props.dispatch({
                type: DISCONNECT,
                connected: false,
                auth: null,
                ed25519PrivKey: null,
                privKey: null,
                sessionId: null,
                user: null
            });
        }
    },[]);

    const removeError = () => {
        props.dispatch({
            type: ERROR,
            error: false
        });
    };

    const getMarketData = React.useCallback(async () => {
        const response = await fetch(
            `${COINGECKO_API}/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false`,
            {
                method: "GET"
            }
        )
        .then((success) => {
           return success.json();
        }).catch(error => { 
            return error;
        });

        props.dispatch({
            type: GET_COINGECKO,
            markets: response
        });
    }, []);

    return {
        connectWallet,
        disconnectWallet,
        removeError,
        getMarketData,
    };
};

export default WalletAction;
