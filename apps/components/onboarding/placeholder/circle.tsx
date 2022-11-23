import React from 'react';
import { View } from 'react-native';

export const Circle = (
    {
        fill
    }
    :
    {
        fill: boolean
    }
) => {
    return (
        <View
            style={{
                width: 50,
                height: 50,
                margin: 4,
                backgroundColor: `${fill? 'white' : 'black'}`,
                borderRadius:50,
                borderColor: 'white',
                borderWidth: 4,
            }}/>
    );
};
