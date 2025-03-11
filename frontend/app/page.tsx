'use client';
import React, { useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { Header } from '@/components/header';
import { Main } from '@/components/main';

export default function Page() {
  return (
    <Box background={'black'} width={'100vw'} height={'100vh'}>
      <Header />
      <Main />
    </Box>
  );
}
