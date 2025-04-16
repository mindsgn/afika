import { onCall } from "firebase-functions/v2/https";
import { Wallet } from "ethers";
import { getTotalBalance } from "./ethereum/getTotalBalance";
import { getTotalHistory } from "./ethereum/getTotalHistory";

export const newWallet = onCall(async(request) => {
    try{
        const { data } = request;
        const { network, type, encrypted, password } = data;

        switch (type) {
            case "optimism":
            case "polygon":
            case "gnosis":
            case "ethereum":
                const wallet = Wallet.createRandom();
                const { privateKey, address, mnemonic, publicKey } = wallet;
                //@ts-expect-error
                const { phrase } = mnemonic;

                return {
                    error: false,
                    message: null,
                    address,
                    privateKey,
                    publicKey,
                    mnemonic: phrase,
                    network,
                    encrypted,
                    password,
                    type
                };
            case "stellar":
                return {
                    type
                }
            case "bitcoin":
                return {
                    type
                }
            case "cardano":
                return {
                    type
                }
            default:
                throw new Error ("Error: Cannot create wallet");
        }
    } catch (error) {
        return {
            error: true,
            message: `${error}`,
            address: "",
        }
    } finally {
        console.log("Done!");
    } 
});

export const getBalance = onCall(async(request) => {
    try{
        const { data } = request;
        const { type, address, network } = data;

        switch (type) {
            case "optimism":
            case "polygon":
            case "gnosis":
            case "ethereum":
                const balanceResponse = await getTotalBalance({
                    network, address
                });

                //@ts-expect-error
                const { tokenValue } = balanceResponse

                const TransactionHistory = await getTotalHistory({
                    network, address, tokenValue
                });

                return {
                    type,
                    ...balanceResponse,
                    transactions: TransactionHistory,
                }
            case "stellar":
                return {
                    type
                }
            case "bitcoin":
                return {
                    type
                }
            case "cardano":
                return {
                    type
                }
            default:
                throw new Error ("Error: Cannot create wallet");
        }
    } catch (error) {
        return {
            error: true,
            message: `${error}`,
            address: "",
        }
    } finally {
        console.log("Done!");
    }
});
