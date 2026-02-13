require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ...(process.env.ALCHEMY_SEPOLIA_API_URL && process.env.WALLET_PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.ALCHEMY_SEPOLIA_API_URL,
            accounts: [process.env.WALLET_PRIVATE_KEY],
          },
        }
      : {}),
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_SEPOLIA_API || "",
  },
};
