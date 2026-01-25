package walletcore

type NativeWallet struct{}

func (w *NativeWallet) HelloWorld() string {
	return "Hello World from GO!"
}
