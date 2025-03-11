import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Heading,
  HStack,
  Box,
  Text,
  Image,
  useDisclosure
} from '@chakra-ui/react';
import { useAssets } from '../../store/assets';
import { useAuth } from '../../store/auth';
import Head from 'next/head';

interface Form {
  name: string;
  images: File[];
  category: {
    name: string;
    description: string;
    color: string;
  } | null;
  price: number;
  currency: string;
  owner: 'DEBUG';
  latitude: number | null;
  longitude: number | null;
}

interface AssetModalProp {
  isOpen: any;
  onOpen: any;
  onClose: any;
}

const categories: any[] = [
  { name: 'Office Equipment', color: '#0dec5d', description: null },
  { name: 'Cables', color: '#48ecfc', description: null },
  { name: 'Inventory', color: '#376dd8', description: null },
  { name: 'Machinery', color: '#efa578', description: null },
  { name: 'Supplies', color: '#acbf01', description: null }
];

const currencies: any[] = [
  {
    name: 'ZAR',
    symbol: 'R',
    country: 'South Africa'
  }
];

export default function AssetModal({
  isOpen,
  onOpen,
  onClose
}: AssetModalProp) {
  const [location, setLocation] = useState<any>(null);
  const [permission, setPermission] = useState<boolean>(false);
  const state = useAssets();

  //@ts-expect-error
  const { getAssets } = state;
  const [formData, setFormData] = useState<Form>({
    name: '',
    images: [],
    category: null,
    price: 0,
    currency: 'ZAR',
    owner: 'DEBUG',
    latitude: 0,
    longitude: 0
  });

  const handleSubmit = async () => {
    const formDataToSend = new FormData();
    const token = sessionStorage.getItem('token');
    try {
      const { name, category, price, currency, owner } = formData;

      formDataToSend.append(
        'data',
        JSON.stringify({
          name,
          category,
          value: price,
          currency,
          owner
        })
      );

      // Note: File handling needs to be adjusted for web environment
      if (formData.images.length > 0) {
        formDataToSend.append('images', formData.images[0]);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/asset/add`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formDataToSend
        }
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      await response.json();
      await getAssets();
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({ ...formData, images: Array.from(e.target.files) });
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          console.log(position);
          setPermission(true)
          setFormData(prevData => ({
            ...prevData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
        },
        error => {
          setFormData(prevData => ({
            ...prevData,
            latitude: 0,
            longitude: 0
          }));
          // eslint-disable-next-line no-console
          console.error("Error getting location:", error);
        }
      );
    } else {
      // eslint-disable-next-line no-console
      console.error("Geolocation is not supported by this browser.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      getLocation();
    }
  }, [isOpen]);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Asset</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {permission ? null :
              <Box 
                background={'blue.100'}
                padding={4}
                onClick={() => getLocation()}
                cursor={'pointer'}
              >
                <Heading size={"sm"} color='blue.500' fontFamily={'bold'}>Location not enabled</Heading>
                <Text color='blue.700' fontFamily={'bold'}>To be able to track the location of the asset please enable location</Text>
              </Box>
            }

            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter asset title"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Image</FormLabel>
                <Input
                  type="file"
                  onChange={handleImageChange}
                  accept="image/*"
                />
                {formData.images.length > 0 && (
                  <Image
                    src={URL.createObjectURL(formData.images[0])}
                    alt="Selected asset"
                    mt={2}
                  />
                )}
              </FormControl>

              <FormControl>
                <FormLabel>Category</FormLabel>
                <Select
                  placeholder="Select Category"
                  onChange={e => {
                    const selectedCategory = categories.find(
                      cat => cat.name === e.target.value
                    );
                    setFormData({
                      ...formData,
                      category: selectedCategory || null
                    });
                  }}
                >
                  {categories.map(category => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Price</FormLabel>
                <HStack>
                  <Select
                    value={formData.currency}
                    onChange={e =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    width="50%"
                  >
                    {currencies.map(currency => (
                      <option key={currency.name} value={currency.name}>
                        {currency.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={formData.price}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0
                      })
                    }
                    type="number"
                    width="50%"
                  />
                </HStack>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleSubmit}>
              Add
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
