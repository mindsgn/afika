'use client';

import React, { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import Login from '@/components/login';
import { useAuth, AuthInterfce } from 'store/auth';
import Verify from '@/components/verify';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const state = useAuth();
  const { auth, step } = state as AuthInterfce;

  useEffect(() => {
    if (auth) {
      router.push('/dashboard');
    }
  }, [auth, router]);

  return (
    <Box
      display={'flex'}
      padding={100}
      alignItems={'flex-start'}
      background={'black'}
      width={'100vw'}
      height={'100vh'}
    >
      {step == 0 ? <Login /> : <Verify />}
    </Box>
  );
}
