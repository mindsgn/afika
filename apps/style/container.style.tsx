import { StyleSheet } from 'react-native';

export const container = StyleSheet.create({
    default: {
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black'
    },
    onboarding: {
        display: 'flex',
        flex: 1,
        backgroundColor: 'black',
        alignItems: 'center'
    },
    welcome: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black'
    },
    import: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
        backgroundColor: 'black'
    },
    create: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black'
    },
    home: {
        width: '100%',
        height: '100%',
        backgroundColor: 'white'
    }
});
