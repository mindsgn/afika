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

export default function Support() {
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
            Support for POCKET MONEY
          </Heading>

          <Text color="gray.400">
            Last Updated: {new Date().toLocaleDateString()}
          </Text>

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Need Help?
            </Heading>
            <Text>
              POCKET MONEY is an open-source Polygon wallet tracker. While we aim to keep the experience smooth and intuitive, here's some help in case you hit a snag.
            </Text>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Frequently Asked Questions
            </Heading>

            <Heading as="h3" size="md" mb={2}>
              1. How do I use POCKET MONEY?
            </Heading>
            <Text mb={4}>
              Simply enter a Polygon wallet address to view its activity and token balances. All data is fetched directly from the blockchain — no login or signup needed.
            </Text>

            <Heading as="h3" size="md" mb={2}>
              2. Is this safe to use?
            </Heading>
            <Text mb={4}>
              Yes. POCKET MONEY is a read-only tool. We never ask for private keys, seed phrases, or connect to your wallet. It's 100% safe to browse public wallet data.
            </Text>

            <Heading as="h3" size="md" mb={2}>
              3. Can I host my own version?
            </Heading>
            <Text mb={4}>
              Absolutely! POCKET MONEY is open-source. You can clone the repository, customize the interface, or deploy it privately. Check our GitHub for setup instructions.
            </Text>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Open Source Contributions
            </Heading>
            <Text>
              We welcome feedback, ideas, and contributions! If you’d like to report an issue, request a feature, or submit a pull request, head to our GitHub repo.
            </Text>
            <UnorderedList spacing={2} mt={2}>
              <ListItem>
                View or contribute on GitHub: <Text as="span" color="blue.400">github.com/mindsgn/pocket-money</Text>
              </ListItem>
              <ListItem>
                Report bugs or suggest improvements via Issues.
              </ListItem>
              <ListItem>
                Check README for dev setup and deployment instructions.
              </ListItem>
            </UnorderedList>
          </Box>

          <Divider opacity={0.2} />

          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Contact Us
            </Heading>
            <Text>
              For direct support or collaboration inquiries, reach out to:{' '}
              <Text as="span" color="blue.400">
                pocket.money@mindsgn.studio
              </Text>
            </Text>
          </Box>

          <Box pt={4}>
            <Text color="gray.400" fontSize="sm">
              POCKET MONEY is maintained by the community. We appreciate your patience and your support!
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
