//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

import './interfaces/ITreasure.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Treasure is ITreasure, Ownable {
    using SafeERC20 for IERC20;

    uint32 private constant ONE_YEAR = 31536000;
    uint8 private constant MAX_COMMISSION = 50;
    uint256 public totalLocked;
    address public immutable wsd;
    address public immutable farmingRewardFactory;
    address public feeRecipient;
    //account address => contract address => locked amount
    mapping(address => mapping(address => uint256)) private contributions;
    //account address => contract address => fee percent amount
    mapping(address => mapping(address => uint8)) private lockFee;
    //account address => contract address => timestamp lock duration
    mapping(address => mapping(address => uint256)) private lockDuration;
    //account address => contract address => timestamp startFarmingPool
    mapping(address => mapping(address => uint256)) private startFarmingPool;
    //account address => contract address => timestamp finish
    mapping(address => mapping(address => uint256)) private finishFarmingPool;
    mapping(address => mapping(address => bool)) private isDistributedLockedFunds;
    mapping(address => bool) public isAlreadyLockedContract;

    event FundsLocked(address indexed account, uint256 value);
    event FundsUnlocked(address indexed account, uint256 value);
    event FeeRecipientChanged(address indexed feeRecipient);

    /** @dev constructor
      * @param _wsd address of locked token
      * @param _feeRecipient address of receiver of fee
      * @param _farmingRewardFactory address of initiator of lock funds
     */
    constructor(address _wsd, address _feeRecipient, address _farmingRewardFactory) {
        require(_wsd != address(0), 'Token can not be zero address');
        require(_farmingRewardFactory != address(0), 'Factory can not be zero address');
        require(_feeRecipient != address(0), 'FeeRecipient Can not be zero address');

        wsd = _wsd;
        farmingRewardFactory = _farmingRewardFactory;
        transferOwnership(_feeRecipient);

        feeRecipient = _feeRecipient;
        emit FeeRecipientChanged(feeRecipient);
    }

    /** @dev Change recipient of fee
      * @param _feeRecipient address of new recipient
     */
    function changeFeeRecipient(address _feeRecipient) public onlyOwner override {
        require(_feeRecipient != address(0), 'Fee recipient can not be zero address');

        feeRecipient = _feeRecipient;

        emit FeeRecipientChanged(feeRecipient);
    }

    /** @dev Get date when unlock date will reached
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getUnlockDate(address account, address farmingPool) external view override returns(uint) {
        return finishFarmingPool[account][farmingPool];
    }

    /** @dev Get date when start date is start
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getStartFarmingPoolDate(address account, address farmingPool) external view override returns(uint) {
        return startFarmingPool[account][farmingPool];
    }

    /** @dev Get duration how long funds will be lock in contract
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getLockDuration(address account, address farmingPool) external view override returns(uint) {
        return lockDuration[account][farmingPool];
    }

    /** @dev Get fee amount, how many percent will be charged
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getLockFee(address account, address farmingPool) external view override returns(uint) {
        return lockFee[account][farmingPool];
    }

    /** @dev Get locked amount
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getContribution(address account, address farmingPool) external view override returns(uint) {
        return contributions[account][farmingPool];
    }

    /** @dev Get is exist such combination of address and farming pool in treasure
      * @param account address of deployer
      * @param farmingPool address of deployed farming pool
     */
    function getIsDistributedLockedFunds(address account, address farmingPool) external view override returns(bool) {
        return isDistributedLockedFunds[account][farmingPool];
    }

    /** @dev Lock funds for farming pool
      * @param lockAmount amount of locked wsd
      * @param farmingStart date when farming pool is start
      * @param _lockDuration duration of locked funds
      * @param epochDuration duration of farming pool
      * @param fee percent how many will charged
      * @param farmingPool address of farming poll related
      * @param account address if initiator deploy
     */
    function lock(
        uint256 lockAmount,
        uint256 farmingStart,
        uint256 _lockDuration,
        uint256 epochDuration,
        uint8 fee,
        address farmingPool,
        address account
    ) external override {
        require(msg.sender == farmingRewardFactory, 'Allowed only for factory');
        require(epochDuration > 0, 'Can not be zero duration');
        require(fee <= MAX_COMMISSION, 'Too high fee');
        require(!isAlreadyLockedContract[farmingPool], 'Already locked');
        require(farmingStart >= block.timestamp, 'Can not be in past');
        uint256 endDate;
        uint256 lockDurationModifier;

        if (epochDuration >= ONE_YEAR) {
            endDate = farmingStart + epochDuration;
            lockDurationModifier = epochDuration;
        } else {
            endDate = farmingStart + ONE_YEAR;
            lockDurationModifier = ONE_YEAR;
        }
        require(_lockDuration == lockDurationModifier, 'Invalid duration');

        contributions[account][farmingPool] = lockAmount;
        lockFee[account][farmingPool] = fee;

        startFarmingPool[account][farmingPool] = farmingStart;
        totalLocked = totalLocked + lockAmount;

        lockDuration[account][farmingPool] = _lockDuration;
        isDistributedLockedFunds[account][farmingPool] = false;
        isAlreadyLockedContract[farmingPool] = true;
        finishFarmingPool[account][farmingPool] = endDate;

        IERC20(wsd).safeTransferFrom(account, address(this), lockAmount);

        emit FundsLocked(account, lockAmount);
    }


    /** @dev Unlock locked funds commission will charged
      * @param farmingPool address of farming poll related
     */
    function unlock(address farmingPool) external override {
        require(!isDistributedLockedFunds[msg.sender][farmingPool], 'Already distributed');
        require(contributions[msg.sender][farmingPool] > 0, 'Not contributed');
        uint256 lockAmount = contributions[msg.sender][farmingPool];
        uint256 fee = lockFee[msg.sender][farmingPool];
        uint256 farmingPoolDuration = finishFarmingPool[msg.sender][farmingPool];

        require(farmingPoolDuration <= block.timestamp, 'Finish date is not reached');

        totalLocked = totalLocked - lockAmount;
        contributions[msg.sender][farmingPool] = 0;
        lockDuration[msg.sender][farmingPool] = 0;
        lockFee[msg.sender][farmingPool] = 0;
        startFarmingPool[msg.sender][farmingPool] = 0;
        isDistributedLockedFunds[msg.sender][farmingPool] = true;
        uint256 unlockAmount;

        if (fee > 0) {
            uint256 wsFeeAmount = lockAmount * fee / 100;
            unlockAmount = lockAmount - wsFeeAmount;
            IERC20(wsd).safeTransfer(feeRecipient, wsFeeAmount);
        } else {
            unlockAmount = lockAmount;
        }

        IERC20(wsd).safeTransfer(msg.sender, unlockAmount);

        emit FundsUnlocked(msg.sender, lockAmount);
    }
}
