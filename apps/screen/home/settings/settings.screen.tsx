import React from 'react';
import { View, Text } from 'react-native';
import { container } from '../../../style/container.style';
import Card from '../../../components/card';
import { DefaultButton as Button } from '../../../components/button/defaultButton/default.button';
import WalletAction from '../../../redux/actions/wallet.action';
import { connect } from 'react-redux';
import { colors } from '../../../constants';

const Settings = (props: any) => {
    const { connected, navigation } = props;
    const { disconnectWallet } = WalletAction(props);

    React.useEffect(() => {
        if (!connected) navigation.navigate('Onboarding');
    }, [props.connected]);

    return (
        <View>
            <Button 
                color={colors.red}
                fontColor={colors.white}
                text='DISCONNECT WALLET'
                justify='center'
                minHeight={40}
                onPress={() => disconnectWallet()}
            />
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return { connected: state.connected };
};

export default connect(mapStateToProps)(Settings);
