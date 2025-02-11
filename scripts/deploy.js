const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const provider = ethers.getDefaultProvider("sepolia", {
    alchemy: process.env.ALCHEMY_SEPOLIA_API,
  });

  const owner = new ethers.Wallet(process.env.WALLLET_PRIVATE_KEY, provider);

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

  console.log(
    `Governor deployed to ${governor.address}`,
    `Token deployed to ${token.address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
