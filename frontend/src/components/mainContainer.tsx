'use client';

import React, { useEffect, useState } from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';
import { useAssets } from 'store/assets';
import { Button } from './button';
import { useDisclosure } from '@chakra-ui/react';
import AssetModal from './AddAssetModal';
import { AssetDetails } from './AssetDetails';
import { useAuth } from 'store/auth';
import { useRouter } from 'next/navigation';

export type MainContainerProp = {};

function MainContainer({}: MainContainerProp) {
  const router = useRouter();
  const [assetModal, setAssetModal] = useState<boolean>(false);
  const [current, setCurrent] = useState<any>({
    _id: '',
    name: '',
    image: ''
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const authState = useAuth();
  const state = useAssets();
  //@ts-expect-error
  const { getAssets, assets, total } = state;
  //@ts-expect-error
  const { logout, auth } = authState;


  useEffect(() => {
    if (!auth) {
      router.push('/login');
    }
  }, [auth, router]);

  useEffect(() => {
    getAssets();
  }, []);

  return (
    <Box
      flex={1}
      display={'flex'}
      height={'95vh'}
      width={'50vw'}
      padding={4}
      marginLeft={[0, 0, 0, 4]}
      flexDirection={'column'}
    >
      <Box
        display={'flex'}
        flexDir={'row'}
        justifyContent={'flex-end'}
        alignItems={'center'}
        paddingX={4}
        height={100}
        width={'100%'}
        background={'white'}
        marginBottom={10}
        borderRadius={10}
        paddingY={2}
      >
        <Button
          width={200}
          title="Sign Out"
          background="red"
          color="white"
          onClick={() => {
            logout();
          }}
        />
      </Box>
      <Box
        display="flex"
        flexDir={['column', 'column', 'row', 'row']}
        cursor="pointer"
      >
        <Box
          padding={2}
          borderRadius={10}
          minW={200}
          h={150}
          backgroundColor={'white'}
        >
          <Text fontSize={40} fontFamily={'heavy'}>
            R {total}
          </Text>
          <Text fontSize={20} fontFamily={'bold'} color={'#ddd'}>
            Total Assets
          </Text>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDir={'column'}
        cursor="pointer"
        marginTop={10}
        maxW={1000}
      >
        <Box
          width={['100%']}
          background="white"
          display={'flex'}
          flexDir={'row'}
          justifyContent={'space-between'}
          padding={2}
          borderTopRadius={10}
        >
          <Heading color="black" fontFamily={'heavy'}>
            {'ASSETS'}
          </Heading>

          <Button
            onClick={onOpen}
            title="Add Asset"
            background="black"
            color="white"
          />
        </Box>
        <Box>
          {assets.length === 0 ? (
            <Box
              width="100%"
              height={500}
              display={'flex'}
              alignItems={'center'}
              justifyContent={'center'}
              flexDir={'column'}
              background="white"
            >
              <Text fontFamily={'bold'} color={'black'}>
                {'No assets'}
              </Text>
              <Text fontFamily={'bold'} color={'black'}>
                {'What are you waiting for? Create your first asset now!'}
              </Text>
            </Box>
          ) : (
            assets.map((item: any, index: number) => {
              const {
                _id,
                name,
                tags,
                receipt,
                currency,
                value,
                images,
                description,
                category
              } = item;
              const { color, name: categoryName } = category;
              const image = images[0];
              return (
                <Box
                  display={'flex'}
                  key={index}
                  width="100%"
                  padding={4}
                  borderTopColor={'#ddd'}
                  borderWidth={1}
                  background={'white'}
                  onClick={() => {
                    setCurrent({
                      _id,
                      name,
                      image,
                      value,
                      tags,
                      receipt,
                      currency,
                      images
                    });
                    setAssetModal(true);
                  }}
                >
                  <Box
                    height={20}
                    width={20}
                    background={`url('${process.env.NEXT_PUBLIC_API_URL}/uploads/${image}')`}
                    borderRadius={10}
                    backgroundPosition={'center'}
                    backgroundSize={'cover'}
                    padding={10}
                    marginRight={4}
                  />
                  <Box>
                    <Text fontSize={35} color="black" fontFamily={'heavy'}>
                      {`${name}`.toLocaleUpperCase()}
                    </Text>
                    <Text fontSize={20} color={`${color}`} fontFamily={'bold'}>
                      {categoryName}
                    </Text>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
      <AssetModal isOpen={isOpen} onOpen={onOpen} onClose={onClose} />
      <AssetDetails
        isOpen={assetModal}
        setAssetModal={setAssetModal}
        name={current.name}
        image={current.image}
        id={current._id}
        currency={current.currency}
        value={current.value}
        description={current.description}
      />
    </Box>
  );
}

export default MainContainer;
