'use client';

import React from 'react';
import { Box, Text } from '@chakra-ui/react';

export type FooterProp = {};

function Footer({}: FooterProp) {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      display={'flex'}
      flexDir={'row'}
      background={'black'}
      alignItems={'center'}
      justifyContent={'space-evenly'}
      padding={4}
    >
      <Text
        marginY={4}
        fontFamily="heavy"
        cursor="pointer"
        color="white"
        fontSize={21}
      >
        &copy; {currentYear} MEME MONEY
      </Text>
      <Box flexDir={'row'} display={['none', 'none', 'none', 'flex']}>
        <Text
          marginY={4}
          fontFamily="heavy"
          cursor="pointer"
          color="white"
          marginX={4}
          fontSize={21}
        >
          TERMS
        </Text>
        <Text
          marginY={4}
          fontFamily="heavy"
          cursor="pointer"
          color="white"
          marginX={4}
          fontSize={21}
        >
          PRIVACY
        </Text>
      </Box>
    </Box>
  );
}

export { Footer };
