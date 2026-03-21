import { mergeIncomingTransactions } from './useFirebaseSync';

describe('mergeIncomingTransactions', () => {
  it('adds only new transactions by hash', () => {
    const existing = [
      { hash: '0x1', direction: 'credit' } as any,
    ];
    const added = [
      { hash: '0x1', direction: 'credit' } as any,
      { hash: '0x2', direction: 'credit' } as any,
    ];
    const result = mergeIncomingTransactions(existing, added);
    const hashes = result.map((tx) => tx.hash);
    expect(hashes).toContain('0x1');
    expect(hashes).toContain('0x2');
    expect(hashes.filter((h) => h === '0x1').length).toBe(1);
  });
});
