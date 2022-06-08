import React from 'react';
import { View, Text } from 'react-native';
import { container } from '../../../style/container.style';
import Card from '../../../components/card';
import { connect } from 'react-redux';
import { colors } from '../../../constants';

const Wallet = () => {
    return (
        <View style={container.home}>
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

export default Wallet;
