import React from 'react';
import { View, Text, FlatList, Image, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import WalletAction from '../../../redux/actions/wallet.action';

const NFTS = (props: any) => {
    const { markets } = props;
    
    React.useEffect(() => {
    //    getMarketData();
    }, []);

    return (
        <View
            style={{
                flex: 1,
            }}>
            {markets ? (
                <ScrollView
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
                                key={data.id}
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
                                    <Image
                                        source={{uri: data.image}}
                                        style={{
                                            width:50,
                                            height:50,
                                            borderRadius: 50,
                                            marginRight: 10,
                                            backgroundColor:'black'
                                        }}/>
                                    <View>
                                        <Text
                                            style={{
                                                fontFamily: 'SF-Pro-Rounded-Bold',
                                                color:'black',
                                                fontSize: 21,
                                            }}>
                                            {data.id}
                                        </Text>
                                        <Text
                                            style={{
                                                fontFamily: 'SF-Pro-Rounded-Bold',
                                                color:'black',
                                                fontSize: 21,
                                            }}>
                                            {`$ ${data.current_price}`}
                                        </Text>
                                    </View>
                                </View>
                                <View>
                                </View>
                            </View>
                        )
                     })   
                    }
                </ScrollView>
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

export default connect(mapStateToProps)(NFTS);
