import React from 'react';
import { View } from 'react-native';
import { connect } from 'react-redux';
import { container } from '../../../style/container.style';
import { OnboardingButton } from '../../../components/onboarding/button/onboardingButton/onboarding.button';

const SignIn = (props: any) => {
    return (
        <View
            style={container.onboarding}>
                <OnboardingButton 
                    color={'#F15A24'}
                    onPress={() => {}}
                    text={'SIGN IN'}
                />
        </View>
    );
};

const mapStateToProps = (state: any, props: any) => {
    return {
        connected: state.connected,
        error: state.error
    };
};

export default connect(mapStateToProps)(SignIn);
