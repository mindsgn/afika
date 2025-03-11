'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Heading, 
  Text, 
  VStack,
  UnorderedList,
  ListItem,
  Divider 
} from '@chakra-ui/react';

export default function PrivacyPolicy() {
  return (
    <Box
      bg="black"
      minH="100vh"
      py={10}
      color="white"
    >
      <Container maxW="container.md">
        <VStack spacing={6} align="stretch">
          <Heading as="h1" size="xl">
            Privacy Policy for MEME MONEY
          </Heading>
          
          <Text color="gray.400">
            Last Updated: {new Date().toLocaleDateString()}
          </Text>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Introduction
            </Heading>
            <Text>
              Welcome to MEME MONEY, your personal legal assistant app. We take your privacy seriously and are committed to protecting your personal information.
            </Text>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Information We Collect
            </Heading>
            
            <Heading as="h3" size="md" mb={2}>
              1. User-Provided Information
            </Heading>
            <UnorderedList mb={4} spacing={2}>
              <ListItem>Legal documents and contracts you upload</ListItem>
              <ListItem>Messages and queries you send through the app</ListItem>
              <ListItem>Account information (if applicable)</ListItem>
            </UnorderedList>

            <Heading as="h3" size="md" mb={2}>
              2. Automatically Collected Information
            </Heading>
            <UnorderedList mb={4} spacing={2}>
              <ListItem>Device information</ListItem>
              <ListItem>App usage statistics</ListItem>
              <ListItem>Error logs</ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Data Storage and Security
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>All documents are encrypted</ListItem>
              <ListItem>We use secure cloud storage services</ListItem>
              <ListItem>Access to your data is strictly controlled</ListItem>
              <ListItem>Documents are processed locally where possible</ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Your Rights
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>Access your personal data</ListItem>
              <ListItem>Delete your data</ListItem>
              <ListItem>Export your data</ListItem>
              <ListItem>Opt out of data collection</ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Contact Us
            </Heading>
            <Text>
              If you have any questions about this Privacy Policy, please contact us at:{' '}
              <Text as="span" color="blue.400">
                meme@mindsgn.studio
              </Text>
            </Text>
          </Box>

          <Box pt={4}>
            <Text color="gray.400" fontSize="sm">
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}