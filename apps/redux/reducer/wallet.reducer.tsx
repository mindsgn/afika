import { stat } from 'fs';
import { CONNECT, DISCONNECT, ERROR, GET_COINGECKO, GET_STATE } from '../../constants';
import { walletState } from '../../interface';

const initialState: walletState = {
    connected: false,
    ed25519PrivKey: null,
    privKey: null,
    sessionId:  null,
    user: null,
    error: false,
    auth: null,
    markets: []
};

export default (state = initialState, action: any) => {
    switch (action.type) {
        case CONNECT:
            return {
                ...state,
                connected: action.connected,
                ed25519PrivKey: action.ed25519PrivKey,
                privKey: action.privKey,
                sessionId:  action.sessionId,
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
                ...state
        };
        case GET_COINGECKO:
            return {
                ...state,
                markets: action.markets                
            };
        case ERROR:
            return {
                ...state,
               action
            };
        default:
            return state;
    }
};
