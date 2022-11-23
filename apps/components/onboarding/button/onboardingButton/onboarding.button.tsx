import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const OnboardingButton = ({
    color,
    text,
    onPress
}: {
    color: string;
    text: string;
    onPress(): void;
}) => {
    return (
        <TouchableOpacity
            style={{
                margin: 5,
                backgroundColor: color,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection:'column',
                width: '100%',
                height: 50,
                borderRadius: 10
            }}
            onPress={onPress}>
            <View>
                <Text
                    style={{
                        color: 'white',
                        fontSize: 21,
                        fontFamily: 'SF-Pro-Rounded-Heavy'
                    }}
                >
                    {text}
                </Text>
            </View>
        </TouchableOpacity>
    );
};
