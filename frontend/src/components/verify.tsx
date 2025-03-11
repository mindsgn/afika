'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
  Text
} from '@chakra-ui/react';
import { AuthInterfce, useAuth } from 'store/auth';
import { Button } from './button';

const Verify: React.FC = () => {
  const state = useAuth();
  const { verify, user } = state as AuthInterfce;
  const { email } = user;
  const [code, setCode] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    //@ts-expect-error
    verify(email, code);
  };

  return (
    <Container maxW="lg" py={12} background={'white'} borderRadius={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h1" textAlign="center" fontFamily={'heavy'}>
          VERIFY
        </Heading>
        <Box as="form" onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                id="text"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Enter your verification code"
              />
            </FormControl>

            <Button
              title={'VERIFY'}
              background="black"
              width="full"
              onClick={handleSubmit}
              color="white"
            />
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default Verify;
