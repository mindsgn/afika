import React, {
  createContext,
  ReactElement,
  ReactNode,
  useContext,
  useState,
} from 'react';

import { ContactContextType } from '../types';

const ContactContext = createContext<ContactContextType | undefined>(undefined);

function useContact(): ContactContextType {
  const context = useContext(ContactContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const ContactProvider = (props: { children: ReactNode }): ReactElement => {
  const [contacts] = useState(null);

  return <ContactContext.Provider {...props} value={{ contacts }} />;
};

export { ContactProvider, useContact };
