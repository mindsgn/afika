import { ethers } from 'ethers';
import React, {
  createContext,
  ReactElement,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { apiUrl, params as marketParams } from '../constants';
import { WalletContextType } from '../types';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const WalletProvider = (props: { children: ReactNode }): ReactElement => {
  const [magic, setMagic] = useState<any | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [address, setAddress] = useState<string | null>(null);
  const [transactions, setTransaction] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tokens, setTokens] = useState<any[]>([]);
  const [network, setNetwork] = useState<any | null>({});
  const [marketData, setMarketData] = useState<any>([]);
  const [exhangeRate, setExchangeRate] = useState(0);
  const [rates, setRates] = useState<any | null>(null);

  const getMainToken = (chainId: number) => {
    switch (chainId) {
      case 1:
        return {
          name: 'Ethereum',
          symbol: 'Eth',
          ids: 'ethereum',
          network: 'Ethereum Mainnet',
          mainnet: true,
          layer: 1,
          alchemy: {
            api: '55qEBAztRX87d8qrMzxVZ4tfBEapkIqe',
            https:
              'https://eth-mainnet.g.alchemy.com/v2/55qEBAztRX87d8qrMzxVZ4tfBEapkIqe',
            websocket:
              'wss://eth-mainnet.g.alchemy.com/v2/55qEBAztRX87d8qrMzxVZ4tfBEapkIqe',
          },
        };
      default:
        return null;
    }
  };

  const getAllTransactions = async (address: string) => {
    const etherscanEndpoint = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&page=1&offset=100&sort=desc&apikey=9QCTW7Y2RUMTXJ3F44UVGQV1WGR5X1NXJJ`;
    try {
      const response = await fetch(etherscanEndpoint);

      if (!response.ok) {
        throw new Error(`Etherscan API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === '1') {
        return data.result;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  };

  const fetchEthToZarExchangeRate = async () => {
    const coingeckoEndpoint = 'https://api.coingecko.com/api/v3/simple/price';

    const queryParams = new URLSearchParams({
      ids: 'ethereum',
      vs_currencies: 'zar',
    });

    try {
      const response = await fetch(`${coingeckoEndpoint}?${queryParams}`);

      if (response.ok) {
        const data = await response.json();

        if (data?.ethereum?.zar) {
          return data.ethereum.zar;
        } else {
          console.error(
            'Error: CoinGecko API response does not contain exchange rate'
          );
        }
      } else {
        console.error(
          'Error fetching exchange rate from CoinGecko:',
          response.statusText
        );
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const allExchangeRates = async () => {
    await fetch('https://theforexapi.com/api/latest?base=USD')
      .then(async (response) => {
        return await response.json();
      })
      .then(async (response) => {
        setRates(response);
      })
      .catch((error) => {
        return null;
      });

    return null;
  };

  const getMarketData = async () => {
    const url = new URL(apiUrl);
    //@ts-ignore
    Object.keys(marketParams).forEach((key) =>
      //@ts-ignore
      url.searchParams.append(key, marketParams[key])
    );

    await fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        setMarketData(data);
      })
      .catch((error) => {
        return [];
      });
  };

  const getNetwork = async () => {
    const provider = new ethers.providers.Web3Provider(magic.rpcProvider);

    const signer = provider.getSigner();

    // const address: string =
    //  '0x02cE1f30Dc9f77C00CA1F227e75267D2C470CD80'.toLowerCase();
    const address = (await signer.getAddress()).toLocaleLowerCase();

    const balance = ethers.utils.formatEther(
      await provider.getBalance(address)
    );

    const chainId: number = await signer.getChainId();

    const networkSettings = getMainToken(chainId);
    allExchangeRates();
    getMarketData();
    // console.log(await getMarketData());

    if (networkSettings) {
      const exchangeRateResponse = await fetchEthToZarExchangeRate();
      let transactionsData = await getAllTransactions(address);

      transactionsData = transactionsData.filter((transaction: any) => {
        return transaction.value !== '0';
      });

      transactionsData = transactionsData.map((transaction: any) => ({
        ...transaction,
        timestamp: parseInt(transaction.timestamp),
      }));

      transactionsData = transactionsData.map((transaction: any) => {
        if (transaction.from === address) {
          return { ...transaction, label: 'out' };
        } else if (transaction.to === address) {
          return { ...transaction, label: 'in' };
        } else {
          return { ...transaction, label: 'unknown' };
        }
      });

      setExchangeRate(exchangeRateResponse);
      setBalance(parseFloat(balance));
      setTransaction(transactionsData);
      setAddress(address);

      setTokens([
        ...tokens,
        {
          ...tokens,
          balance,
        },
      ]);
      setNetwork(networkSettings);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (magic) {
      getNetwork();
    }
  }, [magic]);

  return (
    <WalletContext.Provider
      {...props}
      value={{
        address,
        transactions,
        exhangeRate,
        balance,
        loading,
        network,
        tokens,
        marketData,
        rates,
        setMagic,
      }}
    />
  );
};

export { WalletProvider, useWallet };
