import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const CreateButton = ({
    color,
    text,
    onPress
}: {
    color?: string;
    text?: string;
    onPress(): void;
}) => {
    return (
        <TouchableOpacity
            style={{
            }}
            onPress={onPress}>
            <View>
                <Text
                    style={{
                        color: 'white',
                        fontSize: 46,
                        fontFamily: 'SF-Pro-Rounded-Heavy'
                    }}
                >
                    {text}
                </Text>
            </View>
        </TouchableOpacity>
    );
};
