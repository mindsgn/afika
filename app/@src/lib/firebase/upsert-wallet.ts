import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb } from './client';

export interface UpsertData {
    address?:  string,
    network?: string,
    createdAt?:  any,
    updatedAt?:  any,
    PhoneNumber?:  null,
    IsVerified?: boolean,
    UserLevel?:  number,
    PhoneLinkedAt?:  null,
}


export default async function upsertWallet(walletAddress: string, data: UpsertData) {
    const db = getFirestoreDb();
    if (!db || !walletAddress) return;
    setDoc(doc(db, `wallets/${walletAddress}`), {
    ...data
    }, {merge: true})
    .catch((error) => {
        console.log(error)
    })
    .finally(() => {
        return
    });
}