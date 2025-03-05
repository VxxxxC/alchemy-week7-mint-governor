const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  //NOTE: get the PROVIDER from Alchemy, and set the network as Sepolia
  const provider = ethers.getDefaultProvider("sepolia", {
    alchemy: process.env.ALCHEMY_SEPOLIA_API,
  });

  //NOTE: get signer from wallet private key and the provider
  const owner = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

  const transactionCount = await owner.getTransactionCount();

  // gets the address of the token before it is deployed
  const futureAddress = ethers.utils.getContractAddress({
    from: owner.address,
    nonce: transactionCount + 1,
  });

  const MyGovernor = await ethers.getContractFactory("MyGovernor");
  const governor = await MyGovernor.deploy(futureAddress);

  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy(governor.address);

  const delegate = await token.delegate(owner.address);

  console.log(
    `Governor deployed to ${governor.address}`,
    `Token deployed to ${token.address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
