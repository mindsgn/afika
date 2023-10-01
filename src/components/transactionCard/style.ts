import { StyleSheet } from 'react-native';

export const style = StyleSheet.create({
  default: {
    width: '100%',
    height: 100,
    flex: 1,
    marginBottom: 2,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    alignContent: 'space-between',
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 50,
    marginRight: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    display: 'flex',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignContent: 'center',
  },
  textDetails: {
    color: 'white',
  },
  amount: {
    fontSize: 20,
    color: 'white',
    fontFamily: 'SF-Pro-Rounded-Heavy',
  },
  date: {
    marginTop: -10,
    fontSize: 12,
    color: 'gray',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  type: {
    fontSize: 20,
    color: 'white',
    fontFamily: 'SF-Pro-Rounded-SemiBold',
  },
});
