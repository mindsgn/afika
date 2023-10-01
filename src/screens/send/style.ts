import { StyleSheet } from 'react-native';

export const style = StyleSheet.create({
  default: {
    display: 'flex',
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    backgroundColor: 'black',
  },
  sendContainer: {
    display: 'flex',
    width: '100%',
    height: '100%',
    padding: 10,
    flex: 1,
  },
  sendUsing: {
    display: 'flex',
    flexDirection: 'row',
    borderRadius: 10,
  },
  sendUsingInput: {
    borderRadius: 10,
    borderWidth: 4,
  },
  sendUsingCard: {
    width: 100,
    height: 100,
    margin: 10,
    backgroundColor: 'white',
  },
  amountInput: {
    color: 'white',
    width: '100%',
  },
});
