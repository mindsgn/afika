import React from 'react';
import { View, Text, Image } from 'react-native';
import { DefaultButton as Button } from '../../../components/onboarding/button/defaultButton/default.button';
import WalletAction from '../../../redux/actions/wallet.action';

import { connect } from 'react-redux';
import { colors } from '../../../constants';

const Settings = (props: any) => {
    const { connected, navigation, auth, user} = props;
    const { disconnectWallet } = WalletAction(props);

    React.useEffect(() => {
        if (!connected) navigation.navigate('Onboarding');
    }, [connected]);

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: 'white'
            }}>
                <View
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: 'flex-end',
                    }}>
                    <View>
                        <Image 
                            style={{
                                maxWidth: 100,
                                maxHeight: 100,
                                minWidth: 90,
                                minHeight: 90,
                                borderRadius: 50,
                                margin: 10
                            }}
                            source={{ uri: user.profileImage}}/>
                    </View>
                </View>
                <View>
                    <View
                        style={{
                            padding: 10
                        }}>
                        <Text
                            style={{
                                fontFamily: 'SF-Pro-Rounded-Bold',
                                fontSize: 21
                            }}>Name: {user.name}</Text>
                        <Text
                            style={{
                                fontFamily: 'SF-Pro-Rounded-Bold',
                                fontSize: 21
                            }}>email: {user.email}</Text>
                    </View>
                </View>
                <View
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: 'flex-end',
                    }}>
                    <Button
                        onPress={() =>  disconnectWallet(auth)}
                        text="DISCONNECT"
                        color={colors.red}
                        fontColor={"white"} />
                </View>
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return { 
        connected: state.connected,
        auth: state.auth,
        user: state.user
     };
};

export default connect(mapStateToProps)(Settings);
