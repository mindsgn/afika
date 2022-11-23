import React from 'react';
import { View, Text, } from 'react-native';
import { container } from '../../../style/container.style';
import Card from '../../../components/card';
import { connect } from 'react-redux';
import { colors } from '../../../constants';
import RPC from './../../../lib/rpc';
import WalletAction from '../../../redux/actions/wallet.action';

const Wallet = (props: any) => {
    const { privKey } = props;

    const getChainId = async () => {
        const networkDetails = await RPC.getChainId();
        console.log(networkDetails)
    };
      
    const sendTransaction = async () => {
        const tx = await RPC.sendTransaction(privKey);
        console.log(tx)
    };
      
    const signMessage = async () => {
        const message = await RPC.signMessage(privKey);
        console.log(message)
    };

    React.useEffect( () => {
        if(privKey){
        //    getAccounts()
        }
    }, [privKey])

    return (
        <View 
            style={container.home}>
            <Card />
            <View
                style={{
                    margin: 10
                }}
            >
                <Text
                    style={{
                        fontFamily: 'SF-Pro-Rounded-Bold',
                        fontSize: 25,
                        color: colors.orange
                    }}
                >
                    TOKENS
                </Text>
            </View>
            <View
                style={{
                    flex: 1,
                    margin: 10,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Text
                    style={{
                        fontFamily: 'SF-Pro-Rounded-Bold',
                        position: 'absolute'
                    }}
                >
                    NO TOKENS
                </Text>
            </View>
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return {
        connected: state.connected,
        privKey: state.privKey,
        error: state.error
    };
};

export default connect(mapStateToProps)(Wallet);