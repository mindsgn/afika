import { StyleSheet } from 'react-native';
import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'black',
  },
  main: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'black',
    padding: 10,
  },
  button: {
    minWidth: 200,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.green,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'SF-Pro-Rounded-Heavy',
    fontSize: 28,
    color: colors.white,
  },
});
