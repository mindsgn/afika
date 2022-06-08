import React from 'react';
import { View, Text } from 'react-native';
import { connect } from 'react-redux';
import truncateAddress from './../hooks/truncateAddress';

const Card = (props: any) => {
    const { address } = props;
    return (
        <View
            style={{
                minHeight: 200,
                display: 'flex',
                backgroundColor: 'black',
                borderRadius: 10,
                margin: 10,
                padding: 20
            }}
        >
            <View>
                <Text
                    style={{
                        fontFamily: 'SF-Pro-Rounded-Bold',
                        color: 'white',
                        fontSize: 20
                    }}
                >
                    {truncateAddress(address)}
                </Text>
            </View>
            <View>
                <Text
                    style={{
                        fontFamily: 'SF-Pro-Rounded-Heavy',
                        color: 'white',
                        fontSize: 45
                    }}
                >
                    R {0?.toFixed(2)}
                </Text>
            </View>
            <View
                style={{
                    position: 'absolute',
                    right: '2%',
                    bottom: '4%',
                    borderRadius: 100,
                    minWidth: 50,
                    minHeight: 50,
                    maxWidth: 50,
                    maxHeight: 50,
                    backgroundColor: 'white'
                }}
            ></View>
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return { address: state.address };
};

export default connect(mapStateToProps)(Card);
