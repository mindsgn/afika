'use client';

import React from 'react';
import { Box, Heading } from '@chakra-ui/react';

export type ButtonProps = {
  onClick: (any?: any) => void;
  title: string;
  background: string;
  color: string;
  width?: string | number;
  height?: string | number;
};

function Button({
  onClick,
  title,
  background,
  color,
  width = 200,
  height = 50
}: ButtonProps) {
  return (
    <Box
      display={'flex'}
      background={background}
      padding={4}
      borderRadius={10}
      cursor="pointer"
      onClick={onClick}
      alignItems={'center'}
      justifyContent={'center'}
      width={width}
      height={height}
    >
      <Heading
        textAlign={'center'}
        fontFamily="heavy"
        fontSize={20}
        color={color}
        cursor={'pointer'}
      >
        {title}
      </Heading>
    </Box>
  );
}

export { Button };
