import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'black',
        color: 'white',
        width: '100vw',
        height: '100vh'
      }
    }
  },
  breakpoints: {
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em'
  }
});

export default theme;
