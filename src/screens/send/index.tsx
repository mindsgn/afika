import React from 'react';
import { sendUsing } from '../../constants';
import { TouchableOpacity, View, Text, TextInput } from 'react-native';
import { Heading, Button } from '../../components';
import { style } from './style';

const Send = (props: any) => {
  const { navigation } = props;
  return (
    <View style={style.default}>
      <Heading
        title="Send"
        exit={() => {
          navigation.navigate('Home');
        }}
      />
      <View style={style.sendContainer}>
        <View style={style.sendUsingInput}>
          <TextInput placeholder="Token" style={style.amountInput} />
          <TextInput placeholder="R100" style={style.amountInput} />
        </View>

        <View style={style.sendUsing}>
          {sendUsing.map((item) => {
            return (
              <View key={item.title} style={style.sendUsingCard}>
                <Text>{item.title}</Text>
              </View>
            );
          })}
        </View>
        <View style={style.sendUsing}>
          <TextInput placeholder="R100" style={style.amountInput} />
        </View>
        <Button title={'SEND'} onPress={() => {}} />
      </View>
    </View>
  );
};

export { Send };
