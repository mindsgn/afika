import React from 'react';
import renderer from 'react-test-renderer';
import Load from './load.screen';

test('renders correctly', () => {
  const tree = renderer.create(<Load />).toJSON();
  expect(tree).toMatchSnapshot();
});