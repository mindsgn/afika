import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keypadMaxFromBalance } from "./amount.ts";

describe("keypadMaxFromBalance", () => {
  it("passes a usable balance through as the keypad max", () => {
    assert.equal(keypadMaxFromBalance("10.25"), 10.25);
    assert.equal(keypadMaxFromBalance("100"), 100);
    assert.equal(keypadMaxFromBalance("0.0004"), 0.0004);
  });

  it("falls back below the smallest keypad amount when the balance is unusable", () => {
    // The AmountKeypad schema rejects a non-positive max, so an empty or
    // unreadable balance must still produce a finite positive number. The
    // floor sits below 0.01 (the keypad's smallest increment) so every
    // typed amount stays rejected and the CTA never enables.
    assert.equal(keypadMaxFromBalance("0"), 0.001);
    assert.equal(keypadMaxFromBalance(""), 0.001);
    assert.equal(keypadMaxFromBalance("not-a-number"), 0.001);
    assert.equal(keypadMaxFromBalance("-5"), 0.001);
    assert.equal(keypadMaxFromBalance("Infinity"), 0.001);
  });
});
