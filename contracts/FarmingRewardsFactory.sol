//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Create2.sol';
import './interfaces/IFarmingRewards.sol';
import './interfaces/IWhiteSwapV2Factory.sol';
import './interfaces/ITreasure.sol';
import './FarmingRewards.sol';
import './Treasure.sol';

/** @title Farming rewards Factory. */
contract FarmingRewardsFactory is Ownable {
    using SafeERC20 for IERC20;

    /** ========== STATE VARIABLES ========== */

    uint8 public constant MINIMUM_STAKE_AMOUNT_FOR_OWNER = 1; //// Stake amount on deploy farming rewards
    uint8 private constant MAX_COMMISSION = 50; //// max project commission
    uint8 public wsUnlockCommissionPercent; //// current project commission

    address public immutable wsd; //// stakingToken for treasure
    address public immutable whiteswapV2Factory; //// address of factory
    address public immutable treasure; //// address of treasure
    address public immutable timeLock; //// timelock is owner for this contract with governance flow

    uint256 public lockAmount; //// current lock amount
    uint256 public iteratorIdFarmingPools; //// count of farming pools
    uint256 public constant MIN_STAKING_EXIT_TIME = 14 days; //// minimum time that accounts can farm in farming pool
    uint256 public constant MAX_STAKING_EXIT_TIME = 30 days; //// maximum time that accounts can farm in farming pool
    uint256 public constant MIN_EPOCH_DURATION = 30 days; //// minimum duration for farming pool that can be created by owner

    mapping(uint => FarmingPoolsInfo) public farmingInfo; //// list of all created farming pools

    //// info about farming pools
    struct FarmingPoolsInfo {
        uint256 id;
        address stakingToken;
        address rewardToken;
        uint256 startDate;
        uint256 endDate;
        uint256 totalReward;
        uint256 epochDuration;
        address farmingPool;
        address deployer;
    }

    //// event on deploy farming pools
    event FarmingPoolCreated(
        address indexed farmingRewards,
        address deployer,
        address rewardToken,
        address stakingToken,
        uint256 rewardAmount,
        uint256 startDate,
        uint256 endDate,
        uint256 epochDuration,
        uint256 minimumStakingExitTime
    );
    //events
    event LockAmountChanged(uint256 amount); //// changed lock amount in treasure
    event WSUnlockCommission(uint8 amount); //// changed amount of commission in farming pool

    /** @dev set base params for farming reward factory
      * @param _wsUnlockCommissionPercent percent of funds that would be charged on unlock
      * @param _lockAmount amount of wsd that would be charged on deploy
      * @param _wsd governance token
      * @param _timeLock governance issuer
      * @param _whiteswapV2Factory contract where stored all pairs to be able validate LP token
      */
    constructor(
        uint8 _wsUnlockCommissionPercent,
        uint256 _lockAmount,
        address _wsd,
        address _timeLock,
        address _whiteswapV2Factory
    ) {
        require(_lockAmount != 0, 'Lock can not be zero');
        require(_wsd != address(0), 'Wsd can not be zero');
        require(_timeLock != address(0), 'TimeLock can not be zero');
        require(_whiteswapV2Factory != address(0), 'WhiteswapV2Factory can not be zero');
        require(_wsUnlockCommissionPercent <= MAX_COMMISSION, 'Too high percent');

        wsd = _wsd;

        lockAmount = _lockAmount;
        wsUnlockCommissionPercent = _wsUnlockCommissionPercent;

        treasure = address(new Treasure(_wsd, msg.sender, address(this)));
        timeLock = _timeLock;
        transferOwnership(_timeLock);
        whiteswapV2Factory = _whiteswapV2Factory;

        emit LockAmountChanged(_lockAmount);
        emit WSUnlockCommission(_wsUnlockCommissionPercent);
    }

    /** @dev Changed lock amount for lock in affects treasure, can be changed by timelock through voting
      * @param _lockAmount amount of wsd token that will be locked on deploy farming pool
      * @return bool
      */
    function changeLockAmount(uint256 _lockAmount) external onlyOwner returns(bool) {
        require(_lockAmount != 0, 'Can not be zero');
        lockAmount = _lockAmount;

        emit LockAmountChanged(lockAmount);

        return true;
    }

    /** @dev Changed percent of commission on unlock affects treasure, can be changed by timelock through voting
      * @param _wsUnlockCommissionPercent new percent of commission which will be taken when unlock will be able
      * @return created address of farming pool
      */
    function changeWsUnlockCommissionPercent(uint8 _wsUnlockCommissionPercent) external onlyOwner returns(bool) {
        require(_wsUnlockCommissionPercent <= MAX_COMMISSION, 'Too high percent');

        wsUnlockCommissionPercent = _wsUnlockCommissionPercent;

        emit WSUnlockCommission(wsUnlockCommissionPercent);

        return true;
    }

    /** @dev Entry point for deploy farming pool
      * @param stakingToken address of token which will staked in
      * @param rewardToken address of token which will give rewards for stake staking token
      * @param startDate exact time from what time farming pool will be start distribute tokens
      * @param totalReward total amount of rewards how many will be distributed
      * @param epochDuration duration of farming pool
      * @param lockDuration duration of lock wsd, time when it will be unlock
      * @param minimumStakingExitTime minimum staking period which user will be not able to withdraw his funds
      */
    function deploy(
        address rewardToken,
        address stakingToken,
        uint256 totalReward,
        uint256 startDate,
        uint256 epochDuration,
        uint256 lockDuration,
        uint256 minimumStakingExitTime
    ) external {
        require(stakingToken != address(0), 'Staking token can not be zero');
        require(rewardToken != address(0), 'Reward token can not be zero');
        require(totalReward > 0, 'TotalReward can not be zero');
        require(epochDuration >= MIN_EPOCH_DURATION, 'Epoch duration less than min epoch duration');
        require(minimumStakingExitTime >= MIN_STAKING_EXIT_TIME, 'Can not be min staking time less than 14 days');
        require(minimumStakingExitTime <= MAX_STAKING_EXIT_TIME, 'Can not be max staking time greater than 30 days');
        require(totalReward >= epochDuration, 'Total reward must be greater than epoch duration');

        uint256 endDate = startDate + epochDuration;

        iteratorIdFarmingPools++;
        FarmingPoolsInfo memory newRewardsInfo;
        newRewardsInfo.id = iteratorIdFarmingPools;
        newRewardsInfo.stakingToken = stakingToken;
        newRewardsInfo.rewardToken = rewardToken;
        newRewardsInfo.startDate = startDate;
        newRewardsInfo.endDate = endDate;
        newRewardsInfo.totalReward = totalReward;
        newRewardsInfo.epochDuration = epochDuration;
        newRewardsInfo.deployer = msg.sender;

        address farmingRewards = deployFarmingRewards(
            msg.sender,
            rewardToken,
            stakingToken,
            totalReward,
            startDate,
            endDate,
            epochDuration,
            minimumStakingExitTime
        );

        newRewardsInfo.farmingPool = farmingRewards;
        farmingInfo[iteratorIdFarmingPools] = newRewardsInfo;

        validateLPToken(stakingToken);

        ITreasure(treasure).lock(
            lockAmount,
            startDate,
            lockDuration,
            epochDuration,
            wsUnlockCommissionPercent,
            farmingRewards,
            msg.sender
        );

        IERC20(rewardToken).safeTransferFrom(msg.sender, farmingRewards, totalReward);
        IFarmingRewards(farmingRewards).farm(MINIMUM_STAKE_AMOUNT_FOR_OWNER);

        uint256 balanceOf = IERC20(rewardToken).balanceOf(farmingRewards);
        require(balanceOf >= totalReward, 'Invalid amount');

        emit FarmingPoolCreated(
            farmingRewards,
            msg.sender,
            rewardToken,
            stakingToken,
            totalReward,
            startDate,
            endDate,
            epochDuration,
            minimumStakingExitTime
        );
    }

    /** @dev Getting farming reward address that would be deployed, to be able give approve
      * @param deployer address of token which will give rewards for stake staking token
      * @param rewardToken exact time from what time farming pool will be available
      * @param stakingToken total amount of rewards how many will be distributed
      * @param totalReward duration of farming pool
      * @param startDate duration of lock wsd, time when it will be unlock
      * @param epochDuration address of token which will staked in
      * @param minimumStakingExitTime address of token which will staked in
      * @return address of created farming pool
      */
    function getAddress(
        address deployer,
        address rewardToken,
        address stakingToken,
        uint256 totalReward,
        uint256 startDate,
        uint256 epochDuration,
        uint256 minimumStakingExitTime
    ) external view returns (address) {

        uint256 endDate = startDate + epochDuration;

        bytes32 bytecode = keccak256(abi.encodePacked(type(FarmingRewards).creationCode, abi.encode(
            address(this),
            deployer,
            rewardToken,
            stakingToken,
            totalReward,
            startDate,
            endDate,
            epochDuration,
            minimumStakingExitTime
        )));

        bytes32 salt = keccak256(abi.encodePacked(
            deployer,
            rewardToken,
            stakingToken,
            totalReward,
            startDate,
            endDate,
            epochDuration,
            minimumStakingExitTime
        ));

        return Create2.computeAddress(salt, bytecode);
    }

    /** @dev deploy farmingRewards through create2
      * @param _deployer address of token which will give rewards for stake staking token
      * @param _rewardToken exact time from what time farming pool will be available
      * @param _stakingToken total amount of rewards how many will be distributed
      * @param _rewardAmount duration of farming pool
      * @param _startDate duration of lock wsd, time when it will be unlock
      * @param _endDate minimum staking period which user will be not able to withdraw his funds
      * @param _epochDuration address of token which will staked in
      * @param _minimumStakingExitTime address of token which will staked in
      * @return farmingRewards address of created farming pool
      */
    function deployFarmingRewards(
        address _deployer,
        address _rewardToken,
        address _stakingToken,
        uint256 _rewardAmount,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _epochDuration,
        uint256 _minimumStakingExitTime
    ) internal returns(address farmingRewards) {

        //// getting bytecode of feature created farming pool
        bytes memory bytecode = abi.encodePacked(type(FarmingRewards).creationCode, abi.encode(
            address(this),
            _deployer,
            _rewardToken,
            _stakingToken,
            _rewardAmount,
            _startDate,
            _endDate,
            _epochDuration,
            _minimumStakingExitTime
        ));

        //// unique salt for each deployed farmingRewards
        bytes32 salt = keccak256(abi.encodePacked(
            _deployer,
            _rewardToken,
            _stakingToken,
            _rewardAmount,
            _startDate,
            _endDate,
            _epochDuration,
            _minimumStakingExitTime
        ));

        farmingRewards = Create2.deploy(0, salt, bytecode);

        return farmingRewards;
    }

    /** @dev validate lp token which will be staked in, must be from factory
      * @param lpToken address of LP token which will staked in, throw exception of not valid
      */
    function validateLPToken(address lpToken) internal view {
        uint256 pairLength = IWhiteSwapV2Factory(whiteswapV2Factory).allPairsLength();
        bool isWSLPToken = false;

        for (uint256 i = 0; i < pairLength; i++) {
            address pair = IWhiteSwapV2Factory(whiteswapV2Factory).allPairs(i);

            if (pair == lpToken) {
                isWSLPToken = true;
                break;
            }
        }

        require(isWSLPToken, 'Not valid LP token');
    }
}
