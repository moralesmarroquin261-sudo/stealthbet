import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying StealthBet contract...");

  // Get the deployer account
  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("No signers available. Check your private key in .env file.");
  }
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  console.log("📝 Deploying with account:", deployerAddress);

  // Get the contract factory
  const StealthBet = await ethers.getContractFactory("StealthBet");

  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const stealthBet = await StealthBet.deploy();
  await stealthBet.waitForDeployment();

  const contractAddress = await stealthBet.getAddress();
  console.log("✅ StealthBet deployed to:", contractAddress);
  
  // Save deployment info
  console.log("\n📋 Deployment Summary:");
  console.log("========================");
  console.log("Contract Address:", contractAddress);
  console.log("Network: Sepolia Testnet");
  console.log("Deployer:", deployerAddress);
  console.log("========================\n");
  
  console.log("💡 Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error deploying contract:", error);
    process.exit(1);
  });

