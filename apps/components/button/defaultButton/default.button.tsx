import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export const DefaultButton = ({
    text,
    onPress,
    color,
    fontColor,
    flex,
    minHeight,
    disabled,
    align,
    justify,
    size
}: {
    text: string;
    onPress(): void;
    color?: string;
    fontColor?: string;
    flex?: number;
    minHeight?: number;
    disabled?: boolean;
    align?: string;
    justify?: string;
    size?: number;
}): JSX.Element => {
    React.useEffect(() => {}, []);

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={{
                backgroundColor: `${color ? color : 'white'}`,
                borderRadius: 10,
                padding: 10,
                minHeight: minHeight,
                margin: 10,
                flex: flex,
                display: 'flex',
                flexDirection: 'row'
            }}
        >
            <Text
                style={{
                    color: `${fontColor ? fontColor : 'black'}`,
                    fontFamily: 'SF-Pro-Rounded-Heavy',
                    fontSize: size ? size : 15
                }}
            >
                {text}
            </Text>
        </TouchableOpacity>
    );
};
