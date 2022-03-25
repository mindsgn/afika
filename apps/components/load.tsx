import React from 'react';
import { Text, View, } from 'react-native';
import { container } from '../style/container';
import { text } from '../style/text';
import { RootStateOrAny, useSelector, useDispatch } from 'react-redux';
import { getAuth } from '../redux/actions';

const Load = ({ navigation } : { navigation: any }) => {
  const { auth } = useSelector((state: RootStateOrAny) => state.authReducer ); 
  const dispatch = useDispatch();
  const getAuthState = () => dispatch(getAuth());
  
  React.useEffect(() => {
    console.log(auth);
    getAuthState();
  },[auth]);

  return (
    <View
        style={container.default}>
        <Text
            style={text.logo}>
            ORBYT
        </Text>
    </View>
  );
};

export default Load;
