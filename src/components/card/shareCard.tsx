import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export const ShareCard = ({
  icon,
  link,
  title,
}: {
  icon: string;
  link: string;
  title: string;
}) => {
  return (
    <TouchableOpacity
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 10,
        margin: 10,
        borderRadius: 10,
        width: 100,
        height: 100,
        borderColor: 'white',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'space-evenly',
      }}
    >
      <Icon color="white" name={icon} size={20} />
      <Text
        style={{
          color: 'white',
          fontSize: 15,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};
