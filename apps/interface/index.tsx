export interface Token {
    name: string;
    icon: string;
    amount: number;
}

export interface User {
    aggregateVerifier: string
    dappShare: string
    email: string
    idToken: string
    name: string
    oAuthIdToken: string
    profileImage: string
    typeOfLogin: string
    verifier: string
    verifierId: string
}

export interface walletState {
    connected?: boolean
    ed25519PrivKey: string | null
    privKey: string | null
    sessionId:  string | null
    user: User | null
    error: boolean
    auth: any
}
