import { ALCHEMY_SDK_MAINNET } from '@env';
import { Network } from 'alchemy-sdk';

import {
  CONNECT,
  DISCONNECT,
  ERROR,
  GET_COINGECKO_LIST,
  GET_STATE,
  GET_CHAIN_ID,
  GET_ADDRESS,
  GET_TOKEN_LIST,
  SWITCH_NETWORK,
  INCREASE_BALANCE,
  DECREASE_BALANCE,
  SET_BALANCE,
  //@ts-ignore
} from '../../constants';
import { walletState } from '../../interface';

const initialState: walletState = {
  connected: false,
  ed25519PrivKey: null,
  privKey: null,
  sessionId: null,
  user: null,
  error: false,
  auth: null,
  markets: [],
  address: null,
  networkName: null,
  networkID: null,
  ens: null,
  tokens: [],
  providerUrl: 'https://rpc.ankr.com/eth',
  walletTokenList: [],
  marketTokenList: [],
  currency: 'zar',
  totalBalance: 0,
  currencySymbol: 'R',
  loading: true,
  settings: {
    apiKey: ALCHEMY_SDK_MAINNET,
    network: Network.ETH_MAINNET,
  },
};

export default (state = initialState, action: any) => {
  switch (action.type) {
    case CONNECT:
      return {
        ...state,
        connected: action.connected,
        ed25519PrivKey: action.ed25519PrivKey,
        privKey: action.privKey,
        sessionId: action.sessionId,
        user: action.user,
        error: action.error,
        auth: action.auth,
      };
    case DISCONNECT:
      return {
        ...state,
        connected: action.connected,
      };
    case GET_STATE:
      return {
        ...state,
      };
    case GET_CHAIN_ID:
      return {
        ...state,
        networkName: action.networkName,
        networkID: action.networkID,
      };
    case GET_ADDRESS:
      return {
        ...state,
        address: action.address,
      };
    case GET_TOKEN_LIST:
      return {
        ...state,
        walletTokenList: action.walletTokenList,
        totalBalance: action.totalBalance,
        loading: false,
      };
    case GET_COINGECKO_LIST:
      return {
        ...state,
        marketTokenList: action.marketTokenList,
      };
    case SWITCH_NETWORK:
      return {
        ...state,
        settings: action.settings,
        providerUrl: action.providerUrl,
        loading: true,
        totalBalance: 0,
      };
    case INCREASE_BALANCE:
      return {
        ...state,
      };
    case DECREASE_BALANCE:
      return {
        ...state,
      };
    case SET_BALANCE:
      return {
        ...state,
      };
    case ERROR:
      return {
        ...state,
      };
    default:
      return state;
  }
};
