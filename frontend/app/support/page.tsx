'use client';

import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  Button,
  Icon,
  Card,
  CardBody,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { MdEmail, MdHelp, MdArticle, MdChat } from 'react-icons/md';

export default function Support() {
  const commonQuestions = [
    {
      question: "How do I upload a document?",
      answer: "To upload a document, simply tap the '+' button on the home screen and select your PDF file. We support most common document formats."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, all documents are encrypted and stored securely. We use industry-standard security measures to protect your information."
    },
    {
      question: "How long are my documents stored?",
      answer: "Documents are automatically deleted after 30 days. You can manually delete them earlier if you wish."
    },
    {
      question: "Can I export my analysis?",
      answer: "Yes, you can export your document analysis in PDF format by clicking the export button on the analysis page."
    }
  ];

  return (
    <Box
      bg="black"
      minH="100vh"
      py={10}
      color="white"
    >
      <Container maxW="container.lg">
        <VStack spacing={10} align="stretch">
          {/* Header */}
          <Box textAlign="center" mb={8}>
            <Heading as="h1" size="xl" mb={4}>
              How can we help you?
            </Heading>
            <Text color="gray.400">
              Find answers, get help, and connect with our support team
            </Text>
          </Box>

          {/* Support Options */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Card bg="whiteAlpha.100" borderRadius="lg">
              <CardBody>
                <VStack spacing={4} align="flex-start">
                  <Icon as={MdEmail} boxSize={6} color="blue.400" />
                  <Heading size="md">Email Support</Heading>
                  <Text color="gray.400">
                    Get in touch with our support team directly
                  </Text>
                  <Button colorScheme="blue" leftIcon={<MdEmail />}>
                    Contact Support
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            <Card bg="whiteAlpha.100" borderRadius="lg">
              <CardBody>
                <VStack spacing={4} align="flex-start">
                  <Icon as={MdArticle} boxSize={6} color="green.400" />
                  <Heading size="md">Documentation</Heading>
                  <Text color="gray.400">
                    Browse our detailed documentation and guides
                  </Text>
                  <Button colorScheme="green" leftIcon={<MdHelp />}>
                    View Docs
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* FAQ Section */}
          <Box mt={10}>
            <Heading as="h2" size="lg" mb={6}>
              Frequently Asked Questions
            </Heading>
            <Accordion allowMultiple>
              {commonQuestions.map((item, index) => (
                <AccordionItem 
                  key={index}
                  border="none"
                  bg="whiteAlpha.100"
                  mb={4}
                  borderRadius="lg"
                >
                  <h2>
                    <AccordionButton py={4}>
                      <Box flex="1" textAlign="left">
                        <Text fontWeight="medium">{item.question}</Text>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    <Text color="gray.400">{item.answer}</Text>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </Box>

          {/* Live Chat Section */}
          <Box textAlign="center" py={10}>
            <VStack spacing={4}>
              <Icon as={MdChat} boxSize={8} color="purple.400" />
              <Heading size="md">Need immediate assistance?</Heading>
              <Text color="gray.400">
                Our support team is available 24/7 to help you
              </Text>
              <Button
                colorScheme="purple"
                size="lg"
                leftIcon={<MdChat />}
              >
                Start Live Chat
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}