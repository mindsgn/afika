import React, {
  createContext,
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

type AuthContextType = {
  auth: { [key: string]: any } | null;
  setAuth: Dispatch<SetStateAction<{ [key: string]: any } | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const AuthProvider = (props: { children: ReactNode }): ReactElement => {
  const [auth, setAuth] = useState<{ [key: string]: any } | null>(null);

  return <AuthContext.Provider {...props} value={{ auth, setAuth }} />;
};

export { AuthProvider, useAuth };
