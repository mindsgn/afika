'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
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

const Login: React.FC = () => {
  const state = useAuth();
  const { login } = state as AuthInterfce;
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      login(email);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Container maxW="lg" py={12} background={'white'} borderRadius={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h1" textAlign="center" fontFamily={'heavy'}>
          Login
        </Heading>
        <Box as="form" onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel htmlFor="email" fontFamily={'bold'}>Email</FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </FormControl>
            <Button
              background="black"
              width="full"
              color="white"
              title={'LOGIN'}
              onClick={handleSubmit}
            />
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default Login;
