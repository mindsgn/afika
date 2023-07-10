import {
  UPDATE_RECEIVE,
  UPDATE_SEND,
  UPDATE_SWITCH_NETWORK,
  UPDATE_TOKEN_DATA,
  //@ts-ignore
} from '@orbyt/constants';

export const AnimationAction = (props: any) => {
  const updateRecieving = (state: boolean) => {
    try {
      props.dispatch({
        type: UPDATE_RECEIVE,
        receive: state,
      });
    } catch (error) {
      props.dispatch({
        type: UPDATE_RECEIVE,
        receive: false,
      });
    }
  };

  const updateSending = (state: boolean) => {
    try {
      props.dispatch({
        type: UPDATE_SEND,
        send: state,
      });
    } catch (error) {
      props.dispatch({
        type: UPDATE_SEND,
        send: false,
      });
    }
  };

  const updateTokenData = (state: boolean) => {
    try {
      props.dispatch({
        type: UPDATE_TOKEN_DATA,
        tokenData: state,
      });
    } catch (error) {
      props.dispatch({
        type: UPDATE_TOKEN_DATA,
        tokenData: false,
      });
    }
  };

  const updateSwitchNetwork = (state: boolean) => {
    try {
      props.dispatch({
        type: UPDATE_SWITCH_NETWORK,
        switchNetwork: state,
      });
    } catch (error) {
      props.dispatch({
        type: UPDATE_SWITCH_NETWORK,
        switchNetwork: false,
      });
    }
  };

  return {
    updateRecieving,
    updateSending,
    updateSwitchNetwork,
    updateTokenData,
  };
};
