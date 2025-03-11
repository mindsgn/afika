import { create } from 'zustand';

interface AuthInterfce {}

const useAnimation = create(set => ({
  auth: null
}));

export { useAnimation };
