import React from 'react';
import { View } from 'react-native';
import { connect } from 'react-redux';

const Create = (props: any) => {
    return (
        <View>
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return {
        connected: state.connected,
        error: state.error
    };
};

export default connect(mapStateToProps)(Create);
