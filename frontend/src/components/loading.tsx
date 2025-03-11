'use client';

import React, { useEffect, useState } from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { variants } from '@/constants';

export type LoadingProp = {};

function Loading({}: LoadingProp) {
  const [animate] = useState('open');

  return (
    <Box
      as={motion.div}
      animate={animate}
      variants={variants.loading}
      display={'flex'}
      flexDirection={'column'}
      alignItems={'center'}
      justifyContent={'center'}
      top="0%"
      left="0%"
      position={'fixed'}
      background={'black'}
      width={'100vw'}
      height={'100vh'}
      zIndex={100}
    >
      <Heading fontFamily={'heavy'} fontSize={40} color="white">
        {'MEME MONEY'}
      </Heading>
    </Box>
  );
}

export { Loading };
