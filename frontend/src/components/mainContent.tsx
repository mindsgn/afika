'use client';

import React from 'react';
import { Box, Text, Container } from '@chakra-ui/react';

export type MainProp = {};

const cards = [{ title: 'Asset Tracking' }, { title: 'Custody Management' }];
const questions = [
  'Do you know how many assets do you have?',
  'Do you know how much your assets are worth?',
  'Do you know where your assets are?',
  'Do you know who is responsible for them?'
];

function MainContent({}: MainProp) {
  return (
    <Container
      background={'black'}
      paddingY={10}
      display={'flex'}
      flexDir={'column'}
    />
  );
}

export { MainContent };
