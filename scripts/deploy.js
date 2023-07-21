import { ethers } from "hardhat";

async function main() {
    const currentTimestampInSeconds = Math.round(Date.now() / 1000);
    const unlockTime = currentTimestampInSeconds + 60;

    const lockedAmount = ethers.utils.parseEther("0.001");

    let wsUnlockCommissionPercent = 10;
    let lockAmount = 500000000000000000000000;
    let timelock = '0x86523B1Fa41a928f5179F594c2cE04fCdE57D3CE';
    let whiteswapV2Factory = '0x3F0B5743BBa8A552a3aa1e7907f4F44047e93F8f';

    console.log(
        `Lock with ${ethers.utils.formatEther(lockedAmount)}ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});