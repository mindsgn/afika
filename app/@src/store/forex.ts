import { create } from 'zustand';

type ForexState = {
  rate: number;
  pair: string;
  setRate: (address: number) => void;
  setPair: (address: number) => void;
};

const useWallet = create<ForexState>((set) => ({
  rate: 1,
  pair: "USD/ZAR",
  setRate: (rate: number) => {
    set({rate})
  },
  setPair: (rate: number) => {
    set({rate})
  }
}));

export default useWallet;
