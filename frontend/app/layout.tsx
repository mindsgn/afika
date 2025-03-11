import React from 'react';
import { Providers } from './providers';
import '../src/global.module.css';
import type { Metadata } from 'next';
import { keywords } from '@/constants/keywords';
import {APIProvider} from '@vis.gl/react-google-maps';

export const metadata: Metadata = {
  title: 'MEME MONEY',
  applicationName: 'MEME MONEY',
  authors: [
    {
      name: 'sibongiseni',
      url: 'https://sibongiseni.eth'
    },
    {
      name: 'Mindsgn Studio',
      url: 'https://mindsgn.studio'
    }
  ],
  description:
    'MEME MONEY is a modern, open source asset management software that lets you create, manage, assign and overview your assets and equipment. From small office equipment to construction cranes.',
  keywords,
  twitter: {
    site: 'https://meme.mindsgn.studio',
    title: 'MEME MONEY'
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
