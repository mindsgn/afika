import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

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
                minWidth: 150,
                backgroundColor: color,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 10,
                borderRadius: 10
            }}
            onPress={onPress}
        >
            <View>
                <Text
                    style={{
                        color: 'white',
                        fontFamily: 'SF-Pro-Rounded-Heavy'
                    }}
                >
                    {text}
                </Text>
            </View>
        </TouchableOpacity>
    );
};
