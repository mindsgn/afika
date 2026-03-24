import { doc, getDoc, query, collection, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '@/@src/lib/firebase/client';
import { TokenBalance } from '@/@src/store/wallet';
import { mapBalanceDoc } from './useFirebaseSync';

export default async function getBalance(walletAddress: string) {
    const db = getFirestoreDb();
    let unsubscribeBalances: (() => void) | null = null;
    if (!db || !walletAddress) return;
    
    try {
        const balancesQuery = query(
            collection(db, `wallets/${walletAddress}/balances`),
        );

        unsubscribeBalances = onSnapshot(balancesQuery, async (snapshot) => {
            const balances = snapshot.docs.map((docSnap) => mapBalanceDoc(docSnap.data()));
            if (balances.length > 0) {
                // setBalances(balances);
            }
        })
    } catch (error){
        console.log(error)
    }
}