import { AnimationAction } from '@orbyt/redux';
import React from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { connect } from 'react-redux';
import updateSwitchNetwork from '@orbyt/redux'

const SwitchNetworkCard = (prop: any) => {
  const {switch} = prop;
  const cardOpacity = React.useRef(new Animated.Value(700)).current;

  React.useEffect(() => {
    if (switch) {
      
    } else {
      
    }
  }, [switch]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: '100%',
          backgroundColor: 'black',
          height: '80%',
          padding: 10,
          zIndex: 1,
        },
      ]}
    />
  );
};

const mapStateToProps = (state: any, props: any) => {
  return {
    switch: state.animation.switch,
  };
};

export default connect(mapStateToProps)(SwitchNetworkCard);
