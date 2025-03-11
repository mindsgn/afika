'use client';

import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';

export type HeaderProps = {};

function Header({}: HeaderProps) {
  const router = useRouter();
  return (
    <Box
      display="flex"
      position="fixed"
      alignItems="center"
      justifyContent="space-between"
      background="linear-gradient(to bottom, black, rgba(0, 0, 0, 0.1))"
      width="100vw"
      padding={2}
      zIndex={100}
    >
      <Box display="flex" flexDirection={'row'} alignItems={'center'}>
        <Box
          width={10}
          height={10}
          marginX={2}
          backgroundImage="/icon-512.png"
          backgroundSize="contain"
          backgroundRepeat="no-repeat"
        />
        <Heading
          fontFamily="heavy"
          fontSize={20}
          color="white"
          cursor={'pointer'}
        >
          MEME MONEY
        </Heading>
      </Box>

      <Box
        background="white"
        padding={4}
        borderRadius={10}
        cursor="pointer"
        onClick={() => {
          router.push('/login');
        }}
      >
        <Heading
          fontFamily="heavy"
          fontSize={20}
          color="black"
          cursor={'pointer'}
        >
          GET STARTED
        </Heading>
      </Box>
    </Box>
  );
}

export { Header };
