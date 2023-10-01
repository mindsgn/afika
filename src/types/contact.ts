type walletType = {
  ens: string;
  wallet: string;
};

type bankType = {
  bank: string;
  account: string;
};

type ContactType = {
  name: string;
  phoneNumber: string | null;
  bank: bankType | null;
  wallet: walletType | null;
};

type ContactContextType = {
  contacts: ContactType[] | null;
};

export { type ContactContextType };
