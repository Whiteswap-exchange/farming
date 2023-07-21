import fs from 'fs'

import { Wallet } from 'ethers'
import { InfuraProvider } from '@ethersproject/providers'
import hre, { ethers } from "hardhat";
import { BN } from "ethereumjs-util";

export let overrides = {
  gasPrice: 130000000000,
  nonce: 0
}

async function deployFarmingRewardFactory(
    wallet: Wallet,
    factoryAddress: string,
    timelock: string,
    wsd: string,
    lockAmount: number,
    wsUnlockCommissionPercent: number,
) {
  const FarmingRewardsFactory = await ethers.getContractFactory("FarmingRewardsFactory");

  const farmingRewardsFactory = await FarmingRewardsFactory.deploy(
      wsUnlockCommissionPercent,
      lockAmount.toString(),
      wsd,
      timelock,
      factoryAddress,
  );

  await farmingRewardsFactory.deployed();

  overrides['nonce'] += 1

  console.log('Arguments: ' +
    farmingRewardsFactory.address + " " +
    wallet.address + " " +
    wsUnlockCommissionPercent + " " +
    lockAmount.toString(),  + " " +
    wsd  + " " +
    timelock  + " " +
    factoryAddress +  " "
  )

  console.log('Factory Contract address: ' + farmingRewardsFactory.address)

  console.log('..Waiting for bytecode of contract..')

  await sleep(30000);

  await hre.run("verify:verify", {
    address: farmingRewardsFactory.address,
    constructorArguments: [
      wsUnlockCommissionPercent,
      lockAmount.toString(),
      wsd,
      timelock,
      factoryAddress,
    ],
  });
}

export async function makeDeploy(
    networkName: string,
    infuraId: string,
    wsd: string,
    secretKey: string,
    factoryAddress: string,
    timelock: string,
    lockAmount: number,
    wsUnlockCommissionPercent: number,
) {
  try {
    let web3Provider = new InfuraProvider(networkName, infuraId)

    let wallet = new Wallet(secretKey, web3Provider)
    overrides['nonce'] = await wallet.getTransactionCount()

    await deployFarmingRewardFactory(
        wallet,
        factoryAddress,
        timelock,
        wsd,
        lockAmount,
        wsUnlockCommissionPercent
    )


  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }
}

function sleep(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
