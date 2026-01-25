package walletcore

import "testing"

func TestHelloWorld(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"Pocket Money Native Wallet", "Hello World from GO"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wallet := &NativeWallet{}
			got := wallet.HelloWorld()

			if got != tt.want {
				t.Errorf("HelloWorld() got int %s, want %s", got, tt.want)
			}
		})
	}
}
