const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  if (!process.env.ALCHEMY_SEPOLIA_API_URL || !process.env.WALLET_PRIVATE_KEY) {
    throw new Error(
      "Missing required environment variables: ALCHEMY_SEPOLIA_API_URL and WALLET_PRIVATE_KEY"
    );
  }

  //NOTE: get the PROVIDER from Alchemy, and set the network as Sepolia
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_SEPOLIA_API_URL);

  //NOTE: get signer from wallet private key and the provider
  const owner = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

  const transactionCount = await owner.getNonce();

  // gets the address of the governor before it is deployed (at nonce+1)
  const futureGovernorAddress = ethers.getCreateAddress({
    from: owner.address,
    nonce: transactionCount + 1,
  });

  // Deploy token first (at nonce+0) with the governor's future address
  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy(futureGovernorAddress);

  // Deploy governor second (at nonce+1) with the already-deployed token
  const MyGovernor = await ethers.getContractFactory("MyGovernor");
  const governor = await MyGovernor.deploy(token.target);

  const delegate = await token.delegate(owner.address);

  console.log(
    `Governor deployed to ${governor.target}`,
    `Token deployed to ${token.target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
