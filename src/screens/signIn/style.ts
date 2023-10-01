import { StyleSheet } from 'react-native';
import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.black,
    padding: 10,
  },
  tagContainer: {
    padding: 15,
  },
  phoneNumberContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 80,
    borderColor: colors.white,
    borderWidth: 4,
    borderRadius: 10,
    backgroundColor: colors.black,
  },
});
