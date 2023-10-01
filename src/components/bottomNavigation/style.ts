import { StyleSheet } from 'react-native';

import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    backgroundColor: colors.white,
    position: 'absolute',
    bottom: 40,
    marginHorizontal: 20,
    height: 60,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: {
      width: 10,
      height: 10,
    },
    paddingHorizontal: 20,
  },
});
