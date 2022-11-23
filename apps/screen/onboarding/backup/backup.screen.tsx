import React from 'react';
import { View} from 'react-native';
import { connect } from 'react-redux';
import { colors } from '../../../constants';

const Backup = (props: any) => {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor:colors.black
            }}>
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return {
        connected: state.connected,
        error: state.error
    };
};

export default connect(mapStateToProps)(Backup);
