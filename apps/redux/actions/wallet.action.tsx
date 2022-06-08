import { useWalletConnect } from '@walletconnect/react-native-dapp';
import React from 'react';
import { CONNECT, ERROR, GET_COINGECKO } from '../../constants';
import {COINGECKO_API} from "@env";
import { connect } from 'react-redux';

export const WalletAction = (props: any) => {
    const connector = useWalletConnect();

    const connectWallet = React.useCallback(async () => {
        try {
            connector
                .connect()
                .then((success: any) => {
                    props.dispatch({
                        type: CONNECT,
                        connected: true,
                        address: success.accounts[0],
                        chainId: success.chainId,
                        peerId: success.peerId,
                        peerMeta: success.peerMeta
                    });
                })
                .catch((error) => {
                    console.log(error);
                    props.dispatch({
                        type: ERROR,
                        connected: false
                    });
                });
        } catch (error: any) {
            props.dispatch({
                type: ERROR,
                error: true
            });
        }
    }, []);

    const disconnectWallet = React.useCallback(async () => {
        try {
            console.log("disconnecting app")
            connector
                .killSession()
                .then((success: any) => {
                    props.dispatch({
                        type: CONNECT,
                        connected: false,
                        address: '',
                        chainId: null,
                        peerId: null,
                        peerMeta: null
                    });
                })
                .catch((error) => {
                    props.dispatch({
                        type: ERROR,
                        error: true
                    });
                });
        } catch (error: any) {
            props.dispatch({
                type: ERROR,
                error: true
            });
        }
    }, []);

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
        getMarketData
    };
};

export default WalletAction;
