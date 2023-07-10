import React from 'react';
import { View, Animated, Text, TouchableOpacity } from 'react-native';
import { AnimationAction } from '../../redux';
import { connect } from 'react-redux';

const TokenDataCard = (props: any) => {
  const { tokenData } = props;
  const { updateTokenData } = AnimationAction(props);
  const cardY = React.useRef(new Animated.Value(700)).current;

  React.useEffect(() => {
    if (tokenData) {
      Animated.timing(cardY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(cardY, {
        toValue: 900,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [tokenData]);

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: '100%',
          backgroundColor: 'black',
          height: '100%',
          bottom: '0%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        },
        {
          transform: [
            {
              translateY: cardY,
            },
          ],
        },
      ]}
    >
      <View
        style={{
          padding: 5,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <TouchableOpacity
          onPress={() => {
            updateTokenData(false);
          }}
        >
          <Text
            style={{
              color: 'white',
            }}
          >
            X
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            color: 'white',
          }}
        >
          Token
        </Text>
      </View>
    </Animated.View>
  );
};

const mapStateToProps = (state: any) => {
  return {
    tokenData: state.animation.tokenData,
  };
};

export default connect(mapStateToProps)(TokenDataCard);
