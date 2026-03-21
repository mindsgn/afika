import { doc, getDoc } from 'firebase/firestore';
import { getFirestoreDb } from './client';

function normalizePhoneKey(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  let result = '';
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if ((c >= '0' && c <= '9') || c === '+') {
      result += c;
    }
  }
  return result;
}

export async function getWalletAddressByPhone(phoneE164: string): Promise<string> {
  const db = getFirestoreDb();
  if (!db) return '';

  const key = normalizePhoneKey(phoneE164);
  if (!key) return '';
  const snap = await getDoc(doc(db, 'wallets', key));
  console.log(snap.exists())
  if (!snap.exists()) return '';
  return ""
  //const data = snap.data() as { walletAddress?: unknown } | undefined;
  //const walletAddress = typeof data?.walletAddress === 'string' ? data.walletAddress.trim() : '';
  //return walletAddress || '';
}
