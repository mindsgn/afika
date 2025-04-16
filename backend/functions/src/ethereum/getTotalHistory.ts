// import { Network, Alchemy } from "alchemy-sdk";
import { formatCompactNumber } from "../utils/formatCompactNumber"

interface GetTotalHistory {
    network: string,
    address: string,
    tokenValue: number
   
}

interface Transactions {
    fiatValue: number,
    formatedFiatValue: string | number | undefined,
    transactionType: string | "deposit" | "withdraw",
    timeStamp: string
}

const getTotalHistory = async({
    network,
    address,
    tokenValue,
}: GetTotalHistory) => {
    try{
        const polygonscanEndpoint = `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&offset=10&sort=desc&apikey=${process.env.POLYGONSCAN_API}`;
        const response = await fetch(polygonscanEndpoint);
        
        if (!response.ok) {
            throw new Error(`Polygonscan API error: ${response.statusText}`);
        }
    
        const data = await response.json();
        
        const transactions = data.result;
        const formatedTransactions: Transactions[] = [];


        //@ts-expect-error
        transactions.map((transaction, index) => {
            const { value, from, timeStamp } = transaction;
            const valueInEth = Number(value) / 1e18;
            const fiatValue : number = valueInEth * tokenValue;
            
            let transactionType: string = "deposit";
            
            if(from === address.toLowerCase()){
                transactionType = "withdraw"
            }

            const formatedFiatValue: string | number | undefined = formatCompactNumber(fiatValue);
            
            formatedTransactions.push({
                fiatValue,
                formatedFiatValue,
                transactionType,
                timeStamp
            });
        })

        if (data.status === '1') {
            return formatedTransactions;
        } else {
            return [];
        }
    } catch (error) {
        return {
           
        }
    }
}

export {
    getTotalHistory
}