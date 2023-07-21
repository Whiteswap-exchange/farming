import chai, {expect} from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from 'ethereum-waffle';
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {zeroAddress} from "ethereumjs-util";
import {time} from "@nomicfoundation/hardhat-network-helpers";

chai.use(solidity);

export function expandTo18Decimals(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

describe('FarmingRewardsFactory', async() => {
    const amount = expandTo18Decimals(10);
    const transferAmount = expandTo18Decimals(1);

    let farmingRewardsFactory: Contract;
    let lpToken: Contract;
    let stakingToken: Contract;
    let rewardToken: Contract;
    let tokenWithCommission: Contract;
    let lockToken: Contract;
    let wsController: Contract;
    let wsPair: Contract;
    let wsFactory: Contract;
    let owner: SignerWithAddress;
    let account1: SignerWithAddress;
    let now: number;


    describe('#deploy', () => {
        let epochDuration = 60 * 60 * 24 * 30//30 days;
        let ONE_YEAR = epochDuration * 13;
        let minimumStakingExitTime = 60 * 60 * 24 * 15//30 days;
        let feesAmount = 5;
        let totalRewards = expandTo18Decimals(1);
        let now = Date.now();

        beforeEach(async () => {
            [owner, account1] = await ethers.getSigners()

            const LockToken = await ethers.getContractFactory("WSGov");
            lockToken = await LockToken.deploy();
            await lockToken.deployed();

            const WSPair = await ethers.getContractFactory("WSPair");
            wsPair = await WSPair.deploy();
            await wsPair.deployed();

            const WSController = await ethers.getContractFactory("WSController");
            wsController = await WSController.deploy(wsPair.address);
            await wsController.deployed();

            const WSFactory = await ethers.getContractFactory("WSFactory");
            wsFactory = await WSFactory.deploy();
            await wsFactory.deployed();
            await wsFactory.initialize(owner.address, wsController.address);

            const StakingToken = await ethers.getContractFactory("TestToken");
            stakingToken = await StakingToken.deploy();
            await stakingToken.deployed();

            const RewardToken = await ethers.getContractFactory("TestToken");
            rewardToken = await RewardToken.deploy();
            await rewardToken.deployed();

            const TokenWithCommission = await ethers.getContractFactory("TestTokenCommissionTransfer");
            tokenWithCommission = await TokenWithCommission.deploy();
            await tokenWithCommission.deployed();

            const FarmingRewardsFactory = await ethers.getContractFactory("FarmingRewardsFactory");

            farmingRewardsFactory = await FarmingRewardsFactory.deploy(
                feesAmount,
                totalRewards,
                lockToken.address,
                owner.address,
                wsFactory.address,
            );
            await farmingRewardsFactory.deployed();

            await wsFactory.createPair(rewardToken.address, stakingToken.address)

            const LPToken = await ethers.getContractFactory("TestToken");
            lpToken = await LPToken.deploy();
            await lpToken.deployed();
            await wsFactory.pushPair(lpToken.address);

            let treasureAddress = await farmingRewardsFactory.treasure()
            await stakingToken.approve(farmingRewardsFactory.address, amount)
            await rewardToken.approve(farmingRewardsFactory.address, amount)
            await lockToken.approve(treasureAddress, amount)
            await lockToken.approve(farmingRewardsFactory.address, amount)
        });

        describe('success cases', async () => {
            it('Deploy farming pool', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );


                await rewardToken.approve(farmingPool, amount)
                await rewardToken.approve(farmingRewardsFactory.address, amount)

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)


                await lpToken.connect(owner).transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)
                await stakingToken.approve(await farmingRewardsFactory.address, amount)
                await stakingToken.approve(farmingPool, amount)

                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let id = await farmingRewardsFactory.iteratorIdFarmingPools()
                let info = await farmingRewardsFactory.farmingInfo(id)
                let treasureAddress = await farmingRewardsFactory.treasure()
                expect(info.id).to.be.eq(id)
                expect(info.stakingToken).to.be.eq(lpToken.address)
                expect(info.rewardToken).to.be.eq(rewardToken.address)
                expect(info.startDate).to.be.eq(now)
                expect(info.endDate).to.be.eq(now + ONE_YEAR)
                expect(info.epochDuration).to.be.eq(ONE_YEAR)
                expect(info.totalReward).to.be.eq(totalRewards)
                expect(info.deployer).to.be.eq(owner.address)

                expect(await farmingRewardsFactory.wsd()).to.be.eq(lockToken.address)
                expect(await farmingRewardsFactory.treasure()).to.be.eq(treasureAddress)
                expect(await farmingRewardsFactory.timeLock()).to.be.eq(owner.address)
                expect(await farmingRewardsFactory.whiteswapV2Factory()).to.be.eq(wsFactory.address)
                expect(await farmingRewardsFactory.wsUnlockCommissionPercent()).to.be.eq(feesAmount)
                expect(await farmingRewardsFactory.lockAmount()).to.be.eq(totalRewards)
            })

            it('Deploy 2 farming pool', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await farmingRewardsFactory.connect(owner).deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )


                let treasureAddress = await farmingRewardsFactory.treasure()

                let idFirst = await farmingRewardsFactory.iteratorIdFarmingPools()
                let infoFirst = await farmingRewardsFactory.farmingInfo(idFirst)
                await lockToken.approve(treasureAddress, amount)

                let newNow = now + 1;
                let farmingPoolSecond = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    newNow,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await stakingToken.approve(farmingPoolSecond, amount)
                await lpToken.approve(farmingPoolSecond, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(farmingPoolSecond, amount)
                await stakingToken.approve(farmingRewardsFactory.address, amount)
                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)

                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    newNow,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let idSecond = await farmingRewardsFactory.iteratorIdFarmingPools()
                let infoSecond = await farmingRewardsFactory.farmingInfo(idSecond)

                expect(infoFirst.id).to.be.eq(idFirst)
                expect(infoFirst.stakingToken).to.be.eq(lpToken.address)
                expect(infoFirst.rewardToken).to.be.eq(rewardToken.address)
                expect(infoFirst.startDate).to.be.eq(now)
                expect(infoFirst.endDate).to.be.eq(now + ONE_YEAR)
                expect(infoFirst.totalReward).to.be.eq(totalRewards)
                expect(infoFirst.epochDuration).to.be.eq(ONE_YEAR)

                expect(infoSecond.id).to.be.eq(idSecond)
                expect(infoSecond.stakingToken).to.be.eq(lpToken.address)
                expect(infoSecond.rewardToken).to.be.eq(rewardToken.address)
                expect(infoSecond.startDate).to.be.eq(newNow)
                expect(infoSecond.endDate).to.be.eq(now + ONE_YEAR + 1)
                expect(infoSecond.totalReward).to.be.eq(totalRewards)
                expect(infoSecond.epochDuration).to.be.eq(ONE_YEAR)

                expect(await farmingRewardsFactory.wsd()).to.be.eq(lockToken.address)
                expect(await farmingRewardsFactory.treasure()).to.be.eq(treasureAddress)
                expect(await farmingRewardsFactory.timeLock()).to.be.eq(owner.address)
                expect(await farmingRewardsFactory.whiteswapV2Factory()).to.be.eq(wsFactory.address)
                expect(await farmingRewardsFactory.wsUnlockCommissionPercent()).to.be.eq(feesAmount)
                expect(await farmingRewardsFactory.lockAmount()).to.be.eq(totalRewards)
            })

            it('change lock amount', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await farmingRewardsFactory.connect(owner).deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let lockAmountOld = await farmingRewardsFactory.lockAmount()

                let newLockAmount = expandTo18Decimals(200);
                await farmingRewardsFactory.connect(owner).changeLockAmount(newLockAmount)
                let lockAmountNew = await farmingRewardsFactory.lockAmount()


                expect(lockAmountOld).to.be.eq(totalRewards)
                expect(lockAmountNew).to.be.eq(newLockAmount)
            })

            it('change wsUnlockCommissionPercent', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let lockFeeOld = await farmingRewardsFactory.wsUnlockCommissionPercent()

                let newLockFeeAmount = 20;
                await farmingRewardsFactory.connect(owner).changeWsUnlockCommissionPercent(newLockFeeAmount)
                let lockFeetNew = await farmingRewardsFactory.wsUnlockCommissionPercent()


                expect(lockFeeOld).to.be.eq(feesAmount)
                expect(lockFeetNew).to.be.eq(newLockFeeAmount)
            })
        })


        describe('failed cases', () => {

            it('total reward invalid value', async () => {
                await expect(
                    farmingRewardsFactory.deploy(
                        rewardToken.address,
                        lpToken.address,
                        0,
                        now -1,
                        0,
                        minimumStakingExitTime,
                        minimumStakingExitTime
                    )
                ).to.be.revertedWith('TotalReward can not be zero');
            })

            it('epoch duration invalid value', async () => {
                let totalReward = 864001;
                let minExitTime = 604800;
                await expect(
                    farmingRewardsFactory.deploy(
                        rewardToken.address,
                        stakingToken.address,
                        totalReward,
                        now -1,
                        0,
                        minExitTime,
                        minExitTime
                    )
                ).to.be.revertedWith('Epoch duration less than min epoch duration');
            })

            it('staking token can not be zero address', async () => {
                let totalReward = 864001;
                let minExitTime = 604800;
                await expect(
                    farmingRewardsFactory.deploy(
                        rewardToken.address,
                        zeroAddress(),
                        0,
                        now -1,
                        totalReward,
                        minExitTime,
                        minExitTime,
                    )
                ).to.be.revertedWith('Staking token can not be zero');
            })

            it('reward token can not be zero address', async () => {
                let totalReward = 864001;
                let minExitTime = 604800;
                await expect(
                    farmingRewardsFactory.deploy(
                        zeroAddress(),
                        rewardToken.address,
                        0,
                        now -1,
                        totalReward,
                        minExitTime,
                        minExitTime,
                    )
                ).to.be.revertedWith('Reward token can not be zero');
            })

            it('min epoch duration', async () => {
                let totalReward = 864001;
                let minExitTime = 1;
                await expect(farmingRewardsFactory.deploy(
                    rewardToken.address,
                    stakingToken.address,
                    totalReward,
                    now -1,
                    0,
                    minExitTime,
                    minExitTime,
                )).to.be.revertedWith('Epoch duration less than min epoch duration');
            })

            it('Minimum staking exit time', async () => {
                let totalReward = 186400100;
                let epochDuration = 2592000;
                let minExitTime = 1209600 -1;

                await expect(farmingRewardsFactory.deploy(
                    rewardToken.address,
                    stakingToken.address,
                    totalReward,
                    now -1,
                    epochDuration,
                    minExitTime,
                    minExitTime,
                )).to.be.revertedWith('Can not be min staking time less than 14 days');
            })

            it('Minimum staking exit time', async () => {
                let totalReward = 186400100;
                let epochDuration = 2592000;

                await expect(farmingRewardsFactory.deploy(
                    rewardToken.address,
                    stakingToken.address,
                    epochDuration,
                    now -1,
                    totalReward,
                    totalReward,
                    totalReward,
                )).to.be.revertedWith('Can not be max staking time greater than 30 days');
            })

            it('Minimum reward must be greater epoch', async () => {
                let epochDuration = 2592000;
                let totalReward = epochDuration -1;

                await expect(farmingRewardsFactory.deploy(
                    rewardToken.address,
                    stakingToken.address,
                    totalReward-1,
                    now -1,
                    epochDuration,
                    totalReward,
                    totalReward,
                )).to.be.revertedWith('Total reward must be greater than epoch duration');
            })

            it('LP token is invalid token', async () => {
                await expect(farmingRewardsFactory.deploy(
                        rewardToken.address,
                        account1.address,
                        epochDuration,
                        now -1,
                        epochDuration,
                        minimumStakingExitTime,
                        minimumStakingExitTime,
                    )
                ).to.be.revertedWith('Not valid LP token');

            })

            it('can not set zero on lock amount', async () => {

                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );


                await rewardToken.approve(farmingPool, amount)
                await rewardToken.approve(farmingRewardsFactory.address, amount)

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)
                await stakingToken.approve(await farmingRewardsFactory.address, amount)
                await stakingToken.approve(farmingPool, amount)


                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )
                await farmingRewardsFactory.deployed()

                let newFee = 10;

                await expect(
                    farmingRewardsFactory.changeLockAmount(0)
                ).to.be.revertedWith('Can not be zero');
            })

            it('not Owner change changeLockAmount', async () => {

                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );


                await rewardToken.approve(farmingPool, amount)
                await rewardToken.approve(farmingRewardsFactory.address, amount)

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)
                await stakingToken.approve(await farmingRewardsFactory.address, amount)
                await stakingToken.approve(farmingPool, amount)


                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )
                await farmingRewardsFactory.deployed()

                let newFee = 10;

                await expect(
                    farmingRewardsFactory.connect(account1).changeLockAmount(newFee)
                ).to.be.revertedWith('Ownable: caller is not the owner');
            })

            it('Too high percent', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );


                await rewardToken.approve(farmingPool, amount)
                await rewardToken.approve(farmingRewardsFactory.address, amount)

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)
                await stakingToken.approve(await farmingRewardsFactory.address, amount)
                await stakingToken.approve(farmingPool, amount)


                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let newFee = 101;

                await expect(
                    farmingRewardsFactory.connect(owner).changeWsUnlockCommissionPercent(newFee)
                ).to.be.revertedWith('Too high percent');
            })

            it('not Owner change changeWsUnlockCommissionPercent', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );


                await rewardToken.approve(farmingPool, amount)
                await rewardToken.approve(farmingRewardsFactory.address, amount)

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await stakingToken.approve(await farmingRewardsFactory.treasure(), amount)
                await stakingToken.approve(await farmingRewardsFactory.address, amount)
                await stakingToken.approve(farmingPool, amount)


                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let newFee = 10;

                await expect(
                    farmingRewardsFactory.connect(account1).changeWsUnlockCommissionPercent(newFee)
                ).to.be.revertedWith('Ownable: caller is not the owner');
            })

            it('change wsUnlockCommissionPercent high percent', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await farmingRewardsFactory.deploy(
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )

                let lockFeeOld = await farmingRewardsFactory.wsUnlockCommissionPercent()

                let newLockFeeAmount = 51;
                await expect(farmingRewardsFactory.connect(owner).changeWsUnlockCommissionPercent(newLockFeeAmount))
                    .to.be.revertedWith('Too high percent');
                let lockFeetNew = await farmingRewardsFactory.wsUnlockCommissionPercent()


                expect(lockFeeOld).to.be.eq(feesAmount)
                expect(lockFeetNew).to.be.eq(lockFeeOld)
            })

            it('constructor cases', async () => {
                const FarmingRewardsFactory = await ethers.getContractFactory("FarmingRewardsFactory");

                await expect(FarmingRewardsFactory.deploy(
                    feesAmount,
                    0,
                    lockToken.address,
                    owner.address,
                    wsFactory.address
               )).to.be.revertedWith('Lock can not be zero');

                await expect(
                    FarmingRewardsFactory.deploy(
                        feesAmount,
                        amount,
                        zeroAddress(),
                        owner.address,
                        wsFactory.address
                    )
                ).to.be.revertedWith('Wsd can not be zero');

                await expect(
                    FarmingRewardsFactory.deploy(
                        feesAmount,
                        amount,
                        lockToken.address,
                        zeroAddress(),
                        wsFactory.address
                    )
                ).to.be.revertedWith('TimeLock can not be zero');

                await expect(
                    FarmingRewardsFactory.deploy(
                        feesAmount,
                        amount,
                        lockToken.address,
                        owner.address,
                        zeroAddress()
                    )
                ).to.be.revertedWith('WhiteswapV2Factory can not be zero');
            })


            it('constructor case high percent', async () => {
                const FarmingRewardsFactory = await ethers.getContractFactory("FarmingRewardsFactory");

                await expect(
                    FarmingRewardsFactory.deploy(
                        100,
                        amount,
                        lockToken.address,
                        owner.address,
                        owner.address,
                    )
                ).to.be.revertedWith('Too high percent');
            })

            it('failed to deploy same tokens', async () => {
                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    rewardToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)

                await expect(farmingRewardsFactory.deploy(
                    lpToken.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )).to.be.revertedWith('Create2: Failed on deploy')
            })

            it('invalid amount deployed', async () => {

                const FarmingRewardsFactory = await ethers.getContractFactory("FarmingRewardsFactory");

                farmingRewardsFactory = await FarmingRewardsFactory.deploy(
                    feesAmount,
                    amount,
                    lockToken.address,
                    owner.address,
                    wsFactory.address,
                );
                await farmingRewardsFactory.deployed();

                let farmingPool = await farmingRewardsFactory.getAddress(
                    owner.address,
                    tokenWithCommission.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    minimumStakingExitTime
                );

                await lpToken.approve(farmingPool, amount)
                await lpToken.approve(farmingRewardsFactory.address, amount)
                await lpToken.transfer(farmingRewardsFactory.address, transferAmount)



                await lockToken.approve(farmingPool, amount)
                await lockToken.approve(farmingRewardsFactory.address, amount)
                await lockToken.approve(await farmingRewardsFactory.treasure(), amount)
                await lockToken.transfer(farmingRewardsFactory.address, transferAmount)


                await tokenWithCommission.approve(farmingPool, amount)
                await tokenWithCommission.approve(farmingRewardsFactory.address, amount)
                await tokenWithCommission.transfer(farmingRewardsFactory.address, transferAmount)

                await expect(farmingRewardsFactory.deploy(
                    tokenWithCommission.address,
                    lpToken.address,
                    totalRewards,
                    now,
                    ONE_YEAR,
                    ONE_YEAR,
                    minimumStakingExitTime
                )).to.be.revertedWith('Invalid amount')
            })
        })
    })
});
