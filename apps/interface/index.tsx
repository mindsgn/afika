export interface Token {
    name: string;
    icon: string;
    amount: number;
}

export interface walletState {
    connected?: boolean;
    type?: string | null;
    tokens?: Token[];
    chainId?: number | null;
    network?: string | null;
    address?: string;
    totalAmount?: number | null;
    disabled?: boolean;
    peerId?: string | null;
    peerMeta?: any | null;
    error?: boolean;
    markets?: any;
}
