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
    <Box bg="black" minH="100vh" py={10} color="white">
      <Container maxW="container.md">
        <VStack spacing={6} align="stretch">
          <Heading as="h1" size="xl">
            Privacy Policy for POCKET MONEY
          </Heading>

          <Text color="gray.400">
            Last Updated: {new Date().toLocaleDateString()}
          </Text>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Introduction
            </Heading>
            <Text>
              Welcome to POCKET MONEY, an open-source Polygon wallet tracker. We
              value privacy and transparency. This privacy policy outlines what
              data we (don’t) collect and how we handle any information your
              wallet interactions may reveal.
            </Text>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Information We Collect
            </Heading>

            <Heading as="h3" size="md" mb={2}>
              1. Public Blockchain Data
            </Heading>
            <UnorderedList mb={4} spacing={2}>
              <ListItem>
                We display publicly available wallet data from the Polygon
                blockchain.
              </ListItem>
              <ListItem>
                No private keys, seed phrases, or personal identifiers are
                collected or stored.
              </ListItem>
            </UnorderedList>

            <Heading as="h3" size="md" mb={2}>
              2. Minimal Technical Data (Optional / Anonymous)
            </Heading>
            <UnorderedList mb={4} spacing={2}>
              <ListItem>
                We may log basic, anonymized app usage stats to improve
                performance (e.g., page views, error logs).
              </ListItem>
              <ListItem>
                No tracking cookies or behavioral analytics are used unless
                explicitly opted into.
              </ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Data Storage and Security
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>
                We do not store any personal or sensitive data.
              </ListItem>
              <ListItem>
                All interactions are read-only and based on public data from the
                blockchain.
              </ListItem>
              <ListItem>
                Any analytics, if enabled, are aggregated and anonymized.
              </ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Your Rights
            </Heading>
            <UnorderedList spacing={2}>
              <ListItem>
                You retain full control over your wallet and data.
              </ListItem>
              <ListItem>
                {
                  "Since we don't collect personal data, there&apos;s nothing to delete or export"
                }
              </ListItem>
              <ListItem>
                {
                  'You can audit the code or deploy your own instance (this is open-source!)'
                }
              </ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Contact Us
            </Heading>
            <Text>
              If you have any questions or suggestions about this Privacy
              Policy, feel free to reach out at:{' '}
              <Text as="span" color="blue.400">
                pocket.money@mindsgn.studio
              </Text>
            </Text>
          </Box>

          <Box pt={4}>
            <Text color="gray.400" fontSize="sm">
              This is an open-source project. We may update this privacy policy
              if features change. Check back here or on our GitHub repository
              for the latest version.
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
