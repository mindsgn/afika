import React from 'react';
import { Providers } from './providers';
import '../src/global.module.css';
import type { Metadata } from 'next';
import { keywords } from '@/constants/keywords';
import { APIProvider } from '@vis.gl/react-google-maps';

export const metadata: Metadata = {
  title: 'POCKET MONEY',
  applicationName: 'POCKET MONEY',
  authors: [
    {
      name: 'sibongiseni',
      url: 'https://sibongiseni.xyz'
    },
    {
      name: 'Mindsgn Studio',
      url: 'https://mindsgn.studio'
    }
  ],
  description: 'POCKET MONEY a simple wallet',
  keywords,
  twitter: {
    site: 'https://pocket.mindsgn.studio',
    title: 'POCKET MONEY'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
