import React from 'react';
import renderer from 'react-test-renderer';
import Wallet from './wallet.screen';

test('renders correctly', () => {
  const tree = renderer.create(<Wallet />).toJSON();
  expect(tree).toMatchSnapshot();
});