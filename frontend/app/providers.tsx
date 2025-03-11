'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider>
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          if (typeof window !== 'undefined') {
            window.scrollTo(0, 0);
          }
        }}
      >
        {children}
      </AnimatePresence>
    </ChakraProvider>
  );
}
