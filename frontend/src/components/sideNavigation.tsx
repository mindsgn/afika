'use client';

import React from 'react';
import { Box } from '@chakra-ui/react';
import { FaHome, FaCog, FaTags } from 'react-icons/fa';

const SideNavigation: React.FC = () => {
  return (
    <Box
      borderRadius={20}
      background={'white'}
      height={'95vh'}
      padding={2}
      display={['none', 'none', 'flex', 'flex']}
      flexDir={'column'}
      alignItems={'center'}
      justifyContent={'space-between'}
    >
      <Box display={'flex'} flexDir={'column'} alignItems={'center'}>
        <Box
          width={50}
          height={50}
          marginX={2}
          cursor="pointer"
          backgroundImage="/icon-512.png"
          backgroundSize="contain"
          backgroundRepeat="no-repeat"
        />
        <Box margin={'10px'} cursor="pointer" marginTop={10}>
          <FaHome color="black" size={40} />
        </Box>
        {/*
              <Box margin={'10px'} cursor="pointer" marginTop={2}>
                <FaTags color="white" size={40} />
              </Box>
              <Box margin={'10px'} cursor="pointer" marginTop={2}>
                <FaTags color="white" size={40} />
              </Box>
              <Box margin={'10px'} cursor="pointer" marginTop={2}>
                <FaCog color="white" size={40} />
              </Box>
            */}
      </Box>

      <Box display={'flex'}>
        {/*
            <Box margin={'10px'} cursor="pointer" marginTop={2}>
              <FaCog color="white" size={40} />
            </Box>
          */}
      </Box>
    </Box>
  );
};

export default SideNavigation;
