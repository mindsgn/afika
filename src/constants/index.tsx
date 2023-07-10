import {
  ALCHEMY_SDK_POLYGON,
  ALCHEMY_SDK_MUMBAI,
  ALCHEMY_SDK_GOERLI,
  ALCHEMY_SDK_MAINNET,
} from '@env';

import { Network } from 'alchemy-sdk';
import React from 'react';
import { ETHLogo, MaticLogo } from '../assets';

export const GET_AUTH = 'GET_AUTH';
export const CONNECT = 'CONNECT';
export const DISCONNECT = 'DISCCONNECT';
export const GET_CONNECTION = 'GET_CONNECTION';
export const GET_COINGECKO_LIST = 'GET_COINGECKO_LIST';
export const ERROR = 'ERROR';
export const GET_STATE = 'GET_STATE';
export const UPDATE_LOADING = 'UPDATE_LOADING';
export const UPDATE_RECEIVE = 'UPDATE_RECEIVE';
export const UPDATE_SEND = 'UPDATE_SEND';
export const UPDATE_SWITCH_NETWORK = 'UPDATE_SWITCH_NETWORK';
export const GET_CHAIN_ID = 'GET_CHAIN_ID';
export const GET_ADDRESS = 'GET_ADDRESS';
export const GET_TOKEN_LIST = 'GET_TOKEN_LIST';
export const SWITCH_NETWORK = 'SWITCH_NETWORK';
export const INCREASE_BALANCE = 'INCREASE_BALANCE';
export const DECREASE_BALANCE = 'DECREASE_BALANCE';
export const SET_BALANCE = 'SET_BALANCE';
export const UPDATE_TOKEN_DATA = 'UPDATE_TOKEN_DATA';

export const colors = {
  orange: '#F15A24',
  black: '#000000',
  red: '#FF2600',
  white: '#FFFFFF',
  green: '#39B54A',
  gray: '#4C4C4C',
};

export const network = [
  {
    name: 'Mainnet',
    icon: <ETHLogo width={30} height={30} />,
    keys: ALCHEMY_SDK_MAINNET,
    url: 'https://api.securerpc.com/v1',
    network: Network.ETH_MAINNET,
    tokens: [{}],
  },
  {
    name: 'Goerli',
    icon: <ETHLogo width={30} height={30} />,
    keys: ALCHEMY_SDK_GOERLI,
    url: 'https://rpc.ankr.com/eth_goerli',
    network: Network.ETH_GOERLI,
    tokens: [{}],
  },
  {
    name: 'Mumbai',
    icon: <MaticLogo width={30} height={30} />,
    keys: ALCHEMY_SDK_MUMBAI,
    url: 'https://rpc.ankr.com/polygon_mumbai',
    network: Network.MATIC_MUMBAI,
    tokens: [{}],
  },
  {
    name: 'Polygon',
    icon: <MaticLogo width={30} height={30} />,
    keys: ALCHEMY_SDK_POLYGON,
    url: 'https://rpc.ankr.com/polygon',
    network: Network.MATIC_MAINNET,
    tokens: [{}],
  },
];
