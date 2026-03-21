package services

import "testing"

func TestDescribeTransfer(t *testing.T) {
	credit := DescribeTransfer("credit", "USDC", "0x1234567890abcdef", "0x9999")
	if credit == "" || credit[:8] != "Received" {
		t.Fatalf("expected credit description, got %q", credit)
	}
	debit := DescribeTransfer("debit", "USDC", "0x1234567890abcdef", "0x9999")
	if debit == "" || debit[:4] != "Sent" {
		t.Fatalf("expected debit description, got %q", debit)
	}
}
