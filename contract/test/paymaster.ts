import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeFunctionData,
  parseUnits,
  parseEther,
  keccak256,
  encodePacked,
  concat,
  toHex,
  pad,
  getAddress,
} from "viem";
import { network } from "hardhat";


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PER_OP   = parseUnits("100", 6); // 100 USDC
const DAILY_LIMIT  = parseUnits("500", 6); // 500 USDC
const ZERO_HASH    = ("0x" + "0".repeat(64)) as `0x${string}`;
const ZERO_BYTES32 = ("0x" + "0".repeat(64)) as `0x${string}`;

// ---------------------------------------------------------------------------
// UserOp helpers
// ---------------------------------------------------------------------------

function createEmptyUserOp(sender: string) {
  return {
    sender:              sender as `0x${string}`,
    nonce:               0n,
    initCode:            "0x" as `0x${string}`,
    callData:            "0x" as `0x${string}`,
    accountGasLimits:    ZERO_BYTES32,
    preVerificationGas:  0n,
    gasFees:             ZERO_BYTES32,
    paymasterAndData:    "0x" as `0x${string}`,
    signature:           "0x" as `0x${string}`,
  };
}

/**
 * Build a UserOp whose callData encodes:
 *   SmartAccount.execute(usdcAddress, 0, usdc.transfer(recipient, amount))
 */
function buildUsdcTransferUserOp(
  sender: string,
  usdcAddress: string,
  recipient: string,
  amount: bigint,
) {
  const transferData = encodeFunctionData({
    abi: [
      {
        name: "transfer",
        type: "function",
        inputs: [
          { name: "to",     type: "address" },
          { name: "value",  type: "uint256" },
        ],
      },
    ],
    functionName: "transfer",
    args: [recipient as `0x${string}`, amount],
  });

  const callData = encodeFunctionData({
    abi: [
      {
        name: "execute",
        type: "function",
        inputs: [
          { name: "target", type: "address" },
          { name: "value",  type: "uint256" },
          { name: "data",   type: "bytes"   },
        ],
      },
    ],
    functionName: "execute",
    args: [usdcAddress as `0x${string}`, 0n, transferData],
  });

  return { ...createEmptyUserOp(sender), callData };
}

/**
 * Sign a paymaster approval using the test wallet client.
 * Mirrors _verifyPaymasterSignature in USDCPaymaster.sol.
 *
 * approvalHash = keccak256(sender, nonce, chainId, paymasterAddress)
 * digest       = EIP-191 prefix + approvalHash
 */
async function signPaymasterApproval(
  walletClient: any,
  sender: string,
  nonce: bigint,
  chainId: bigint,
  paymasterAddress: string,
): Promise<`0x${string}`> {
  const approvalHash = keccak256(
    encodePacked(
      ["address", "uint256", "uint256", "address"],
      [sender as `0x${string}`, nonce, chainId, paymasterAddress as `0x${string}`],
    ),
  );

  // signMessage applies the EIP-191 prefix, matching MessageHashUtils.toEthSignedMessageHash
  return walletClient.signMessage({ message: { raw: approvalHash } });
}

/**
 * Build the paymasterAndData field:
 *   [0:20]  paymaster address
 *   [20:85] 65-byte signature
 */
function buildPaymasterAndData(
  paymasterAddress: string,
  sig: `0x${string}`,
): `0x${string}` {
  // Remove 0x prefix from sig before concatenating
  return concat([paymasterAddress as `0x${string}`, sig]) as `0x${string}`;
}

async function applyValidPaymasterSignature(
  userOp: any,
  signerWallet: any,
  sender: string,
  nonce: bigint,
  chainId: bigint,
  paymasterAddress: string,
) {
  const sig = await signPaymasterApproval(
    signerWallet,
    sender,
    nonce,
    chainId,
    paymasterAddress,
  );
  userOp.paymasterAndData = buildPaymasterAndData(paymasterAddress, sig);
  return userOp;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("USDCPaymaster", async function () {
  const connection = (await network.connect()) as any;
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();
  const chainId = BigInt(await publicClient.getChainId());

  // accounts[0]=admin/signer, accounts[1]=entryPoint, accounts[2]=user, accounts[3]=recipient, accounts[4]=untrustedFactory
  const [admin, entryPoint, user, recipient, untrustedFactory] =
    await viem.getWalletClients();

  // -------------------------------------------------------------------------
  // Deploy helpers
  // -------------------------------------------------------------------------

  /**
   * Deploy full system.
   * @param signerAddr  Pass address(0) to disable signature validation (dev mode).
   */
  async function deploySystem(signerAddr?: string) {
    const { networkHelpers } = await network.connect();

    const usdc = await viem.deployContract("MockUSDC");
    const implementation = await viem.deployContract("SmartAccount");
    const factory = await viem.deployContract("SmartAccountFactory", [
      implementation.address,
      admin.account.address,
    ]);

    const signer = signerAddr ?? admin.account.address;
    const paymaster = await viem.deployContract("USDCPaymaster", [
      entryPoint.account.address,
      usdc.address,
      admin.account.address,
      signer,
      MAX_PER_OP,
      DAILY_LIMIT,
      factory.address,
    ]);

    await networkHelpers.impersonateAccount(entryPoint.account.address);
    await networkHelpers.setBalance(entryPoint.account.address, parseEther("1"));

    const epWalletClient = await viem.getWalletClient(entryPoint.account.address);

    const paymasterAsEP = await viem.getContractAt(
      "USDCPaymaster",
      paymaster.address,
      { client: { wallet: epWalletClient } },
    );

    return { usdc, paymaster, paymasterAsEP, factory };
  }

  /** Deploy with signature validation enabled and admin signer. */
  async function deployNoSig() {
    return deploySystem();
  }

  // =========================================================================
  // Constructor / admin
  // =========================================================================

  
  it("owner can update paymasterSigner", async function () {
    const { paymaster } = await deploySystem();
    const newSigner = getAddress(recipient.account.address); // ← normalize to checksum form

    await viem.assertions.emitWithArgs(
      paymaster.write.setPaymasterSigner([newSigner]),
      paymaster,
      "SignerUpdated",
      [newSigner], // ← now matches the checksummed address emitted by the contract
    );

    assert.equal(
      (await paymaster.read.paymasterSigner()).toLowerCase(),
      newSigner.toLowerCase(),
    );
  });
  
  // =========================================================================
  // Deposit / withdraw  (Fix #3)
  // =========================================================================
  
  describe("deposit & withdraw", async function () {
    it("deposit() reverts if value is 0", async function () {
      const { paymaster } = await deploySystem();
      await assert.rejects(
        paymaster.write.deposit({ value: 0n }),
        /ZERO_DEPOSIT/,
      );
    });

    it("withdraw() reverts for zero address", async function () {
      const { paymaster } = await deploySystem();
      await assert.rejects(
        paymaster.write.withdraw([
          "0x0000000000000000000000000000000000000000",
          parseEther("0.1"),
        ]),
        /INVALID_ADDRESS/,
      );
    });

    it("non-owner cannot call deposit", async function () {
      const { paymaster } = await deploySystem();
      const strangerPaymaster = await viem.getContractAt(
        "USDCPaymaster",
        paymaster.address,
        { client: { wallet: user } },
      );
      await assert.rejects(
        strangerPaymaster.write.deposit({ value: parseEther("1") }),
        /OwnableUnauthorizedAccount|revert/,
      );
    });
  });
  
  // =========================================================================
  // Paymaster signature validation  (Fix #8)
  // =========================================================================

  /*
  describe("paymaster signature validation", async function () {
    it("rejects ops with missing paymasterAndData signature", async function () {
      const { usdc, paymasterAsEP, paymaster } = await deploySystem();
      await usdc.write.mint([user.account.address, MAX_PER_OP]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("50", 6),
      );
      // No sig in paymasterAndData
      (userOp as any).paymasterAndData = paymaster.address;

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]),
        /MISSING_PAYMASTER_SIGNATURE/,
      );
    });

    it("rejects ops signed by a different signer", async function () {
      const { usdc, paymasterAsEP, paymaster } = await deploySystem();
      await usdc.write.mint([user.account.address, MAX_PER_OP]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("50", 6),
      );

      // Sign with the wrong wallet (user instead of admin)
      const wrongSig = await signPaymasterApproval(
        user,
        user.account.address,
        0n,
        chainId,
        paymaster.address,
      );
      (userOp as any).paymasterAndData = buildPaymasterAndData(paymaster.address, wrongSig);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]),
        /INVALID_PAYMASTER_SIGNATURE/,
      );
    });

    it("accepts ops with a valid backend signature", async function () {
      const { usdc, paymasterAsEP, paymaster } = await deploySystem();
      await usdc.write.mint([user.account.address, MAX_PER_OP]);

      const amount = parseUnits("50", 6);
      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        amount,
      );

      const sig = await signPaymasterApproval(
        admin,
        user.account.address,
        0n,
        chainId,
        paymaster.address,
      );
      (userOp as any).paymasterAndData = buildPaymasterAndData(paymaster.address, sig);

      const [, validationData] = await paymasterAsEP.read.validatePaymasterUserOp([
        userOp,
        ZERO_HASH,
        0n,
      ]);

      assert.equal(validationData, 0n);
    });
  });

  // =========================================================================
  // validatePaymasterUserOp — regular USDC transfer path
  // =========================================================================

  describe("validatePaymasterUserOp — USDC transfer", async function () {
    // Helper: validate with signature disabled so tests focus on other logic
    async function validate(overrides: object = {}) {
      const { usdc, paymasterAsEP, paymaster } = await deployNoSig();

      const amount = parseUnits("50", 6);
      await usdc.write.mint([user.account.address, amount]);

      const userOp = {
        ...buildUsdcTransferUserOp(
          user.account.address,
          usdc.address,
          recipient.account.address,
          amount,
        ),
        ...overrides,
      };

      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      return paymasterAsEP.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]);
    }

    it("returns validationData=0 for a valid op", async function () {
      const [, validationData] = await validate();
      assert.equal(validationData, 0n);
    });

    it("context encodes sender, recipient, amount, daySlot, isDeployment=false", async function () {
      const { usdc, paymasterAsEP } = await deployNoSig();
      const amount = parseUnits("50", 6);
      await usdc.write.mint([user.account.address, amount]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        amount,
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      const [context] = await paymasterAsEP.read.validatePaymasterUserOp([
        userOp,
        ZERO_HASH,
        0n,
      ]);

      // context should not be empty
      assert.ok(context.length > 2, "context is empty");
    });

    it("rejects calls from non-EntryPoint", async function () {
      const { usdc, paymaster } = await deployNoSig();
      await usdc.write.mint([user.account.address, MAX_PER_OP]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("50", 6),
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      await assert.rejects(
        paymaster.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]),
        /ENTRY_POINT_ONLY/,
      );
    });

    it("rejects non-USDC token", async function () {
      const { paymasterAsEP } = await deployNoSig();
      const otherToken = recipient.account.address; // random non-usdc address

      const fakeOp = {
        ...createEmptyUserOp(user.account.address),
        callData: encodeFunctionData({
          abi: [
            {
              name: "execute",
              type: "function",
              inputs: [
                { type: "address" },
                { type: "uint256" },
                { type: "bytes" },
              ],
            },
          ],
          functionName: "execute",
          args: [
            otherToken as `0x${string}`,
            0n,
            encodeFunctionData({
              abi: [
                {
                  name: "transfer",
                  type: "function",
                  inputs: [{ type: "address" }, { type: "uint256" }],
                },
              ],
              functionName: "transfer",
              args: [recipient.account.address as `0x${string}`, parseUnits("50", 6)],
            }),
          ],
        }),
      };
      await applyValidPaymasterSignature(fakeOp, admin, user.account.address, 0n, chainId, paymasterAsEP.address);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([fakeOp, ZERO_HASH, 0n]),
        /TOKEN_NOT_SUPPORTED/,
      );
    });

    it("enforces per-operation limit", async function () {
      const { usdc, paymasterAsEP } = await deployNoSig();
      const overLimit = MAX_PER_OP + 1n;
      await usdc.write.mint([user.account.address, overLimit]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        overLimit,
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymasterAsEP.address);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]),
        /PER_OP_LIMIT_EXCEEDED/,
      );
    });

    it("rejects when sender has insufficient USDC balance  (Fix #7)", async function () {
      const { paymasterAsEP, paymaster, usdc } = await deployNoSig();
      // No mint — user has 0 USDC

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("50", 6),
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([userOp, ZERO_HASH, 0n]),
        /INSUFFICIENT_USDC_BALANCE/,
      );
    });

    it("enforces daily limit across multiple ops", async function () {
      const { usdc, paymasterAsEP } = await deployNoSig();

      // Mint enough for both ops to pass balance check but exceed daily limit together
      const bigBalance = DAILY_LIMIT + parseUnits("100", 6);
      await usdc.write.mint([user.account.address, bigBalance]);

      // First op: 300 USDC (within 500 daily limit)
      const op1 = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("300", 6),
      );
      await applyValidPaymasterSignature(op1, admin, user.account.address, 0n, chainId, paymasterAsEP.address);
      const [ctx1] = await paymasterAsEP.read.validatePaymasterUserOp([op1, ZERO_HASH, 0n]);

      // Simulate postOp writing the accounting
      await paymasterAsEP.write.postOp([0, ctx1, 0n, 0n]); // mode=opSucceeded

      // Second op: 300 USDC — total 600 > 500 daily limit
      const op2 = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        parseUnits("300", 6),
      );
      await applyValidPaymasterSignature(op2, admin, user.account.address, 0n, chainId, paymasterAsEP.address);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([op2, ZERO_HASH, 0n]),
        /DAILY_LIMIT_EXCEEDED/,
      );
    });
  });

  // =========================================================================
  // postOp — accounting is written here, not in validate  (Fix #1 & #2)
  // =========================================================================

  describe("postOp", async function () {
    it("writes dailySponsored on opSucceeded", async function () {
      const { usdc, paymasterAsEP, paymaster } = await deployNoSig();
      const amount = parseUnits("50", 6);
      await usdc.write.mint([user.account.address, amount]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        amount,
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      const [context] = await paymasterAsEP.read.validatePaymasterUserOp([
        userOp,
        ZERO_HASH,
        0n,
      ]);

      // dailySponsored should be 0 before postOp
      const daySlot = BigInt(Math.floor(Date.now() / 86400000));
      assert.equal(
        await paymasterAsEP.read.dailySponsored([user.account.address, daySlot]),
        0n,
      );

      // Call postOp with opSucceeded (mode=0)
      await paymasterAsEP.write.postOp([0, context, 0n, 0n]);

      assert.equal(
        await paymasterAsEP.read.dailySponsored([user.account.address, daySlot]),
        amount,
      );
    });

    it("does NOT write dailySponsored when op reverts (mode=opReverted)  (Fix #2)", async function () {
      const { usdc, paymasterAsEP, paymaster } = await deployNoSig();
      const amount = parseUnits("50", 6);
      await usdc.write.mint([user.account.address, amount]);

      const userOp = buildUsdcTransferUserOp(
        user.account.address,
        usdc.address,
        recipient.account.address,
        amount,
      );
      await applyValidPaymasterSignature(userOp, admin, user.account.address, 0n, chainId, paymaster.address);

      const [context] = await paymasterAsEP.read.validatePaymasterUserOp([
        userOp,
        ZERO_HASH,
        0n,
      ]);

      // mode=1 (opReverted)
      await paymasterAsEP.write.postOp([1, context, 0n, 0n]);

      const daySlot = BigInt(Math.floor(Date.now() / 86400000));
      assert.equal(
        await paymasterAsEP.read.dailySponsored([user.account.address, daySlot]),
        0n, // must still be 0
      );
    });

    it("does NOT write dailySponsored for deployment ops", async function () {
      const { paymasterAsEP, factory, paymaster } = await deployNoSig();

      const futureAddr = await factory.read.getAddressWithEntryPoint([
        user.account.address,
        entryPoint.account.address,
      ]);

      // Build a deployment initCode
      const initCode = (
        factory.address +
        encodeFunctionData({
          abi: [
            {
              name: "createAccountWithEntryPoint",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }],
            },
          ],
          functionName: "createAccountWithEntryPoint",
          args: [user.account.address as `0x${string}`, entryPoint.account.address as `0x${string}`],
        }).slice(2)
      ) as `0x${string}`;

      const deployOp = {
        ...createEmptyUserOp(futureAddr),
        initCode,
      };
      await applyValidPaymasterSignature(deployOp, admin, futureAddr, 0n, chainId, paymaster.address);

      const [context] = await paymasterAsEP.read.validatePaymasterUserOp([
        deployOp,
        ZERO_HASH,
        0n,
      ]);

      await paymasterAsEP.write.postOp([0, context, 0n, 0n]);

      const daySlot = BigInt(Math.floor(Date.now() / 86400000));
      assert.equal(
        await paymasterAsEP.read.dailySponsored([futureAddr, daySlot]),
        0n,
      );
    });

    it("only EntryPoint can call postOp", async function () {
      const { paymaster } = await deployNoSig();
      const fakeContext = "0x" + "00".repeat(32);
      await assert.rejects(
        paymaster.write.postOp([0, fakeContext, 0n, 0n]),
        /ENTRY_POINT_ONLY/,
      );
    });
  });

  // =========================================================================
  // Gasless wallet deployment  (new feature)
  // =========================================================================

  describe("gasless wallet deployment via initCode", async function () {
    it("approves a deployment op from a trusted factory", async function () {
      const { paymasterAsEP, factory, paymaster } = await deployNoSig();

      const futureAddr = await factory.read.getAddressWithEntryPoint([
        user.account.address,
        entryPoint.account.address,
      ]);

      const initCode = (
        factory.address +
        encodeFunctionData({
          abi: [
            {
              name: "createAccountWithEntryPoint",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }],
            },
          ],
          functionName: "createAccountWithEntryPoint",
          args: [user.account.address as `0x${string}`, entryPoint.account.address as `0x${string}`],
        }).slice(2)
      ) as `0x${string}`;

      const deployOp = {
        ...createEmptyUserOp(futureAddr),
        initCode,
      };
      await applyValidPaymasterSignature(deployOp, admin, futureAddr, 0n, chainId, paymaster.address);

      const [context, validationData] = await paymasterAsEP.read.validatePaymasterUserOp([
        deployOp,
        ZERO_HASH,
        0n,
      ]);

      assert.equal(validationData, 0n, "deployment op should be approved");
      assert.ok(context.length > 2, "context should not be empty");
    });

    it("rejects a deployment op from an untrusted factory", async function () {
      const { paymasterAsEP, paymaster } = await deployNoSig();

      const fakeFactory = untrustedFactory.account.address;
      const fakeInitCode = (fakeFactory + "deadbeef") as `0x${string}`;

      const deployOp = {
        ...createEmptyUserOp(user.account.address),
        initCode: fakeInitCode,
      };
      await applyValidPaymasterSignature(deployOp, admin, user.account.address, 0n, chainId, paymaster.address);

      await assert.rejects(
        paymasterAsEP.read.validatePaymasterUserOp([deployOp, ZERO_HASH, 0n]),
        /UNTRUSTED_FACTORY/,
      );
    });

    it("emits WalletDeploymentSponsored event", async function () {
      const { paymasterAsEP, factory, paymaster } = await deployNoSig();

      const futureAddr = await factory.read.getAddressWithEntryPoint([
        user.account.address,
        entryPoint.account.address,
      ]);

      const initCode = (
        factory.address +
        encodeFunctionData({
          abi: [
            {
              name: "createAccountWithEntryPoint",
              type: "function",
              inputs: [{ type: "address" }, { type: "address" }],
            },
          ],
          functionName: "createAccountWithEntryPoint",
          args: [user.account.address as `0x${string}`, entryPoint.account.address as `0x${string}`],
        }).slice(2)
      ) as `0x${string}`;

      const deployOp = {
        ...createEmptyUserOp(futureAddr),
        initCode,
      };
      await applyValidPaymasterSignature(deployOp, admin, futureAddr, 0n, chainId, paymaster.address);

      // validatePaymasterUserOp is a read, but the event fires from the EntryPoint call
      // We use write here to capture the event (some frameworks require a tx for event assertions)
      // Note: if your test framework only captures events from write calls wrap accordingly.
      const [context] = await paymasterAsEP.read.validatePaymasterUserOp([
        deployOp,
        ZERO_HASH,
        0n,
      ]);
      // Verify context has isDeployment=true by checking postOp does not write accounting
      await paymasterAsEP.write.postOp([0, context, 0n, 0n]);

      const daySlot = BigInt(Math.floor(Date.now() / 86400000));
      assert.equal(
        await paymasterAsEP.read.dailySponsored([futureAddr, daySlot]),
        0n,
        "deployment op must not consume daily quota",
      );
    });
  });
  */
});