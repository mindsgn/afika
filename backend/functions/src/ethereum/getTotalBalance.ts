import { formatEther } from "ethers";
import { Network, Alchemy } from "alchemy-sdk";
import { formatCompactNumber } from "../utils/formatCompactNumber";

interface Tokens {
    balance: number,
    fiatBalance: number,
    symbol: string,
    currency: string,
    value: number,
    lastUpdatedAt: string
};

interface GetBalance {
    network: string,
    address: string,
};

const getTotalBalance = async({
    network,
    address
}: GetBalance) => {
    let tokens: Tokens[] = [];
    let totalBalance: number = 0; 

    try{
        let _network =  Network.MATIC_MAINNET

        if(network==="testnet"){
            _network = Network.MATIC_MAINNET
        }

        const settings = {
            apiKey: `${process.env.ALCHEMY_API}`,
            network: _network,
        };
                
        const alchemy = new Alchemy(settings);

        const priceResponse = await alchemy.prices.getTokenPriceBySymbol(["POL"]);
        const { data: priceData } = priceResponse;
               
        const { currency, value, lastUpdatedAt } = priceData[0].prices[0];

        const nativeBalance = await alchemy.core.getBalance(address, "latest");
        const { _hex } = nativeBalance;
        const balance = formatEther(_hex);

        const fiatBalance = parseFloat(balance) * parseFloat(value);
        totalBalance += fiatBalance;

        //@ts-expect-error
        const formaTotaltedBalance: string = formatCompactNumber(totalBalance)

        console.log(formaTotaltedBalance);

        tokens.push({
            balance: parseFloat(balance),
            fiatBalance,
            symbol: "POL",
            currency,
            value: parseFloat(value),
            lastUpdatedAt
        });

        return {
            totalBalance: formaTotaltedBalance,
            tokens,
            tokenValue: parseFloat(value),
        }
    } catch (error) {
        return []
    }
}

export {
    getTotalBalance
}