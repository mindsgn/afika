'use client';

import React from 'react';
import { Box, Heading, Text, Container } from '@chakra-ui/react';
import { PlatformButton } from './platformButton';

export type HeroProp = {};

function Hero({}: HeroProp) {
  return (
    <Box
      display={'flex'}
      flexDir={['column', 'column', 'column', 'column']}
      padding={5}
      paddingTop={100}
      height="90vh"
      flex={1}
      position={'relative'}
    >
      {
        /* 
          <Heading
            marginY={2}
            color="white"
            fontFamily="heavy"
            cursor={'pointer'}
            textAlign={'center'}
            fontSize={[20, 40, 60, 60]}
            marginBottom={20} >
            {`Your Everything App For Tracking And Managing Your Assets`.toUpperCase()}
          </Heading>
          <Text
            display={['none', 'none', 'none', 'none']}
            marginY={4}
            fontFamily="heavy"
            cursor="pointer"
            color="gray" >
            {
              'MEME MONEY is a modern, asset management software that lets you create, manage, assign and overview your assets and equipment. From small office equipment to construction cranes.'
            }
          </Text>
        */
      }
      <Box
        display={'flex'}
        flexDir={['column', 'column', 'row', 'row']}
        justifyContent={'center'}
        width="100%"
        alignItems={'center'}
      >
        <PlatformButton image={'/ios.png'} />
        <PlatformButton image={'/google.png'} />
      </Box>
    </Box>
  );
}

export { Hero };
