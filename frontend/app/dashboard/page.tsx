'use client';

import React from 'react';
import { Box } from '@chakra-ui/react';
import SideNavigation from '@/components/sideNavigation';
import dynamic from 'next/dynamic';

// Dynamically import the component that uses document
const BrowserOnlyComponent = dynamic(
  () => import('../../src/components/mainContainer'),
  {
    ssr: false
  }
);

export default function Page() {
  return (
    <Box
      height={'100vh'}
      width={'100vw'}
      display={'flex'}
      flexDir={'row'}
      paddingX={5}
      alignItems={'center'}
      justifyContent={'flex-start'}
      background="#ddd"
    >
      <SideNavigation />
      <BrowserOnlyComponent />
    </Box>
  );
}
