import { network } from "hardhat";
import dotenv from "dotenv";
dotenv.config({ path: "/etc/secrets/pocket.env" });

async function main() {
  const connection = (await network.connect()) as any;
  const viem = connection.viem;
  const publicClient = await viem.getPublicClient();

  const factoryAddress = process.env.POCKET_FACTORY_ETHEREUM_SEPOLIA || "0xFD6EacA961d88FF0422898CDBb284f963D613369";
  const paymasterAddress = process.env.POCKET_PAYMASTER_ETHEREUM_SEPOLIA || "0x7F1BE467e9f0c2731ab9E8a646cF5972E71A66d8";
  const expectedEntryPoint = process.env.POCKET_ENTRY_POINT_ETHEREUM_SEPOLIA || "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
    
  const factoryCode = await publicClient.getBytecode({ address: factoryAddress as `0x${string}` });
  const paymasterCode = await publicClient.getBytecode({ address: paymasterAddress as `0x${string}` });

  if (!factoryCode || factoryCode.length <= 2) {
    throw new Error(`Factory has no code at ${factoryAddress}`);
  }

  if (!paymasterCode || paymasterCode.length <= 2) {
    throw new Error(`Paymaster has no code at ${paymasterAddress}`);
  }

  const paymaster = await viem.getContractAt("USDCPaymaster", paymasterAddress as `0x${string}`);
  const entryPoint = await paymaster.read.entryPoint();
  const signer = await paymaster.read.paymasterSigner();
  const trusted = await paymaster.read.trustedFactories([factoryAddress as `0x${string}`]);
  const deposit = await paymaster.read.getDeposit();

  if (entryPoint.toLowerCase() !== expectedEntryPoint.toLowerCase()) {
    throw new Error(`Paymaster entry point mismatch. expected=${expectedEntryPoint} actual=${entryPoint}`);
  }
  if (signer.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    throw new Error("Paymaster signer is zero address");
  }
  if (!trusted) {
    throw new Error("Factory is not trusted in paymaster");
  }
  if (deposit <= 0n) {
    throw new Error("Paymaster deposit is empty");
  }

  console.log("Sepolia sponsorship preconditions look good.");
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Paymaster: ${paymasterAddress}`);
  console.log(`EntryPoint: ${entryPoint}`);
  console.log(`Signer: ${signer}`);
  console.log(`Deposit: ${deposit.toString()} wei`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
