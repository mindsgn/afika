import { StyleSheet } from 'react-native';

import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    flex: 1,
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  text: {
    color: colors.gray,
  },
});
