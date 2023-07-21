import chai, {expect} from 'chai';
import {Contract, BigNumber} from 'ethers';
import {solidity, MockProvider} from 'ethereum-waffle';
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BN} from "BN.js";
import {setBlockGasLimit, time} from "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-web3";

chai.use(solidity);

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

describe('FarmingRewards', () => {
    const approveAmount = expandTo18Decimals(110);
    const zeroAddress = '0x0000000000000000000000000000000000000000';


    // new Signer


    let stakingToken: Contract;
    let farmingRewards: Contract;
    let owner: SignerWithAddress;
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let account4: SignerWithAddress;
    let account5: SignerWithAddress;
    let account6: SignerWithAddress;
    let account7: SignerWithAddress;
    let account8: SignerWithAddress;
    let provider: MockProvider;
    let rewardAmount: string;
    let startDate: number;
    let endDate: number;
    let epochDuration: number;
    let stakeAmount: BigNumber;
    let halfStakeAmount: BigNumber;
    let stakeAmountSecond: BigNumber;
    let verifyAmount: BigNumber;
    let minimumStakingExitTime: number;

    describe('functionality tests', () => {

        let rewardToken: Contract;
        beforeEach(async () => {
            [owner, account1, account2, account3, account4, account5, account6, account7, account8] = await ethers.getSigners();
            const RewardToken = await ethers.getContractFactory("TestToken");
            rewardToken = await RewardToken.deploy();
            rewardAmount = expandTo18Decimals(1).toString();

            const StakingToken = await ethers.getContractFactory("TestToken");
            stakingToken = await StakingToken.deploy();

            minimumStakingExitTime = 100;

            stakeAmount = expandTo18Decimals(10);
            halfStakeAmount = expandTo18Decimals(5);
            stakeAmountSecond = expandTo18Decimals(100);
            verifyAmount = expandTo18Decimals(110);
            startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;
            epochDuration = 604800;
            endDate = startDate + epochDuration;
            const FarmingRewards = await ethers.getContractFactory("FarmingRewards");
            farmingRewards = await FarmingRewards.deploy(
                account5.address,
                owner.address,
                rewardToken.address,
                stakingToken.address,
                rewardAmount,
                startDate + 1,
                endDate,
                epochDuration,
                minimumStakingExitTime
            );
            await farmingRewards.deployed();

            await rewardToken.transfer(farmingRewards.address, rewardAmount)

            await stakingToken.connect(owner).transfer(account1.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account2.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account3.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account4.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account5.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account6.address, stakeAmount.toString())
            await stakingToken.connect(owner).transfer(account7.address, stakeAmount.toString())

            await stakingToken.connect(owner).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account1).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account2).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account3).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account4).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account4).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account5).approve(farmingRewards.address, stakeAmountSecond.toString())
            await stakingToken.connect(account6).approve(farmingRewards.address, stakeAmountSecond.toString())

            await rewardToken.connect(owner).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account1).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account2).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account3).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account4).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account4).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account5).approve(farmingRewards.address, stakeAmountSecond.toString())
            await rewardToken.connect(account6).approve(farmingRewards.address, stakeAmountSecond.toString())
        })

        describe('success cases', async () => {


            it('create epoch', async () => {
                await time.increaseTo(endDate + 1);

                let rewardRate = (new BN(rewardAmount).div(new BN(epochDuration)))
                let rewardForDuration = rewardRate.mul(new BN(endDate).sub(new BN(startDate +1))).toString()
                expect((await farmingRewards.rewardToken()).toString()).to.be.eq(rewardToken.address)
                expect((await farmingRewards.startDate())).to.be.eq(startDate + 1)
                expect((await farmingRewards.endDate())).to.be.eq(endDate)
                expect((await farmingRewards.epochDuration())).to.be.eq(epochDuration)
                expect((await farmingRewards.minimumStakingExitTime())).to.be.eq(minimumStakingExitTime)
                expect((await farmingRewards.rewardAmount())).to.be.eq(rewardAmount)
                expect((await farmingRewards.rewardRate())).to.be.eq(rewardRate.toNumber())
                expect((await farmingRewards.currentCountAccounts())).to.be.eq(0)
                expect((await farmingRewards.distributedTokens())).to.be.eq(0)
                expect((await farmingRewards.totalSupply())).to.be.eq(0)
                expect((await farmingRewards.balanceOfStakingToken(owner.address))).to.be.eq(0)
                expect((await farmingRewards.getRewardForDuration()).toString()).to.be.eq(rewardForDuration)
                expect((await farmingRewards.lastTimeRewardApplicable()).toNumber()).to.be.eq(endDate)
                expect((await farmingRewards.rewardPerToken()).toNumber()).to.be.eq(0)
            })

            it('1 account farm 100% of time plus params', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 2
                epochDuration = 604800;
                endDate = startDate + epochDuration;


                await time.increaseTo(startDate);
                await farmingRewards.connect(account1).farm(stakeAmount)

                let rewardRate = (new BN(rewardAmount).div(new BN(epochDuration)))
                let rewardForDuration = rewardRate.mul(new BN(endDate).sub(new BN(startDate))).toString()

                await time.increaseTo(endDate + 1);

                let accountId = 1;
                let totalSupplyBefore = await farmingRewards.totalSupply();
                let currentCountAccounts = await farmingRewards.currentCountAccounts();
                let accountIdByAddress = await farmingRewards.accountIdByAddress(account1.address);
                let accountAddressById = await farmingRewards.accountAddressById(accountId);
                let accountEnterFarm = await farmingRewards.accountEnterFarm(account1.address);
                let balanceOfStakingToken = await farmingRewards.balanceOfStakingToken(account1.address);

                let toReceiveAccount = await farmingRewards.earned(account1.address);

                await farmingRewards.connect(account1).exit()

                let totalSupplyAfter = await farmingRewards.totalSupply();
                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();

                expect(totalSupplyBefore).to.be.eq(stakeAmount)
                expect(totalSupplyAfter).to.be.eq(0)
                expect(currentCountAccounts).to.be.eq(1)
                expect(accountIdByAddress).to.be.eq(accountId)
                expect(accountAddressById).to.be.eq(account1.address)
                expect(accountEnterFarm).to.be.eq(startDate)
                expect(account1BalanceAfter).to.be.eq(toReceiveAccount)
                expect(balanceOfStakingToken).to.be.eq(stakeAmount)
            })

            it('farming factory start farm, farm moved to farm', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let finalBalance = '999999998346560753760';
                await time.increaseTo(startDate);

                await farmingRewards.connect(account5).farm(stakeAmount)

                let rewardRate = (new BN(rewardAmount).div(new BN(epochDuration)))
                let rewardForDuration = rewardRate.mul(new BN(endDate).sub(new BN(startDate))).toString()

                await time.increaseTo(endDate + 1);

                let accountId = 1;
                let totalSupplyBefore = await farmingRewards.totalSupply();
                let currentCountAccounts = await farmingRewards.currentCountAccounts();
                let accountIdByAddress = await farmingRewards.accountIdByAddress(owner.address);
                let accountAddressById = await farmingRewards.accountAddressById(accountId);
                let accountEnterFarm = await farmingRewards.accountEnterFarm(owner.address);
                let balanceOfStakingToken = await farmingRewards.balanceOfStakingToken(owner.address);

                await farmingRewards.connect(owner).exit()
                await farmingRewards.connect(account5).exit()

                let totalSupplyAfter = await farmingRewards.totalSupply();
                let account5BalanceAfter = (await rewardToken.balanceOf(account5.address)).toString();
                let ownerBalanceAfter = (await rewardToken.balanceOf(owner.address)).toString();
                expect(totalSupplyBefore).to.be.eq(stakeAmount)
                expect(totalSupplyAfter).to.be.eq(0)
                expect(currentCountAccounts).to.be.eq(1)
                expect(accountIdByAddress).to.be.eq(accountId)
                expect(accountAddressById).to.be.eq(owner.address)
                expect(ownerBalanceAfter).to.be.eq(finalBalance)
                expect(account5BalanceAfter).to.be.eq('0')
                expect(balanceOfStakingToken).to.be.eq(stakeAmount)
            })


            it('1 account farm 100% of time, withdraw 50% in middle, plus params', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 2
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)

                await time.increaseTo(startDate + (epochDuration / 2));
                await farmingRewards.connect(account1).withdraw(halfStakeAmount)

                await time.increaseTo(endDate + 1);
                let accountId = 1;
                let totalSupplyBefore = await farmingRewards.totalSupply();
                let currentCountAccounts = await farmingRewards.currentCountAccounts();
                let accountIdByAddress = await farmingRewards.accountIdByAddress(account1.address);
                let accountAddressById = await farmingRewards.accountAddressById(accountId);
                let accountEnterFarm = await farmingRewards.accountEnterFarm(account1.address);

                let totalSupplyAfter = await farmingRewards.totalSupply();
                let account1BalanceAfterReward = await rewardToken.balanceOf(account1.address);
                let account1BalanceAfterStaking = (await stakingToken.balanceOf(account1.address)).toString();

                expect(totalSupplyBefore).to.be.eq(halfStakeAmount)
                expect(totalSupplyAfter).to.be.eq(halfStakeAmount)
                expect(currentCountAccounts).to.be.eq(1)
                expect(accountIdByAddress).to.be.eq(accountId)
                expect(accountAddressById).to.be.eq(account1.address)
                expect(accountEnterFarm).to.be.eq(startDate)
                expect(account1BalanceAfterReward).to.be.eq(0)
                expect(account1BalanceAfterStaking).to.be.eq(halfStakeAmount)
            })

            it('2 accounts farm 100% of time plus params', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate + 1);

                let toReceiveAccount1 = await farmingRewards.earned(account1.address);
                let toReceiveAccount2 = await farmingRewards.earned(account2.address);

                await farmingRewards.connect(account1).exit()
                await farmingRewards.connect(account2).exit()

                let accountId = 1;
                let currentCountAccounts = await farmingRewards.currentCountAccounts();
                let accountIdByAddress1 = await farmingRewards.accountIdByAddress(account1.address);
                let accountIdByAddress2 = await farmingRewards.accountIdByAddress(account2.address);
                let accountAddressById1 = await farmingRewards.accountAddressById(accountId);
                let accountAddressById2 = await farmingRewards.accountAddressById(accountId);
                let accountEnterFarm = await farmingRewards.accountEnterFarm(account1.address);

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();


                expect(currentCountAccounts).to.be.eq(2)
                expect(accountIdByAddress1).to.be.eq(0)
                expect(accountAddressById1).to.be.eq(zeroAddress)

                expect(accountIdByAddress2).to.be.eq(0)
                expect(accountAddressById2).to.be.eq(zeroAddress)

                expect(accountEnterFarm).to.be.eq(0)

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
            })

            it('2 accounts farm 100% of time plus params', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate + 1);

                let toReceiveAccount1 = await farmingRewards.earned(account1.address);
                let toReceiveAccount2 = await farmingRewards.earned(account2.address);

                await farmingRewards.connect(account1).exit()
                await farmingRewards.connect(account2).exit()

                let accountId = 1;
                let currentCountAccounts = await farmingRewards.currentCountAccounts();
                let accountIdByAddress1 = await farmingRewards.accountIdByAddress(account1.address);
                let accountIdByAddress2 = await farmingRewards.accountIdByAddress(account2.address);
                let accountAddressById1 = await farmingRewards.accountAddressById(accountId);
                let accountAddressById2 = await farmingRewards.accountAddressById(accountId);
                let accountEnterFarm = await farmingRewards.accountEnterFarm(account1.address);

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();


                expect(currentCountAccounts).to.be.eq(2)
                expect(accountIdByAddress1).to.be.eq(0)
                expect(accountAddressById1).to.be.eq(zeroAddress)

                expect(accountIdByAddress2).to.be.eq(0)
                expect(accountAddressById2).to.be.eq(zeroAddress)

                expect(accountEnterFarm).to.be.eq(0)

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
            })


            it('3 accounts farm 100% of time', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)
                await farmingRewards.connect(account3).farm(stakeAmount)

                await time.increaseTo(endDate + 1);

                let toReceiveAccount1 = await farmingRewards.earned(account1.address);
                let toReceiveAccount2 = await farmingRewards.earned(account2.address);
                let toReceiveAccount3 = await farmingRewards.earned(account3.address);

                await farmingRewards.connect(account1).exit()
                await farmingRewards.connect(account2).exit()
                await farmingRewards.connect(account3).exit()

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();
                let account3BalanceAfter = (await rewardToken.balanceOf(account3.address)).toString();

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
                expect(account3BalanceAfter).to.be.eq(toReceiveAccount3)
            })

            it('1 accounts farm 50% of time, another one start farm other 50%', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                let toReceiveAccount1 = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()

                await farmingRewards.connect(account2).farm(stakeAmount)
                await time.increaseTo(endDate + 1);

                let toReceiveAccount2 = await farmingRewards.earned(account2.address);
                await farmingRewards.connect(account2).exit()

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
            })

            it('1 accounts farm 50%, in the end separated getReward', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);

                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                let toReceiveAccount1 = await farmingRewards.earned(account1.address);

                await farmingRewards.connect(account2).farm(stakeAmount)
                await time.increaseTo(endDate + 1);

                let toReceiveAccount2 = await farmingRewards.earned(account2.address);
                await farmingRewards.connect(account2).exit()
                await farmingRewards.connect(account1).getReward()

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
            })

            it('2 accounts farm 50%, in the end separated getReward', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                await farmingRewards.connect(account2).withdraw(stakeAmount)
                let toReceiveAccount1 = await farmingRewards.earned(account1.address);
                let toReceiveAccount2 = await farmingRewards.earned(account2.address);

                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).getReward()
                await farmingRewards.connect(account2).getReward()

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceAfter = (await rewardToken.balanceOf(account2.address)).toString();

                expect(account1BalanceAfter).to.be.eq(toReceiveAccount1)
                expect(account2BalanceAfter).to.be.eq(toReceiveAccount2)
            })

            it('1 account farm 100% in middle get reward', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                let toReceiveAccountBefore = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()
                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                await time.increaseTo(endDate + 1);

                let toReceiveAccountAfter = await farmingRewards.earned(account1.address);

                await farmingRewards.connect(account1).getReward()
                await farmingRewards.connect(account2).getReward()

                let account1BalanceAfter = await rewardToken.balanceOf(account1.address)

                let totalBalance = toReceiveAccountAfter.add(toReceiveAccountBefore)

                expect(toReceiveAccountBefore).to.be.eq(account1BalanceBefore)
                expect(totalBalance).to.be.eq(account1BalanceAfter)
            })

            it('2 accounts farm 100% of time, 0 leave check active users', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);


                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate);

                let activeAccounts = (await farmingRewards.connect(account1).getActiveAccountCount()).toString()

                expect(activeAccounts).to.be.eq('2')
            })

            it('getActiveAccountCount 2 accounts farm 100% of time, 1 leave check active users', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);


                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate);

                await farmingRewards.connect(account2).exit()

                let activeAccounts = (await farmingRewards.connect(account1).getActiveAccountCount()).toString()

                expect(activeAccounts).to.be.eq('1')
            })

            it('getActiveAccountCount 2 farm 1 leave', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate);

                await farmingRewards.connect(account2).exit()

                let activeAccounts = (await farmingRewards.connect(account1).getActiveAccountCount()).toString()

                expect(activeAccounts).to.be.eq('1')
            })

            it('farm1 farm2 farm1  when active,  exit1 exit2 when ended ', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account2).farm(stakeAmount)
                await farmingRewards.connect(account1).farm(stakeAmount)

                await time.increaseTo(endDate + 1);
                let earnedAccount1 = (await farmingRewards.connect(account1).earned(account1.address)).toString()
                let earnedAccount2 = (await farmingRewards.connect(account2).earned(account2.address)).toString()

                await farmingRewards.connect(account2).exit()
                await farmingRewards.connect(account1).exit()

                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceBefore = (await rewardToken.balanceOf(account2.address)).toString();

                let account1StakingBalanceAfter = await stakingToken.balanceOf(account1.address)
                let account2StakingBalanceAfter = await stakingToken.balanceOf(account2.address)

                expect(earnedAccount1).to.be.eq(account1BalanceBefore)
                expect(earnedAccount2).to.be.eq(account2BalanceBefore)

                expect(account1StakingBalanceAfter).to.be.eq(stakeAmount)
                expect(account2StakingBalanceAfter).to.be.eq(stakeAmount)
            })
            it('farm1 farm1 farm2 farm2 exit2 when active,  exit1 when ended ', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(halfFarmingPoolDuration);

                await stakingToken.connect(owner).transfer(account1.address, stakeAmountSecond.toString())
                await stakingToken.connect(owner).transfer(account2.address, stakeAmountSecond.toString())

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate - 1);
                let earnedAccount2 = (await farmingRewards.connect(account2).earned(account2.address)).toString()

                await farmingRewards.connect(account2).exit()

                await time.increaseTo(endDate + 1);
                let earnedAccount1 = (await farmingRewards.connect(account1).earned(account1.address)).toString()

                await farmingRewards.connect(account1).exit()

                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceBefore = (await rewardToken.balanceOf(account2.address)).toString();

                let account1StakingBalanceAfter = await stakingToken.balanceOf(account1.address)
                let account2StakingBalanceAfter = await stakingToken.balanceOf(account2.address)

                expect(earnedAccount1).to.be.eq(account1BalanceBefore)
                expect(earnedAccount2).to.be.eq(account2BalanceBefore)

                expect(account1StakingBalanceAfter).to.be.eq(verifyAmount)
                expect(account2StakingBalanceAfter).to.be.eq(verifyAmount)
            })
            it('farm1 farm2 exit1 exit2 while farming pool active', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate - 1);

                let earnedAccount1 = (await farmingRewards.connect(account1).earned(account1.address)).toString()
                let earnedAccount2 = (await farmingRewards.connect(account2).earned(account2.address)).toString()

                await farmingRewards.connect(account1).exit()
                await farmingRewards.connect(account2).exit()

                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                let account2BalanceBefore = (await rewardToken.balanceOf(account2.address)).toString();

                let account1StakingBalanceAfter = await stakingToken.balanceOf(account1.address)
                let account2StakingBalanceAfter = await stakingToken.balanceOf(account2.address)

                expect(earnedAccount1).to.be.eq(account1BalanceBefore)
                expect(earnedAccount2).to.be.eq(account2BalanceBefore)

                expect(account1StakingBalanceAfter).to.be.eq(stakeAmount)
                expect(account2StakingBalanceAfter).to.be.eq(stakeAmount)
            })
            it('farm 100%, end date in past getReward + withdraw', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)

                await time.increaseTo(endDate + 1);
                let toReceiveAccountBefore = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()
                await farmingRewards.connect(account1).withdraw(halfStakeAmount)
                await farmingRewards.connect(account1).exit()

                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)

                expect(toReceiveAccountBefore).to.be.eq(account1BalanceBefore)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })
            it('farm 100%, end date in past getReward + withdraw', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)

                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).getReward()
                await farmingRewards.connect(account1).withdraw(stakeAmount)

                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)

                expect(account1BalanceBefore).to.be.eq(account1BalanceBefore)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })
            it('farm 100%, end date in past withdraw + getReward', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)

                let toReceiveAccountBefore = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()
                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                await farmingRewards.connect(account1).getReward()

                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)


                expect(toReceiveAccountBefore).to.be.eq(account1BalanceBefore)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })

            it('farm 100%, end date in past withdraw + exit', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)

                let toReceiveAccountBefore = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()
                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                await farmingRewards.connect(account1).exit()

                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)


                expect(toReceiveAccountBefore).to.be.eq(account1BalanceBefore)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })

            it('early exit available unstakeAvailableDate > endDate && block.timestamp > endDate', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(endDate - 50);

                await farmingRewards.connect(account1).farm(stakeAmount)

                let toReceiveAccountBefore = await farmingRewards.earned(account1.address);
                await farmingRewards.connect(account1).getReward()
                let account1BalanceBefore = (await rewardToken.balanceOf(account1.address)).toString();
                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                await farmingRewards.connect(account1).exit()

                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)


                expect(toReceiveAccountBefore).to.be.eq(account1BalanceBefore)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })

            it('early exit available block.timestamp < startDate', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate - 1);

                await farmingRewards.connect(account1).farm(stakeAmount)


                await farmingRewards.connect(account1).withdraw(stakeAmount)

                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)


                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })


            it('early exit available block.timestamp < startDate', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate - 1);

                await farmingRewards.connect(account1).withdraw(stakeAmount)

                let accountStakingBalanceAfter = await stakingToken.balanceOf(account1.address)


                expect(await farmingRewards.rewardPerTokenStored()).to.be.eq(0)
                expect(accountStakingBalanceAfter).to.be.eq(stakeAmount)
            })


            it('withdraw 100%  on 50% time, get reward + exit in the end', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                let toReceiveAccountAfter = await farmingRewards.earned(account1.address);

                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).exit()
                await farmingRewards.connect(account1).getReward()

                let account1BalanceAfter = await rewardToken.balanceOf(account1.address)

                expect(toReceiveAccountAfter).to.be.eq(account1BalanceAfter)
            })
            it('withdraw 100%  on 50% time, exit in the end', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let halfFarmingPoolDuration = startDate + (epochDuration / 2);
                await time.increaseTo(startDate);

                await farmingRewards.connect(account1).farm(stakeAmount)
                await time.increaseTo(halfFarmingPoolDuration);

                await farmingRewards.connect(account1).withdraw(stakeAmount)
                let toReceiveAccountAfter = await farmingRewards.earned(account1.address);

                await time.increaseTo(endDate + 1);

                await farmingRewards.connect(account1).exit()

                let account1BalanceAfter = await rewardToken.balanceOf(account1.address)

                expect(toReceiveAccountAfter).to.be.eq(account1BalanceAfter)
            })


            it('1 account does not farm in end exit', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                await time.increaseTo(startDate);

                await time.increaseTo(endDate +1);

                await farmingRewards.connect(account1).exit()

                let account1BalanceAfter = (await rewardToken.balanceOf(account1.address)).toNumber()

                expect(account1BalanceAfter).to.be.eq(0)
            })
        });

        describe('failed cases', async () => {
            it('initialize with the same tokens', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    rewardToken.address,
                    rewardAmount,
                    startDate + 10,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Staking and reward tokens can not be the same.')
            })

            it('withdraw by owner ', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    rewardToken.address,
                    rewardAmount,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Staking and reward tokens can not be the same.')
            })


            it('deploy with the same tokens', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    stakingToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate + 10,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Staking and reward tokens can not be the same.')
            })

            it('date time in feature', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate-1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('StartDate must be in feature')
            })

            it('factory can not be zero', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    zeroAddress,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate-1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('FarmingRewardsFactory can not be zero address')
            })

            it('deployer can not be zero address', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    zeroAddress,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate-1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Deployer can not be zero address')
            })

            it('unavailable leave when exit time not yet', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(endDate - 10);

                await farmingRewards.connect(account2).farm(stakeAmount)

                await time.increaseTo(endDate - 1);

                await expect(farmingRewards.connect(account2).exit())
                    .to.be.revertedWith('Fail unstake earlier then it available')
            })

            it('unavailable leave when epoch duration equal minStakingExitTime', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                let startDateFarm = startDate + 10000;
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDateFarm,
                    endDate,
                    epochDuration,
                    epochDuration - 1000
                );

                await stakingToken.connect(account2).approve(farmingRewards.address, stakeAmountSecond.toString())
                await rewardToken.connect(owner).transfer(farmingRewards.address, stakeAmountSecond.toString())
                await stakingToken.connect(owner).transfer(account2.address, stakeAmountSecond.toString())
                await time.increaseTo(startDateFarm);

                await farmingRewards.connect(account2).farm(1000000)

                await expect(farmingRewards.connect(account2).exit())
                    .to.be.revertedWith('Fail unstake earlier then it available')
            })

            it('unavailable leave when exit time not pass double enter', async () => {
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(startDate);

                await farmingRewards.connect(account2).farm(halfStakeAmount)

                await time.increaseTo(startDate + (epochDuration / 2));
                await farmingRewards.connect(account2).farm(halfStakeAmount)

                await expect(farmingRewards.connect(account2).exit())
                    .to.be.revertedWith('Fail unstake earlier then it available')
            })

            it('farm zero', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await expect(farmingRewards
                    .connect(account7).farm(0))
                    .to.be.revertedWith('Cannot farm 0');
            })

            it('farm after end of farming pool', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(endDate + 1);

                await expect(farmingRewards.connect(account6).farm(stakeAmount))
                    .to.be.revertedWith('Farming pool already finished');
            })

            it('create epoch when end date > start date', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 604800;
                endDate = startDate + epochDuration;


                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate + 1,
                    startDate - 1,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Wrong end date epoch');
            })
            it('create epoch with reward 0', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    0,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                )).to.be.revertedWith('Wrong reward amount');

            })

            it('unavailable withdraw while farming pool active', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await expect(farmingRewards.withdraw(1)).to.be.revertedWith('Unavailable withdraw')
            })

            it('create epoch with wrong time', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 604800;
                endDate = startDate + epochDuration;
                let minimumStakingExitTime = 1000;

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");

                await expect(FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate + 1,
                    startDate + 2,
                    epochDuration,
                    epochDuration + 1
                )).to.be.revertedWith('Wrong stake time');
                await farmingRewards.deployed();
            })

            it('Reentrancy on getReward', async () => {

                const Reentrancy = await ethers.getContractFactory("ReentrancyGetReward");
                let reentrancy = await Reentrancy.deploy();
                await reentrancy.deployed();

                let rewardAmount = expandTo18Decimals(1).toString();

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    reentrancy.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    1000
                );

                // await farmingRewards.deployed();
                await reentrancy.initialize(farmingRewards.address)


                await rewardToken.transfer(farmingRewards.address, rewardAmount)
                await reentrancy.transfer(farmingRewards.address, rewardAmount)

                await rewardToken.transfer(account2.address, rewardAmount)
                await reentrancy.transfer(account2.address, rewardAmount)
                await stakingToken.transfer(account2.address, rewardAmount)

                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.connect(account2).approve(farmingRewards.address, rewardAmount)

                await reentrancy.approve(farmingRewards.address, rewardAmount)

                await time.increaseTo(startDate + 2)
                await farmingRewards.connect(account2).farm(1)

                await time.increaseTo(endDate + 1000);

                await expect(farmingRewards.connect(account2).getReward())
                    .to.be.revertedWith('ReentrancyGuard: reentrant call')
            })

            it('Reentrancy on farm ', async () => {
                let addTime = 10000;
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1
                epochDuration = 1000;
                endDate = startDate + addTime + epochDuration;

                const Reentrancy = await ethers.getContractFactory("ReentrancyReward");
                let reentrancy = await Reentrancy.deploy();

                await time.increaseTo(startDate);

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    stakingToken.address,
                    reentrancy.address,
                    rewardAmount,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    1
                );
                await reentrancy.initialize(farmingRewards.address)

                await reentrancy.transfer(farmingRewards.address, rewardAmount)
                await reentrancy.approve(farmingRewards.address, rewardAmount)
                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.transfer(farmingRewards.address, rewardAmount)

                await expect(farmingRewards.farm(10))
                    .to.be.revertedWith('ReentrancyGuard: reentrant call')
            })

            it('Reentrancy on farm ', async () => {
                let addTime = 10000;
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 1000;
                endDate = startDate + addTime + epochDuration;

                const Reentrancy = await ethers.getContractFactory("ReentrancyReward");
                let reentrancy = await Reentrancy.deploy();
                await reentrancy.deployed();

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    stakingToken.address,
                    reentrancy.address,
                    rewardAmount,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                );
                reentrancy.initialize(farmingRewards.address)

                await reentrancy.transfer(farmingRewards.address, rewardAmount)
                await reentrancy.approve(farmingRewards.address, rewardAmount)
                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.transfer(farmingRewards.address, rewardAmount)
                await expect(farmingRewards.farm(10))
                    .to.be.revertedWith('ReentrancyGuard: reentrant call')
            })

            it('Reentrancy on withdraw 1 ', async () => {
                let addTime = 10000;
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 10000;
                endDate = startDate + addTime + epochDuration;

                const Reentrancy = await ethers.getContractFactory("ReentrancyWithdraw");
                let reentrancy = await Reentrancy.deploy();
                await reentrancy.deployed();

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");

                await time.increaseTo(startDate);
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    rewardToken.address,
                    reentrancy.address,
                    stakeAmount,
                    startDate + 10,
                    endDate,
                    epochDuration,
                    1
                );
                await farmingRewards.deployed();

                await reentrancy.initialize(farmingRewards.address);


                await reentrancy.approve(owner.address, rewardAmount)
                await reentrancy.approve(farmingRewards.address, rewardAmount)
                await reentrancy.transferFrom(owner.address, farmingRewards.address, rewardAmount)
                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.approve(owner.address, rewardAmount)
                await stakingToken.transfer(farmingRewards.address, rewardAmount)

                await farmingRewards.farm(10);

                await time.increaseTo(endDate + 1);

                await expect(farmingRewards.withdraw(10))
                    .to.be.revertedWith('ReentrancyGuard: reentrant call')
            })

            it('Reentrancy on withdraw 2', async () => {
                let addTime = 10000;
                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 1000;
                endDate = startDate + addTime + epochDuration;

                const Reentrancy = await ethers.getContractFactory("ReentrancyWithdraw");
                let reentrancy = await Reentrancy.deploy()

                const FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    stakingToken.address,
                    reentrancy.address,
                    rewardAmount,
                    startDate + 10,
                    endDate,
                    epochDuration,
                    minimumStakingExitTime
                );

                reentrancy.initialize(farmingRewards.address)

                await reentrancy.approve(owner.address, rewardAmount)
                await reentrancy.approve(farmingRewards.address, rewardAmount)
                await reentrancy.transferFrom(owner.address, farmingRewards.address, rewardAmount)
                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.approve(owner.address, rewardAmount)
                await stakingToken.transfer(farmingRewards.address, rewardAmount)
                await farmingRewards.farm(10);

                await time.increaseTo(endDate + 1);

                await expect(farmingRewards.withdraw(10))
                    .to.be.revertedWith('ReentrancyGuard: reentrant call')
            })

            it('unavailable withdraw while farming pool active', async () => {

                startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
                epochDuration = 604800;
                endDate = startDate + epochDuration;

                await time.increaseTo(endDate + 1);
                farmingRewards.withdraw(1);

            })
            it('unavailable getReward on token which dont have return', async () => {

                const TestTokenNoReturnOnTransfer = await ethers.getContractFactory("TestTokenNoReturnOnTransfer");
                // const TestTokenNoReturnOnTransfer = await ethers.getContractFactory("TestToken");
                const testTokenNoReturnOnTransferFrom = await TestTokenNoReturnOnTransfer.deploy();
                await testTokenNoReturnOnTransferFrom.deployed();

                let rewardAmount = expandTo18Decimals(1).toString();

                let FarmingRewards = await ethers.getContractFactory("FarmingRewards");
                let farmingRewards = await FarmingRewards.deploy(
                    account5.address,
                    owner.address,
                    testTokenNoReturnOnTransferFrom.address,
                    stakingToken.address,
                    rewardAmount,
                    startDate + 1,
                    endDate,
                    epochDuration,
                    1000
                );

                await rewardToken.transfer(farmingRewards.address, rewardAmount)
                await testTokenNoReturnOnTransferFrom.transfer(farmingRewards.address, rewardAmount)

                await rewardToken.transfer(account2.address, rewardAmount)
                await testTokenNoReturnOnTransferFrom.transfer(account2.address, rewardAmount)
                await stakingToken.transfer(account2.address, rewardAmount)

                await stakingToken.approve(farmingRewards.address, rewardAmount)
                await stakingToken.connect(account2).approve(farmingRewards.address, rewardAmount)

                await testTokenNoReturnOnTransferFrom.approve(farmingRewards.address, rewardAmount)

                await time.increaseTo(startDate + 2)
                await farmingRewards.connect(account2).farm(1)

                await time.increaseTo(endDate + 1000);


                await farmingRewards.connect(account2).getReward()
            })

        })
    })
})
