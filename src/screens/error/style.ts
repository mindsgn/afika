import { StyleSheet } from 'react-native';
import { colors } from '../../constants';

export const style = StyleSheet.create({
  default: {
    flex: 1,
    display: 'flex',
    backgroundColor: 'black',
  },
  tokenCard: {
    flex: 1,
    width: '95%',
    height: 100,
    backgroundColor: 'white',
    margin: 5,
    padding: 5,
    borderRadius: 10,
    flexDirection: 'row',
    display: 'flex',
    alignItems: 'center',
  },
  cardImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  cardName: {
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: 'black',
  },
  cardDetails: {
    flexDirection: 'row',
    display: 'flex',
  },
  tokenPriceNegative: {
    color: colors.red,
    fontFamily: 'SF-Pro-Rounded-Heavy',
    fontSize: 21,
    marginTop: -10,
  },
  tokenPricePositive: {
    color: colors.green,
    fontFamily: 'SF-Pro-Rounded-Heavy',
    fontSize: 21,
    marginTop: -10,
  },
});
