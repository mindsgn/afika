'use client';

import React from 'react';
import {
  Box,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Text
} from '@chakra-ui/react';
import { Button } from './button';
import QRCode from 'react-qr-code';
import { useAssets } from 'store/assets';
import {APIProvider, Map} from '@vis.gl/react-google-maps';

export type AssetDetailsProps = {
  isOpen?: boolean;
  setAssetModal: (isOpen: boolean) => void;
  id: string;
  name: string;
  image: string;
  description: string;
  value: string;
  currency: string;
};

function AssetDetails({
  isOpen,
  setAssetModal,
  id,
  name = 'Chair',
  description,
  image,
  value,
  currency
}: AssetDetailsProps) {
  const state = useAssets();
  //@ts-expect-error
  const { removeAsset, getAssets } = state;

  return (
    <Box
      display={isOpen ? 'flex' : 'none'}
      flexDir={'row'}
      position={'fixed'}
      width={'100vw'}
      height={'100vh'}
      flexDirection={'row'}
      justifyContent={'flex-end'}
      top={'0%'}
      left={'0%'}
    >
      <Box
        width={[0, 0, '100vw', '100vw']}
        background={'rgba(0,0,0, 0.2)'}
        height={'100vh'}
        onClick={() => setAssetModal(false)}
      />
      <Box
        display={'flex'}
        width={['100vw', '100vw', '500px', '500px']}
        height={'100vh'}
        background="white"
        padding={4}
        flexDirection={'column'}
      >
        <Heading fontFamily={'heavy'}>{`${name}`.toLocaleUpperCase()}</Heading>
        <Box
          height={250}
          width={'100%'}
          background={`url('${process.env.NEXT_PUBLIC_API_URL}/uploads/${image}')`}
          borderRadius={10}
          backgroundPosition={'center'}
          backgroundSize={'cover'}
          padding={10}
          marginRight={4}
          marginY={5}
        />
        <Box>
          <Accordion>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    <Heading fontFamily={'bold'} fontSize={21}>
                      {'DETAILS'}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Box>
                  <Text>{value}</Text>
                  <Text>{description}</Text>
                  <Text>{currency}</Text>
                  <Text>{currency}</Text>
                </Box>
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    <Heading fontFamily={'bold'} fontSize={21}>
                      {'LOCATION'}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <APIProvider apiKey={`${process.env.NEXT_PUBLIC_GOOGLE_MAPS}`}>
                  <Map
                  style={{ width: '100%', height: '200px' }}
                  defaultCenter={{lat: 22.54992, lng: 0}}
                  defaultZoom={3}
                  gestureHandling={'greedy'}
                  disableDefaultUI={true}
                />
              </APIProvider>
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    <Heading fontFamily={'bold'} fontSize={21}>
                      {'QR CODE '}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <QRCode
                  size={256}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  value={`${process.env.NEXT_PUBLIC_API_URL}/update/${id}`}
                  viewBox={`0 0 256 256`}
                />
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>
        <Button
          color="white"
          background="red"
          onClick={() => {
            removeAsset(id);
            setAssetModal(false);
            getAssets();
          }}
          title="Remove Asset"
        />
      </Box>
    </Box>
  );
}

export { AssetDetails };
