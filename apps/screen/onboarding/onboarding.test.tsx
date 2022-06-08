import React from 'react';
import renderer from 'react-test-renderer';
import Onboarding from './onboarding.screen';

test('renders correctly', () => {
  const tree = renderer.create(<Onboarding />).toJSON();
  expect(tree).toMatchSnapshot();
});