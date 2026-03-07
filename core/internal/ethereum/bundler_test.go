package ethereum

import "testing"

func TestIsRetryableBundlerError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "timeout", err: assertErr("request timeout"), want: true},
		{name: "temporary", err: assertErr("temporary network failure"), want: true},
		{name: "server 503", err: assertErr("bundler rpc failed: status=503"), want: true},
		{name: "rate limited", err: assertErr("too many requests"), want: true},
		{name: "validation", err: assertErr("invalid user operation"), want: false},
		{name: "nil", err: nil, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isRetryableBundlerError(tt.err)
			if got != tt.want {
				t.Fatalf("isRetryableBundlerError() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEnvInt(t *testing.T) {
	t.Setenv("POCKET_TEST_INT", "")
	if got := envInt("POCKET_TEST_INT", 3); got != 3 {
		t.Fatalf("expected fallback, got %d", got)
	}

	t.Setenv("POCKET_TEST_INT", "12")
	if got := envInt("POCKET_TEST_INT", 3); got != 12 {
		t.Fatalf("expected parsed value, got %d", got)
	}

	t.Setenv("POCKET_TEST_INT", "-1")
	if got := envInt("POCKET_TEST_INT", 3); got != 3 {
		t.Fatalf("expected fallback for negative value, got %d", got)
	}
}

type assertErr string

func (a assertErr) Error() string { return string(a) }
