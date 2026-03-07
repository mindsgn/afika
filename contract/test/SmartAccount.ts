import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress, encodeFunctionData, keccak256, toHex } from "viem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ABI fragment for SmartAccount.execute */
const EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "target", type: "address" },
      { name: "value",  type: "uint256" },
      { name: "data",   type: "bytes"   },
    ],
  },
] as const;

describe("SmartAccount System", async function () {
  const connection = (await network.connect()) as any;
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();

  // accounts[0] = owner, accounts[1] = stranger, accounts[2] = fakeEntryPoint
  const [owner, stranger, fakeEntryPoint] = await viem.getWalletClients();

  // -------------------------------------------------------------------------
  // Shared deploy helper
  // -------------------------------------------------------------------------

  async function deploySystem() {
    const implementation = await viem.deployContract("SmartAccount");

    const factory = await viem.deployContract("SmartAccountFactory", [
      implementation.address,
      owner.account.address,
    ]);

    return { implementation, factory };
  }

  /** Deploy factory + create an account with no EntryPoint. */
  async function deployWithAccount() {
    const { implementation, factory } = await deploySystem();
    await factory.write.createAccount([owner.account.address]);
    const accountAddress = await factory.read.getAddress([owner.account.address]);
    const account = await viem.getContractAt("SmartAccount", accountAddress);
    return { implementation, factory, account, accountAddress };
  }

  /** Deploy factory + create an account pre-configured with a mock EntryPoint. */
  async function deployWithEntryPointAccount() {
    const { factory } = await deploySystem();
    const ep = fakeEntryPoint.account.address;

    await factory.write.createAccountWithEntryPoint([owner.account.address, ep]);
    const accountAddress = await factory.read.getAddressWithEntryPoint([
      owner.account.address,
      ep,
    ]);
    const account = await viem.getContractAt("SmartAccount", accountAddress);

    // Contract instance that sends transactions as the fake EntryPoint
    const accountAsEP = await viem.getContractAt("SmartAccount", accountAddress, {
      client: { wallet: fakeEntryPoint },
    });

    return { factory, account, accountAsEP, accountAddress, ep };
  }

  // =========================================================================
  // Factory
  // =========================================================================

  describe("SmartAccountFactory", async function () {
    it("predicts the correct address and deploys via createAccount", async function () {
      const { factory } = await deploySystem();
      const user = getAddress(owner.account.address);

      const predicted = await factory.read.getAddress([user]);

      await viem.assertions.emitWithArgs(
        factory.write.createAccount([user]),
        factory,
        "AccountCreated",
        [user, predicted],
      );

      // Address should now have code
      const code = await publicClient.getBytecode({ address: predicted });
      assert.ok(code && code.length > 2, "deployed account has no code");
    });

    it("predicts the correct address and deploys via createAccountWithEntryPoint", async function () {
      const { factory } = await deploySystem();
      const user = getAddress(owner.account.address);
      const ep   = getAddress(fakeEntryPoint.account.address);

      const predicted = await factory.read.getAddressWithEntryPoint([user, ep]);

      await factory.write.createAccountWithEntryPoint([user, ep]);

      const code = await publicClient.getBytecode({ address: predicted });
      assert.ok(code && code.length > 2, "deployed account has no code");
    });

    it("is idempotent — calling createAccount twice returns the same address", async function () {
      const { factory } = await deploySystem();
      const user = owner.account.address;

      await factory.write.createAccount([user]);
      const first = await factory.read.getAddress([user]);

      // Second call must not revert and must return the same address
      await factory.write.createAccount([user]);
      const second = await factory.read.getAddress([user]);

      assert.equal(first, second);
    });

    it("same owner gets different addresses for different EntryPoints (salt includes entryPoint)", async function () {
      const { factory } = await deploySystem();
      const user = owner.account.address;
      const ep1  = fakeEntryPoint.account.address;
      const ep2  = stranger.account.address; // just a different address

      const addr1 = await factory.read.getAddressWithEntryPoint([user, ep1]);
      const addr2 = await factory.read.getAddressWithEntryPoint([user, ep2]);

      assert.notEqual(addr1, addr2, "same address for different EntryPoints");
    });

    it("owner can update implementation", async function () {
      const { factory, implementation } = await deploySystem();

      // Deploy a fresh implementation to use as the replacement
      const newImpl = await viem.deployContract("SmartAccount");

      await viem.assertions.emitWithArgs(
        factory.write.updateImplementation([newImpl.address]),
        factory,
        "ImplementationUpdated",
        [getAddress(newImpl.address)],
      );

      assert.equal(
        (await factory.read.implementation()).toLowerCase(),
        newImpl.address.toLowerCase(),
      );
    });

    it("non-owner cannot update implementation", async function () {
      const { factory } = await deploySystem();
      const newImpl = await viem.deployContract("SmartAccount");

      const factoryAsStranger = await viem.getContractAt(
        "SmartAccountFactory",
        factory.address,
        { client: { wallet: stranger } },
      );

      await assert.rejects(
        factoryAsStranger.write.updateImplementation([newImpl.address]),
        /OwnableUnauthorizedAccount|revert/,
      );
    });
  });

  // =========================================================================
  // Initialization
  // =========================================================================

  describe("SmartAccount initialisation", async function () {
    it("sets owner correctly after createAccount", async function () {
      const { account } = await deployWithAccount();
      const storedOwner = await account.read.owner();
      assert.equal(
        storedOwner.toLowerCase(),
        owner.account.address.toLowerCase(),
      );
    });

    it("sets owner and entryPoint correctly after createAccountWithEntryPoint", async function () {
      const { account, ep } = await deployWithEntryPointAccount();
      const storedOwner = await account.read.owner();
      const storedEP    = await account.read.entryPoint();
      assert.equal(storedOwner.toLowerCase(), owner.account.address.toLowerCase());
      assert.equal(storedEP.toLowerCase(),    ep.toLowerCase());
    });

    it("owner can update the entryPoint", async function () {
      const { account } = await deployWithEntryPointAccount();
      const newEP = stranger.account.address;

      await viem.assertions.emitWithArgs(
        account.write.setEntryPoint([newEP]),
        account,
        "EntryPointUpdated",
        [getAddress(newEP)],
      );

      assert.equal(
        (await account.read.entryPoint()).toLowerCase(),
        newEP.toLowerCase(),
      );
    });

    it("setEntryPoint rejects zero address", async function () {
      const { account } = await deployWithEntryPointAccount();
      await assert.rejects(
        account.write.setEntryPoint(["0x0000000000000000000000000000000000000000"]),
        /INVALID_ENTRY_POINT/,
      );
    });

    it("non-owner cannot call setEntryPoint", async function () {
      const { accountAddress } = await deployWithEntryPointAccount();
      const accountAsStranger = await viem.getContractAt(
        "SmartAccount",
        accountAddress,
        { client: { wallet: stranger } },
      );
      await assert.rejects(
        accountAsStranger.write.setEntryPoint([stranger.account.address]),
        /UNAUTHORIZED|revert/,
      );
    });
  });

  // =========================================================================
  // execute
  // =========================================================================

  describe("execute", async function () {
    it("owner can execute an ETH transfer and balance updates", async function () {
      const { account, accountAddress } = await deployWithAccount();
      const recipient = getAddress("0x0000000000000000000000000000000000000123");
      const amount    = parseEther("1");

      await owner.sendTransaction({ to: accountAddress, value: amount });
      await account.write.execute([recipient, amount, "0x"]);

      assert.equal(
        await publicClient.getBalance({ address: recipient }),
        amount,
      );
    });

    it("entryPoint can also call execute", async function () {
      const { accountAsEP, accountAddress } = await deployWithEntryPointAccount();
      const recipient = getAddress("0x0000000000000000000000000000000000000456");
      const amount    = parseEther("0.5");

      await owner.sendTransaction({ to: accountAddress, value: amount });
      await accountAsEP.write.execute([recipient, amount, "0x"]);

      assert.equal(
        await publicClient.getBalance({ address: recipient }),
        amount,
      );
    });

    it("stranger cannot execute", async function () {
      const { accountAddress } = await deployWithAccount();
      const accountAsStranger = await viem.getContractAt(
        "SmartAccount",
        accountAddress,
        { client: { wallet: stranger } },
      );

      await assert.rejects(
        accountAsStranger.write.execute([stranger.account.address, 0n, "0x"]),
        /UNAUTHORIZED_CALLER/,
      );
    });

    it("self-call is blocked", async function () {
      const { account, accountAddress } = await deployWithAccount();
      await assert.rejects(
        account.write.execute([accountAddress, 0n, "0x"]),
        /SELF_CALL_NOT_ALLOWED/,
      );
    });

    it("reverts bubble up from the inner call", async function () {
      // Calling a random EOA with calldata that cannot be executed will revert
      const { account } = await deployWithAccount();
      // Sending value > account balance should revert
      await assert.rejects(
        account.write.execute([stranger.account.address, parseEther("999"), "0x"]),
      );
    });
  });

  // =========================================================================
  // executeBatch
  // =========================================================================

  describe("executeBatch", async function () {
    it("executes multiple calls atomically", async function () {
      const { account, accountAddress } = await deployWithAccount();
      const r1 = getAddress("0x0000000000000000000000000000000000000aaa");
      const r2 = getAddress("0x0000000000000000000000000000000000000bbb");
      const half = parseEther("1");

      await owner.sendTransaction({ to: accountAddress, value: parseEther("2") });

      await account.write.executeBatch([
        [r1, r2],
        [half, half],
        ["0x", "0x"],
      ]);

      assert.equal(await publicClient.getBalance({ address: r1 }), half);
      assert.equal(await publicClient.getBalance({ address: r2 }), half);
    });

    it("reverts entire batch if one call fails", async function () {
      const { account, accountAddress } = await deployWithAccount();
      const r1 = getAddress("0x0000000000000000000000000000000000000ccc");

      await owner.sendTransaction({ to: accountAddress, value: parseEther("1") });

      // Second call sends more than account holds → whole batch reverts
      await assert.rejects(
        account.write.executeBatch([
          [r1, r1],
          [parseEther("0.5"), parseEther("999")],
          ["0x", "0x"],
        ]),
      );

      // r1 should have received nothing
      assert.equal(await publicClient.getBalance({ address: r1 }), 0n);
    });

    it("rejects mismatched array lengths", async function () {
      const { account } = await deployWithAccount();
      await assert.rejects(
        account.write.executeBatch([
          [stranger.account.address],
          [0n, 0n], // length mismatch
          ["0x"],
        ]),
        /LENGTH_MISMATCH|VALUES_LENGTH_MISMATCH/,
      );
    });

    it("stranger cannot call executeBatch", async function () {
      const { accountAddress } = await deployWithAccount();
      const accountAsStranger = await viem.getContractAt(
        "SmartAccount",
        accountAddress,
        { client: { wallet: stranger } },
      );
      await assert.rejects(
        accountAsStranger.write.executeBatch([[], [], []]),
        /UNAUTHORIZED_CALLER/,
      );
    });
  });

  // =========================================================================
  // ERC-20 helpers
  // =========================================================================

  describe("ERC-20 helpers", async function () {
    it("transferERC20 moves tokens and emits event", async function () {
      const { account, accountAddress } = await deployWithAccount();
      const usdc = await viem.deployContract("MockUSDC");
      const amount = 500_000n; // 0.5 USDC

      await usdc.write.mint([accountAddress, amount]);

      await viem.assertions.emitWithArgs(
        account.write.transferERC20([
          usdc.address,
          stranger.account.address,
          amount,
        ]),
        account,
        "ERC20Transferred",
        [getAddress(usdc.address), getAddress(stranger.account.address), amount],
      );

      assert.equal(
        await usdc.read.balanceOf([stranger.account.address]),
        amount,
      );
    });

    it("getERC20Balance returns correct balance", async function () {
      const { account, accountAddress } = await deployWithAccount();
      const usdc = await viem.deployContract("MockUSDC");
      const amount = 1_000_000n;

      await usdc.write.mint([accountAddress, amount]);

      assert.equal(
        await account.read.getERC20Balance([usdc.address]),
        amount,
      );
    });

    it("transferERC20 rejects zero address token", async function () {
      const { account } = await deployWithAccount();
      await assert.rejects(
        account.write.transferERC20([
          "0x0000000000000000000000000000000000000000",
          stranger.account.address,
          1n,
        ]),
        /INVALID_TOKEN/,
      );
    });

    it("transferERC20 rejects zero address recipient", async function () {
      const { account } = await deployWithAccount();
      const usdc = await viem.deployContract("MockUSDC");
      await assert.rejects(
        account.write.transferERC20([
          usdc.address,
          "0x0000000000000000000000000000000000000000",
          1n,
        ]),
        /INVALID_RECIPIENT/,
      );
    });

    it("stranger cannot call transferERC20", async function () {
      const { accountAddress } = await deployWithAccount();
      const usdc = await viem.deployContract("MockUSDC");

      const accountAsStranger = await viem.getContractAt(
        "SmartAccount",
        accountAddress,
        { client: { wallet: stranger } },
      );

      await assert.rejects(
        accountAsStranger.write.transferERC20([
          usdc.address,
          stranger.account.address,
          1n,
        ]),
        /UNAUTHORIZED|revert/,
      );
    });
  });

  // =========================================================================
  // validateUserOp
  // =========================================================================

  describe("validateUserOp", async function () {
    function makeBaseUserOp(sender: string, nonce = 0n) {
      return {
        sender: sender as `0x${string}`,
        nonce,
        initCode: "0x" as `0x${string}`,
        callData: "0x" as `0x${string}`,
        accountGasLimits: ("0x" + "0".repeat(64)) as `0x${string}`,
        preVerificationGas: 0n,
        gasFees: ("0x" + "0".repeat(64)) as `0x${string}`,
        paymasterAndData: "0x" as `0x${string}`,
        signature: "0x" as `0x${string}`,
      };
    }

    it("increments nonce sequence on valid signature", async function () {
      const { account, accountAsEP, accountAddress } = await deployWithEntryPointAccount();
      const userOpHash = keccak256(toHex("valid-userop"));
      const sig = await owner.signMessage({ message: { raw: userOpHash } });

      const userOp = {
        ...makeBaseUserOp(accountAddress, 0n),
        signature: sig,
      };

      await accountAsEP.write.validateUserOp([userOp, userOpHash, 0n]);
      assert.equal(await account.read.getNonce([0n]), 1n);
    });

    it("does not increment nonce on invalid signature", async function () {
      const { account, accountAsEP, accountAddress } = await deployWithEntryPointAccount();
      const userOpHash = keccak256(toHex("invalid-sig"));
      const wrongSig = await stranger.signMessage({ message: { raw: userOpHash } });

      const userOp = {
        ...makeBaseUserOp(accountAddress, 0n),
        signature: wrongSig,
      };

      await accountAsEP.write.validateUserOp([userOp, userOpHash, 0n]);
      assert.equal(await account.read.getNonce([0n]), 0n);
    });

    it("rejects invalid sender", async function () {
      const { accountAsEP } = await deployWithEntryPointAccount();
      const userOpHash = keccak256(toHex("invalid-sender"));
      const sig = await owner.signMessage({ message: { raw: userOpHash } });

      const userOp = {
        ...makeBaseUserOp(stranger.account.address, 0n),
        signature: sig,
      };

      await assert.rejects(
        accountAsEP.write.validateUserOp([userOp, userOpHash, 0n]),
        /INVALID_SENDER/,
      );
    });

    it("detects nonce replay and keeps sequence unchanged", async function () {
      const { account, accountAsEP, accountAddress } = await deployWithEntryPointAccount();

      const firstHash = keccak256(toHex("first-op"));
      const firstSig = await owner.signMessage({ message: { raw: firstHash } });
      const first = {
        ...makeBaseUserOp(accountAddress, 0n),
        signature: firstSig,
      };
      await accountAsEP.write.validateUserOp([first, firstHash, 0n]);
      assert.equal(await account.read.getNonce([0n]), 1n);

      const replayHash = keccak256(toHex("replay-op"));
      const replaySig = await owner.signMessage({ message: { raw: replayHash } });
      const replay = {
        ...makeBaseUserOp(accountAddress, 0n),
        signature: replaySig,
      };
      await accountAsEP.write.validateUserOp([replay, replayHash, 0n]);
      assert.equal(await account.read.getNonce([0n]), 1n);
    });
  });

  // =========================================================================
  // 2D Nonce
  // =========================================================================

  describe("getNonce", async function () {
    it("returns 0 for key=0 on a fresh account", async function () {
      const { account } = await deployWithAccount();
      assert.equal(await account.read.getNonce([0n]), 0n);
    });

    it("packs key and sequence correctly", async function () {
      const { account } = await deployWithAccount();
      const key = 42n;
      // packed nonce = (key << 64) | sequence(0)
      const expected = (key << 64n) | 0n;
      assert.equal(await account.read.getNonce([key]), expected);
    });
  });

  // =========================================================================
  // receive / fallback
  // =========================================================================

  describe("receive / fallback", async function () {
    it("accepts plain ETH transfers", async function () {
      const { accountAddress } = await deployWithAccount();
      const amount = parseEther("1");

      await owner.sendTransaction({ to: accountAddress, value: amount });

      assert.equal(
        await publicClient.getBalance({ address: accountAddress }),
        amount,
      );
    });
  });
});