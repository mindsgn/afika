'use client';

import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { Hero } from './hero';
import { Footer } from './footer';

export type MainProp = {};

function Main({}: MainProp) {
  return (
    <Box>
      <Hero />
      <Footer />
    </Box>
  );
}

export { Main };
