//@ts-ignore
import { COINGECKO_API_V3, WEB3AUTH_CLIENT_ID } from '@env';
import {
  CONNECT,
  DISCONNECT,
  ERROR,
  GET_COINGECKO_LIST,
  GET_CHAIN_ID,
  GET_ADDRESS,
  GET_TOKEN_LIST,
  SWITCH_NETWORK,
  INCREASE_BALANCE,
  DECREASE_BALANCE,
  SET_BALANCE,
} from '../../constants';
import * as WebBrowser from '@toruslabs/react-native-web-browser';
import { Framework } from '@superfluid-finance/sdk-core';
import Web3Auth, {
  LOGIN_PROVIDER,
  OPENLOGIN_NETWORK,
} from '@web3auth/react-native-sdk';
import { Network, Alchemy } from 'alchemy-sdk';
import '@ethersproject/shims';
//@ts-ignore
import { Buffer } from 'buffer';
import { Contract, ethers } from 'ethers';
import React from 'react';
import { tokens } from '../../constants/tokens';
import { ToastAndroid } from 'react-native';
import { AnimationAction } from './animation.action';

global.Buffer = global.Buffer || Buffer;

const scheme = 'orbyt';
const resolvedRedirectUrl = `${scheme}://openlogin`;

export const WalletAction = (props: any) => {
  const { updateSending } = AnimationAction(props);

  const connectWithWeb3Auth = async () => {
    try {
      const response = await new Web3Auth(WebBrowser, {
        clientId: `${WEB3AUTH_CLIENT_ID}`,
        network: `${OPENLOGIN_NETWORK.CYAN}`,
      });

      const info = await response.login({
        loginProvider: LOGIN_PROVIDER.GOOGLE,
        redirectUrl: resolvedRedirectUrl,
      });

      props.dispatch({
        type: CONNECT,
        auth: response,
        connected: true,
        ed25519PrivKey: info.ed25519PrivKey,
        privKey: info.privKey,
        sessionId: info.sessionId,
        user: info.userInfo,
      });
    } catch (error: any) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  };

  //sign in without wallet
  const testConnection = async (address: string) => {
    try {
      props.dispatch({
        type: CONNECT,
        auth: null,
        connected: true,
        ed25519PrivKey: null,
        privKey: null,
        sessionId: null,
        user: {
          address,
        },
      });
    } catch (error) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  };

  //disconnect wallet
  const disconnectWallet = async (auth: any) => {
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
        user: null,
      });
    } catch (error: any) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  };

  //remove error
  const removeError = React.useCallback(async () => {
    props.dispatch({
      type: ERROR,
      error: false,
    });
  }, []);

  //get market data
  const getMarketList = React.useCallback(async (location: string) => {
    await fetch(`${COINGECKO_API_V3}/list`, {
      method: 'GET',
    }).then((success) => {
      success.json().then((data) => {
        props.dispatch({
          type: GET_COINGECKO_LIST,
          marketTokenList: data,
        });
      });
    });
  }, []);

  const getChainId = React.useCallback(async (providerUrl: string) => {
    try {
      const ethersProvider = ethers.getDefaultProvider(providerUrl);
      const networkDetails = await ethersProvider.getNetwork();
      props.dispatch({
        type: GET_CHAIN_ID,
        networkName: networkDetails.name,
        networkID: networkDetails.chainId,
        ens: networkDetails.ensAddress,
        balance: 0,
      });
    } catch (error) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  }, []);

  const getAccount = React.useCallback(async (key: string) => {
    try {
      const wallet = new ethers.Wallet(key);
      const address = await wallet.address;
      props.dispatch({
        type: GET_ADDRESS,
        address,
      });
    } catch (error) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  }, []);

  const sendTransaction = React.useCallback(
    async (
      key: string,
      toAddress: string,
      amount: string,
      providerUrl: string
    ) => {
      try {
        const ethersProvider = ethers.getDefaultProvider(providerUrl);
        const wallet = new ethers.Wallet(key, ethersProvider);

        // const destination = '0x40e1c367Eca34250cAF1bc8330E9EddfD403fC56';

        // Convert 1 ether to wei
        const amount = ethers.utils.parseEther('0.001');

        // Submit transaction to the blockchain
        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: amount,
          maxPriorityFeePerGas: '5000000000', // Max priority fee per gas
          maxFeePerGas: '6000000000000', // Max fee per gas
        });

        return tx;
      } catch (error) {
        props.dispatch({
          type: ERROR,
          error,
        });
      }
    },
    []
  );

  const signMessage = React.useCallback(
    async (key: string, providerUrl: string) => {
      try {
        const ethersProvider = ethers.getDefaultProvider(providerUrl);
        const wallet = new ethers.Wallet(key, ethersProvider);

        const originalMessage = 'YOUR_MESSAGE';

        // Sign the message
        const signedMessage = await wallet.signMessage(originalMessage);

        return signedMessage;
      } catch (error) {
        props.dispatch({
          type: ERROR,
          error,
        });
      }
    },
    []
  );

  const getBalance = async (address: string, settings: any) => {
    try {
      const alchemy = new Alchemy(settings);
      // Get token balances
      const balances = await alchemy.core.getTokenBalances(address);
    } catch (error) {
      /// console.log(error);
    }
  };

  const updateBalance = (sum: boolean, amount: number) => {
    if (sum) {
      props.dispatch({
        type: INCREASE_BALANCE,
        amount,
      });
    } else {
      props.dispatch({
        type: DECREASE_BALANCE,
        amount,
      });
    }
  };

  const setBalance = (amount: number) => {
    props.dispatch({
      type: SET_BALANCE,
      amount,
    });
  };

  const getNativeToken = async (network: string) => {
    switch (network) {
      case 'polygon-mumbai':
        return {
          name: 'matic',
          symbol: 'polygon',
        };
      case 'polygon-mainnet':
        return {
          name: 'matic',
          symbol: 'polygon',
        };
      case 'eth-goerli':
        return {
          name: 'ethereum',
          symbol: 'eth',
        };
      case 'eth-mainnet':
        return {
          name: 'ethereum',
          symbol: 'eth',
        };
      default:
        return null;
    }
  };

  const getNativeBalance = async (settings: any, address: string) => {
    try {
      const results = await getNativeToken(settings.network);
      const alchemy = await new Alchemy(settings);
      const nativeBalance = await alchemy.core.getBalance(address, 'latest');
      const balance = ethers.utils.formatEther(nativeBalance);

      if (results) {
        const data = await getTokenData(results.name);
        const jsonData = await data?.json();

        return {
          ...jsonData,
          balance,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const searchTokensByName = (keyword: string) => {
    keyword = keyword.toLowerCase();
    let results = [];

    for (const token of tokens) {
      const name = token.name.toLowerCase();
      if (token.possibleName) {
        const possibleNames = token.possibleName.map((n) => n.toLowerCase());
        if (name.includes(keyword) || possibleNames.includes(keyword)) {
          if (token.verified) {
            results.push(token);
          }
        }
      }
    }

    return results;
  };

  const getTokenData = async (token: string) => {
    const results: null | any = await searchTokensByName(token);
    let data = null;
    if (results.length > 0) {
      const { id } = results[0];
      data = await fetch(`${COINGECKO_API_V3}/coins/${id}`, {
        method: 'GET',
      });
    }

    return data;
  };

  const sendPayment = async (
    stream: boolean,
    native: boolean,
    providerUrl: string,
    privateKey: string,
    recipientAddress: string,
    amount: string,
    contractAddress?: string,
    abi?: string
  ) => {
    try {
      const ethersProvider = ethers.getDefaultProvider(providerUrl);

      const wallet = new ethers.Wallet(privateKey, ethersProvider);
      const paymentAmount = ethers.utils.parseEther(amount);

      if (native) {
        const transaction = await wallet.sendTransaction({
          to: recipientAddress,
          value: paymentAmount,
        });

        console.log('Transaction hash:', transaction.hash);

        const confirmedTransaction = await transaction.wait();

        console.log(
          'Transaction confirmed in block:',
          confirmedTransaction.blockNumber
        );
      } else {
        const usdcContract = new ethers.Contract(contractAddress, abi, wallet);
        const paymentAmount = ethers.utils.parseUnits('100', 6);

        const transaction = await usdcContract.transfer(
          recipientAddress,
          paymentAmount
        );
        await transaction.wait();

        console.log('Transaction hash:', transaction.hash);

        updateSending(false);

        ToastAndroid.showWithGravityAndOffset(
          'Payment Sent!',
          ToastAndroid.LONG,
          ToastAndroid.BOTTOM,
          25,
          50
        );
      }
    } catch (error) {
      ToastAndroid.showWithGravityAndOffset(
        'Payment Failed!',
        ToastAndroid.LONG,
        ToastAndroid.BOTTOM,
        25,
        50
      );
    }
  };

  const getTokenList = async (
    address: string,
    settings: any,
    currency: string
  ) => {
    try {
      const array: any[] = [];
      const alchemy = await new Alchemy(settings);
      const balances = await alchemy.core.getTokenBalances(address);

      const nonZeroBalances = balances.tokenBalances.filter((token: any) => {
        return (
          token.tokenBalance !==
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        );
      });

      const data = await getNativeBalance(settings, address);
      if (data) array.push(data);

      for await (const token of nonZeroBalances) {
        let balance: any = token.tokenBalance;

        // Get metadata of token
        const metadata = await alchemy.core.getTokenMetadata(
          token.contractAddress
        );

        balance = balance / Math.pow(10, parseFloat(`${metadata.decimals}`));

        if (metadata.name) {
          const data = await getTokenData(metadata.name);

          if (data) {
            const jsonData = await data.json();

            const newObject = {
              ...jsonData,
              balance,
            };

            array.push(newObject);
          }
        }
      }

      let sum = 0;

      array.map((token) => {
        const { market_data, balance } = token;
        const { ath } = market_data;
        sum = sum + balance * ath[`${currency}`];
      });

      props.dispatch({
        type: GET_TOKEN_LIST,
        walletTokenList: array,
        totalBalance: sum,
      });
    } catch (error) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  };

  const switchToNetwork = React.useCallback((network: any) => {
    try {
      props.dispatch({
        type: SWITCH_NETWORK,
        settings: {
          apiKey: network.keys,
          network: network.network,
        },
        providerUrl: network.url,
        tokens: network.tokens,
      });
    } catch (error: any) {
      props.dispatch({
        type: ERROR,
        error,
      });
    }
  }, []);

  return {
    setBalance,
    updateBalance,
    connectWithWeb3Auth,
    disconnectWallet,
    removeError,
    testConnection,
    getChainId,
    sendTransaction,
    signMessage,
    getAccount,
    getMarketList,
    getTokenList,
    switchToNetwork,
    getBalance,
    sendPayment,
  };
};
