import { GET_AUTH } from "../constants";

export const getAuth = () => {
    try {
        return async (dispatch: (arg0: { type?: string; payload?: boolean; }) => void) => {
            const response = true;
            dispatch({
                type: GET_AUTH,
                payload: response
            });
        }
    }catch(error){
    console.log(error)       
    }
}

export const Connect = () => {

}