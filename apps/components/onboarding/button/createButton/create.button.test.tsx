/**
 * @format
 */

import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';
import { CreateButton as Button } from './create.button';

describe('Testing onbaording button', () => {
    const wrapper: any = renderer.create(
        <Button color="#000000" text="hello" onPress={() => {}} />
    );

    // Take a look at what the wrapper has inside of it
    // console.log(wrapper.toJSON())

    // get's the styles of the wrapper
    const styles: any = wrapper.toJSON().props.style;

    // pulls the fields of interest out of the styles object
    const { backgroundColor } = styles;

    // pulls children
    const { type } = wrapper.toJSON().children[0].children[0];

    it('Should render', () => {
        expect(wrapper.toJSON()).toBeTruthy();
    });

    it('Should have black background', () => {
        expect(backgroundColor).toBe('#000000');
    });

    it('Should have Text component as child', () => {
        expect(type).toBe('Text');
    });
});
