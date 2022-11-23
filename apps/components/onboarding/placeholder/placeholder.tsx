import React from 'react';
import { View } from 'react-native';
import { isNull } from 'util';
import { Circle } from './circle';

export const PlaceHolder = (
    {
        code
    }
    :
    {
        code: number[]
    }
) => {

    const isNumber = (number: number) => {
        if(isNaN(number)){
            return false;
        }
        
        return true;
    }

    React.useEffect(() => {
        console.log(code)
    });

    return (
        <View
            style={{
                width:'100%',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent:'center'
            }}>
            <Circle
                fill={isNumber(code[0])}/>
            <Circle
                fill={isNumber(code[1])}/>
            <Circle
                fill={isNumber(code[2])}/>
            <Circle
                fill={isNumber(code[3])}/>
            <Circle
                fill={isNumber(code[4])}/>
        </View>
    );
};
