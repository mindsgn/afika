import { StyleSheet } from 'react-native';

export const button = StyleSheet.create({
    default: {
        margin: 10,
        minWidth: 200,
        borderRadius: 50,
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 10
    },
    buttonPrimary: {
        margin: 10,
        minWidth: 200,
        borderRadius: 50,
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 10
    },
    buttonSecondary: {
        margin: 10,
        minWidth: 200,
        borderRadius: 50,
        backgroundColor: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        borderWidth: 2,
        borderColor: 'white'
    }
});
