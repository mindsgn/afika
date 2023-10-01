import { StyleSheet } from 'react-native';

import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    margin: 10,
  },
  title: {
    fontFamily: 'SF-Pro-Rounded-Bold',
    fontSize: 25,
    color: colors.white,
  },
});
