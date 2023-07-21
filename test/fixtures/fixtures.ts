import { Wallet, Contract, BigNumber } from 'ethers';
import { Web3Provider } from '@ethersproject/providers';
import { deployContract } from 'ethereum-waffle';
import ERC20 from '../../artifacts/contracts/tests/WSERC20.sol/WSERC20.json';
import FarmingRewards from '../../artifacts/contracts/FarmingRewards.sol/FarmingRewards.json';
import testToken from '../../artifacts/contracts/tests/TestToken.sol/TestToken.json'

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

interface FarmingRewardsFixture {
    farmingRewards: Contract;
    stakingToken: Contract;
    rewardToken: Contract;
}

export async function FarmingRewardsFixture([wallet]: Wallet[], provider: Web3Provider): Promise<FarmingRewardsFixture> {
    const farmingRewards = await deployContract(wallet, FarmingRewards);
    const stakingToken = await deployContract(wallet, testToken);
    const rewardToken = await deployContract(wallet, testToken);
    return {
        farmingRewards,
        stakingToken,
        rewardToken
    };
}
