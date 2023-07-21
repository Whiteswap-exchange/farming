import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

describe('Treasure', () => {
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  let lockToken: Contract;
  let treasure: Contract;
  let owner: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;
  let account3: SignerWithAddress;


  describe('#deploy', () => {
    let endDate;
    beforeEach(async () => {
      [owner, account1, account2, account3] = await ethers.getSigners()

      const LockToken = await ethers.getContractFactory("WSGov");
      lockToken = await LockToken.deploy();
      await lockToken.deployed();

      const Treasure = await ethers.getContractFactory("Treasure");
      treasure = await Treasure.deploy(lockToken.address, owner.address, owner.address);
      await treasure.deployed();

      await lockToken.transfer(account1.address, 10000000000);
      await lockToken.connect(account1).approve(treasure.address, 10000000000);
      await lockToken.transfer(account3.address, 10000000000);
      await lockToken.connect(account3).approve(treasure.address, 10000000000);

      await lockToken.approve(treasure.address, 9999999999999);
    });

    describe('success cases', async () => {

      it('constructor FeeRecipient Can not be zero address', async () => {
        const Treasure = await ethers.getContractFactory("Treasure");

        let treasure = await Treasure.deploy(lockToken.address, lockToken.address, lockToken.address)
        await treasure.deployed();

        expect(await treasure.feeRecipient()).to.be.eq(lockToken.address);
        expect(await treasure.farmingRewardFactory()).to.be.eq(lockToken.address);
        expect(await treasure.wsd()).to.be.eq(lockToken.address);
      })

      it('percent 0 lock and unlock', async () => {
        let lockDuration = 31556926000;
        let epochDuration = 31556926000;
        let lockAmount = 100;
        let lockFee = 0;
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            lockDuration,
            epochDuration,
            lockFee,
            owner.address,
            account1.address
        )
        endDate = startDate + epochDuration;

        await ethers.provider.send('evm_increaseTime', [endDate]);

        await expect(treasure.connect(account1).unlock(owner.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, account1.address, lockAmount)
            .to.be.emit(treasure, 'FundsUnlocked')
            .withArgs(account1.address, lockAmount)

        expect(await treasure.getContribution(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockFee(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getStartFarmingPoolDate(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.totalLocked()).to.be.eq(0)
      })
      it('percent changed for two pools', async () => {
        let duration = 31556926000;
        let lockAmount = 100;
        let unlockAmount = 90;
        let lockFee = 0;
        let lockFeeSecond = 10;
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            duration,
            duration,
            lockFee,
            owner.address,
            account1.address
        )

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            duration,
            duration,
            lockFeeSecond,
            account2.address,
            account1.address
        )

        endDate = startDate + duration;

        await ethers.provider.send('evm_increaseTime', [endDate]);

        await expect(treasure.connect(account1).unlock(owner.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, account1.address, lockAmount)


        await expect(treasure.connect(account1).unlock(account2.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, account1.address, unlockAmount)
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, owner.address, lockFeeSecond)

        expect(await treasure.getContribution(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockFee(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getStartFarmingPoolDate(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.totalLocked()).to.be.eq(0)
      })

      it('change fee recipient', async () => {
        await treasure.connect(owner).changeFeeRecipient(
            account3.address
        )
      })

      it('percent 50 for lock', async () => {
        let duration = 315360002;
        let lockDuration = 315360002;
        let lockAmount = 100;
        let lockFee = 50;
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            lockDuration,
            duration,
            lockFee,
            owner.address,
            account3.address
        )

        endDate = startDate + duration;

        await ethers.provider.send('evm_increaseTime', [endDate]);

        expect(await treasure.getUnlockDate(account3.address, owner.address)).to.be.eq(endDate)

        await expect(treasure.connect(account3).unlock(owner.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, owner.address, lockFee)
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, account3.address, lockFee)

        expect(await treasure.getContribution(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockFee(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getStartFarmingPoolDate(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.totalLocked()).to.be.eq(0)
      })

      it('percent changed for two pools from different accounts', async () => {
        let duration = 31556926000;
        let lockAmount = 100;
        let unlockAmount = 90;
        let lockFee = 0;
        let lockFeeSecond = 10;
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            duration,
            duration,
            lockFee,
            owner.address,
            owner.address
        )

        await treasure.connect(owner).lock(
            lockAmount,
            startDate,
            duration,
            duration,
            lockFeeSecond,
            account2.address,
            account1.address
        )

        endDate = startDate + duration;

        await ethers.provider.send('evm_increaseTime', [endDate]);

        await expect(treasure.connect(owner).unlock(owner.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, owner.address, lockAmount)


        await expect(treasure.connect(account1).unlock(account2.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, account1.address, unlockAmount)
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, owner.address, lockFeeSecond)

        expect(await treasure.getContribution(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockFee(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.getStartFarmingPoolDate(account1.address, owner.address)).to.be.eq(0)
        expect(await treasure.totalLocked()).to.be.eq(0)
      })
      it('lock funds for year', async () => {

        let oneYear = 31536000;
        let lockAmount = 100;
        let lockFee = 5;
        let minStakeDuration = 31536000; //1 year
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;
        await treasure.lock(
            lockAmount,
            startDate,
            oneYear,
            oneYear,
            lockFee,
            owner.address,
            owner.address
        )

        let date = startDate + oneYear;

        expect(await treasure.getUnlockDate(owner.address, owner.address)).to.be.eq(date)
        expect(await treasure.getContribution(owner.address, owner.address)).to.be.eq(lockAmount)
        expect(await treasure.getLockFee(owner.address, owner.address)).to.be.eq(lockFee)
        expect(await treasure.getStartFarmingPoolDate(owner.address, owner.address)).to.be.eq(startDate)
        expect(await treasure.getLockDuration(owner.address, owner.address)).to.be.eq(minStakeDuration)
        expect(await treasure.totalLocked()).to.be.eq(lockAmount)
      })

      it('unlock funds', async () => {

        let duration = 31556926000;
        let lockAmount = 100;
        let lockFee = 5;
        let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

        await treasure.lock(
            lockAmount,
            startDate,
            duration,
            duration,
            lockFee,
            owner.address,
            owner.address
        )

        endDate = startDate + duration;

        await ethers.provider.send('evm_increaseTime', [endDate]);

        await expect(treasure.connect(owner).unlock(owner.address))
            .to.be.emit(lockToken, 'Transfer')
            .withArgs(treasure.address, owner.address, lockFee)


        expect(await treasure.getContribution(owner.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockFee(owner.address, owner.address)).to.be.eq(0)
        expect(await treasure.getLockDuration(owner.address, owner.address)).to.be.eq(0)
        expect(await treasure.getStartFarmingPoolDate(owner.address, owner.address)).to.be.eq(0)
        expect(await treasure.totalLocked()).to.be.eq(0)
      })
      // })

      describe('failed cases', async () => {

        it('lock funds for year', async () => {

          let duration = 100;
          let lockAmount = 100;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;


          await expect(treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )).to.be.revertedWith('Invalid duration')
        })

        it('unlock funds failed double spend', async () => {

          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;


          await treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )

          endDate = startDate + duration;

          await ethers.provider.send('evm_increaseTime', [endDate]);

          await treasure.unlock(owner.address)

          expect(await treasure.getContribution(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getLockFee(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getLockDuration(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getStartFarmingPoolDate(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.totalLocked()).to.be.eq(0)
          expect(await treasure.getIsDistributedLockedFunds(owner.address, owner.address)).to.be.true;

          expect(treasure.unlock(owner.address))
              .to.be.revertedWith('Already distributed')
        })

        it('unlock funds failed double spend', async () => {

          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )

          endDate = startDate + duration;

          expect(treasure.unlock(owner.address))
              .to.be.revertedWith('Finish date is not reached')
        })

        it('fee >= 100', async () => {

          let duration = 31556926000;
          let lockAmount = 1000000000000;
          let lockFee = 101;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await expect(treasure.connect(owner).lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )).to.be.revertedWith('Too high fee')
        })

        it('lock with duration 0', async () => {

          let lockAmount = 1000000000000;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          const Treasure = await ethers.getContractFactory("Treasure");
          treasure = await Treasure.deploy(lockToken.address, owner.address, account3.address);
          await treasure.deployed();

          lockToken.transfer(account3.address, lockAmount);
          lockToken.connect(account3).approve(treasure.address, lockAmount);

          await expect(treasure.connect(account3).lock(
              lockAmount,
              0,
              0,
              0,
              lockFee,
              owner.address,
              account3.address
          )).to.be.revertedWith('Can not be zero duration')
        })

        it('can not be locked twice', async () => {

          let lockAmount = 1000000000000;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;
          let duration = 31536000;

          await treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )

          await expect(treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              account3.address
          )).to.be.revertedWith('Already locked')
        })

        it('only factory can call', async () => {

          let lockAmount = 1000000000000;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          lockToken.transfer(account3.address, lockAmount);
          lockToken.connect(account3).approve(treasure.address, lockAmount);

          let duration = 31536000;
          await expect(treasure.connect(account1).lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )).to.be.revertedWith('Allowed only for factory')
        })

        it('farming can not be in past', async () => {

          let lockAmount = 1000000000000;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          const Treasure = await ethers.getContractFactory("Treasure");
          treasure = await Treasure.deploy(lockToken.address, owner.address, account3.address);
          await treasure.deployed();

          lockToken.transfer(account3.address, lockAmount);
          lockToken.connect(account3).approve(treasure.address, lockAmount);

          let duration = 31536000;

          await expect(treasure.connect(account3).lock(
              lockAmount,
              startDate - 10000,
              duration,
              duration,
              lockFee,
              owner.address,
              account3.address
          )).to.be.revertedWith('Can not be in past')
        })

        it('invalid constructor arguments', async () => {

          const Treasure = await ethers.getContractFactory("Treasure");
          treasure = await Treasure.deploy(lockToken.address, owner.address, owner.address);

          await expect(Treasure.deploy(zeroAddress, owner.address, owner.address))
              .to.be.revertedWith('Token can not be zero address')

          await expect(Treasure.deploy(lockToken.address, zeroAddress, owner.address))
              .to.be.revertedWith('FeeRecipient Can not be zero address')

          await expect(Treasure.deploy(lockToken.address, zeroAddress, zeroAddress))
              .to.be.revertedWith('Factory can not be zero address')
        })

        it('lock already locked farming pool', async () => {

          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 5;

          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )

          expect(await treasure.totalLocked()).to.be.eq(lockAmount)

          await expect(
              treasure.lock(
                  lockAmount,
                  startDate,
                  duration,
                  duration,
                  lockFee,
                  owner.address,
                  owner.address
              )
          ).to.be.revertedWith('Already locked');

        })

        it('unlock without lock', async () => {

          await expect(treasure.unlock(owner.address))
              .to.be.revertedWith('Not contributed');

          expect(await treasure.getContribution(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getLockFee(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getStartFarmingPoolDate(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.getLockDuration(owner.address, owner.address)).to.be.eq(0)
          expect(await treasure.totalLocked()).to.be.eq(0)
        })

        it('change fee recipient on zero address', async () => {

          await expect(treasure.changeFeeRecipient(
              zeroAddress
          )).to.be.revertedWith('Fee recipient can not be zero address');
        })

        it('change fee recipient', async () => {
          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 100;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await expect(treasure.connect(account1).changeFeeRecipient(
              account3.address
          )).to.be.revertedWith('Ownable: caller is not the owner');
        })

        it('wsd in constructor can not be zero', async () => {
          const Treasure = await ethers.getContractFactory("Treasure");

          await expect(Treasure.deploy(zeroAddress, owner.address, owner.address)
          ).to.be.revertedWith('Token can not be zero address');
        })

        it('fee recipient can not be zero', async () => {
          const Treasure = await ethers.getContractFactory("Treasure");

          await expect(Treasure.deploy(owner.address, zeroAddress, owner.address)
          ).to.be.revertedWith('FeeRecipient Can not be zero address');
        })

        it('change fee recipient can not be zero', async () => {
          await expect(treasure.changeFeeRecipient(
              zeroAddress
          )).to.be.revertedWith('Fee recipient can not be zero address');
        })

        it('percent 60 for lock', async () => {
          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 60;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await expect(treasure.connect(owner).lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              account3.address
          )).to.be.revertedWith('Too high fee')
        })

        it('invalid duration', async () => {
          let duration = 10;
          let lockAmount = 100;
          let lockFee = 2;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await expect(treasure.connect(owner).lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              account3.address
          )).to.be.revertedWith('Invalid duration')
        })

        it('not distributed', async () => {

          let duration = 31556926000;
          let lockAmount = 100;
          let lockFee = 5;
          let startDate = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp + 1;

          await treasure.lock(
              lockAmount,
              startDate,
              duration,
              duration,
              lockFee,
              owner.address,
              owner.address
          )

          endDate = startDate + duration;

          await ethers.provider.send('evm_increaseTime', [endDate]);

          await treasure.unlock(owner.address)

          await expect(treasure.unlock(account3.address))
              .to.be.revertedWith('Not contributed')
        })
      })
    });
  });
});
