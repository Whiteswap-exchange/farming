import { task } from "hardhat/config";
import dotenv from "dotenv";
import "@nomiclabs/hardhat-waffle";
import "@nomicfoundation/hardhat-verify";
import 'solidity-coverage';

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
dotenv.config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
});

module.exports = {
  gasReporter: {
    enabled: true,
  },
  networks: {
    hardhat: {
      allowBlocksWithSameTimestamp: true,
      blockGasLimit: 30_000_000 // Network block gasLimit
    },
    goerli : {
      url: `https://goerli.infura.io/v3/` + process.env.INFURA_API_KEY,
      accounts: [process.env.PRIVATE_KEY],
    }
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY,
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {},
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
      },
      },
    ],
  },
};
