import React from 'react';
import { View, Text, Touchable, TouchableOpacity } from 'react-native';

import { style } from './style';

const WalletButtons = ({
  goToSend,
  goToRecieve,
}: {
  goToSend: any;
  goToRecieve: any;
}) => {
  return (
    <View style={style.default}>
      <TouchableOpacity style={style.sendButton} onPress={goToSend}>
        <Text style={style.buttonText}>SEND</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={goToRecieve} style={style.recieveButton}>
        <Text style={style.buttonText}>RECEIVE</Text>
      </TouchableOpacity>
    </View>
  );
};

export { WalletButtons };
