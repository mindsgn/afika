import { create } from 'zustand';

export interface User {
  email: null | string;
}

export interface AuthInterfce {
  auth: null | boolean;
  step: number;
  user: User;
  token: null | string;
  getAuth: () => void;
  login: (email: string) => void;
  verify: (email: string, code: string) => void;
  logoutL: () => void;
}

const useAuth = create(set => ({
  auth: null,
  user: {
    email: null
  },
  token: null,
  step: 0,
  getAuth: async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        set((state: AuthInterfce) => ({
          step: state.step + 1,
          auth: true
        }));
      }
    } catch (error) {
      console.log(error);
    }
  },
  login: async (email: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email.toLowerCase()
          })
        }
      );

      if (!response.ok) {
        console.log(response);
        throw new Error('signin failed');
      }

      set((state: AuthInterfce) => ({
        step: state.step + 1,
        user: { ...state.user, email }
      }));
      console.log(email);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  },
  verify: async (email: string, code: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            code
          })
        }
      );

      if (!response.ok) {
        throw new Error('verfification failed');
      }

      const data = await response.json();
      const { token } = data;
      sessionStorage.setItem('token', token);
      set((state: AuthInterfce) => ({
        auth: true,
        token
      }));

    } catch (error) {
      console.log(error);
    }
  },
  logout: async () => {
    try {
      sessionStorage.clear();
      set((state: AuthInterfce) => ({
        auth: false
      }));
    } catch (error) {
      return null;
    } finally {
      return null;
    }
  }
}));

//@ts-expect-error
useAuth.getState().getAuth();

export { useAuth };
