//@ts-ignore
import {
  UPDATE_LOADING,
  UPDATE_RECEIVE,
  UPDATE_SWITCH_NETWORK,
  UPDATE_SEND,
  UPDATE_TOKEN_DATA,
  //@ts-ignore
} from '../../constants';

const initialState: any = {
  loading: false,
  receive: false,
  send: false,
  switchNetwork: false,
  tokenData: false,
};

export default (state = initialState, action: any) => {
  switch (action.type) {
    case UPDATE_LOADING:
      return {
        ...state,
        loading: action.loading,
      };
    case UPDATE_RECEIVE:
      return {
        ...state,
        receive: action.receive,
        send: false,
        switchNetwork: false,
        tokenData: false,
      };
    case UPDATE_SEND:
      return {
        ...state,
        send: action.send,
        receiving: false,
        switchNetwork: false,
        tokenData: false,
      };
    case UPDATE_SWITCH_NETWORK:
      return {
        ...state,
        switchNetwork: action.switchNetwork,
        send: false,
        receive: false,
        tokenData: false,
      };
    case UPDATE_TOKEN_DATA:
      return {
        ...state,
        tokenData: action.tokenData,
        send: false,
        receive: false,
      };
    default:
      return state;
  }
};
