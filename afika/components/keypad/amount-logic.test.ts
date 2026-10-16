import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyKey, formatDisplay, isAccepted, toNumber } from "./amount-logic.ts";
import type { KeyPress } from "./schema";

describe("applyKey", () => {
  it("appends digits and replaces a leading zero", () => {
    assert.equal(applyKey("", "1", 100), "1");
    assert.equal(applyKey("1", "2", 100), "12");
    assert.equal(applyKey("0", "5", 100), "5");
    assert.equal(applyKey("0", "0", 100), "0");
  });

  it("adds a single decimal point, defaulting to 0.", () => {
    assert.equal(applyKey("", ".", 100), "0.");
    assert.equal(applyKey("12", ".", 100), "12.");
    assert.equal(applyKey("12.5", ".", 100), "12.5");
    assert.equal(applyKey("0.", "5", 100), "0.5");
  });

  it("caps the value at max", () => {
    assert.equal(applyKey("100", "0", 100), "100");
    assert.equal(applyKey("100", "1", 100), "100");
    assert.equal(applyKey("99", "9", 100), "99");
    assert.equal(applyKey("10.2", "9", 10.25), "10.2");
  });

  it("rejects a third decimal place", () => {
    assert.equal(applyKey("1.2", "3", 100), "1.23");
    assert.equal(applyKey("1.23", "4", 100), "1.23");
  });

  it("backspace removes one character", () => {
    assert.equal(applyKey("", "backspace", 100), "");
    assert.equal(applyKey("1", "backspace", 100), "");
    assert.equal(applyKey("12.5", "backspace", 100), "12.");
  });
});

describe("toNumber", () => {
  it("parses raw keys into numbers", () => {
    assert.equal(toNumber(""), 0);
    assert.equal(toNumber("."), 0);
    assert.equal(toNumber("0."), 0);
    assert.equal(toNumber("12.5"), 12.5);
    assert.equal(toNumber("100"), 100);
  });
});

describe("formatDisplay", () => {
  it("pads to two decimals", () => {
    assert.equal(formatDisplay(""), "0.00");
    assert.equal(formatDisplay("12"), "12.00");
    assert.equal(formatDisplay("12.5"), "12.50");
    assert.equal(formatDisplay("0."), "0.00");
  });

  it("groups thousands", () => {
    assert.equal(formatDisplay("1234"), "1,234.00");
    assert.equal(formatDisplay("123456"), "123,456.00");
    assert.equal(formatDisplay("1234567890.5"), "1,234,567,890.50");
  });
});

describe("isAccepted", () => {
  it("accepts a positive amount within the balance", () => {
    assert.equal(isAccepted("", 100), false);
    assert.equal(isAccepted("0", 100), false);
    assert.equal(isAccepted("0.00", 100), false);
    assert.equal(isAccepted("0.01", 100), true);
    assert.equal(isAccepted("100", 100), true);
  });

  it("rejects amounts above the balance", () => {
    assert.equal(isAccepted("100.01", 100), false);
    assert.equal(isAccepted("1000", 100), false);
    assert.equal(isAccepted("0.01", 0.001), false);
  });
});

describe("send amount keypad flow", () => {
  it("types 12.50 through the keys and displays it", () => {
    const max = 100;
    let raw = "";
    for (const key of ["1", "2", ".", "5"] as KeyPress[]) {
      raw = applyKey(raw, key, max);
    }
    assert.equal(raw, "12.5");
    assert.equal(formatDisplay(raw), "12.50");
    assert.equal(isAccepted(raw, max), true);
  });

  it("stops accepting digits once the amount would exceed the balance", () => {
    const max = 5;
    let raw = "";
    raw = applyKey(raw, "9", max);
    assert.equal(raw, "");
    raw = applyKey(raw, "4", max);
    raw = applyKey(raw, "9", max);
    assert.equal(raw, "4");
    assert.equal(isAccepted(raw, max), true);
  });
});
