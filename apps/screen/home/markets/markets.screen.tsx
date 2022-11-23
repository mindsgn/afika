import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { connect } from 'react-redux';
import WalletAction from '../../../redux/actions/wallet.action';

const Markets = (props: any) => {
    const { markets } = props;
    const { getMarketData } = WalletAction(props);
    
    React.useEffect(() => {
        getMarketData();
    }, []);

    return (
        <View
            style={{
                flex: 1,
            }}>
            {markets ? (
                <View
                    style={{
                        backgroundColor:'white',
                        flex: 1,
                        display: 'flex',
                        flexDirection:'column',
                    }}>
                    {
                     markets.map((data: any) => {
                        return(
                            <View
                                style={{
                                    margin: 5,
                                    padding: 10,
                                    backgroundColor:'white',
                                    display: 'flex',
                                    flexDirection:'row',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    elevation: 20,
                                    shadowColor: '#000000',
                                }}>
                                <View
                                    style={{
                                        display: 'flex',
                                        flexDirection:'row',
                                        borderRadius: 20
                                    }}>
                                    <View
                                        style={{
                                            minWidth:40,
                                            minHeight:40,
                                            borderRadius: 50,
                                            marginRight: 10,
                                            backgroundColor:'black'
                                        }}>
                                    </View>
                                    <Text
                                        style={{
                                            fontFamily: 'SF-Pro-Rounded-Bold',
                                            color:'black',
                                            fontSize: 21,
                                        }}>
                                        {data.id}
                                    </Text>
                                </View>
                                <View>
                                </View>
                            </View>
                        )
                     })   
                    }
                </View>
            ) : (
                <View
                    style={{
                        backgroundColor:'white',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'SF-Pro-Rounded-Bold',
                        }}
                    >
                        LOADING
                    </Text>
                </View>
            )}
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return { markets: state.markets };
};

export default connect(mapStateToProps)(Markets);
