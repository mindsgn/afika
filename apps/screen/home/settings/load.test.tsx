import React from 'react';
import renderer from 'react-test-renderer';
import Settings from './settings.screen';

test('renders correctly', () => {
  const tree = renderer.create(<Settings />).toJSON();
  expect(tree).toMatchSnapshot();
});