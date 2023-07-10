import React from 'react';
import { TextInput as Input, View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export const DropDown = ({
  flex = 1,
  title = '',
  selectedValue,
  onValueChange,
}: {
  flex?: number;
  title?: string;
  selectedValue: string;
  onValueChange: (itemValue: string) => void;
}) => {
  return (
    <View
      style={{
        borderWidth: 4,
        flex: flex,
        margin: 5,
      }}
    >
      <Text
        style={{
          color: 'white',
          fontSize: 16,
          fontFamily: 'SF-Pro-Rounded-Heavy',
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: 10,
          borderColor: 'white',
          borderWidth: 1,
          padding: 5,
        }}
      >
        <Picker selectedValue={selectedValue} onValueChange={onValueChange}>
          <Picker.Item label="Option 1" value="option1" />
          <Picker.Item label="Option 2" value="option2" />
          <Picker.Item label="Option 3" value="option3" />
        </Picker>
      </View>
    </View>
  );
};
