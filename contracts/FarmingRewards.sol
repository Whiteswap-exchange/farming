//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

import './interfaces/IFarmingRewards.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

/** @title Farming rewards. */
contract FarmingRewards is ReentrancyGuard, IFarmingRewards {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken; //// Interface of reward token
    IERC20 public immutable stakingToken; //// Interface of staking token  token

    uint256 public immutable startDate; //// Date when distribution starts
    uint256 public immutable endDate; //// Date when distribution ends
    uint256 public immutable epochDuration;   //// Duration of farming pool
    uint256 public immutable minimumStakingExitTime; //// MinimumStakingExitTime minimum staking time of staking tokens have to be unstake his locked funds

    uint256 public lastUpdateTime; //// Last time when it called
    uint256 public rewardPerTokenStored; //// Last updated reward per token
    uint256 public rewardAmount; //// Amount of reward token to be distributed by contract
    uint256 public rewardRate; // How many tokens will be distributed for each sec
    uint256 public currentCountAccounts; // how many accounts joined
    uint256 public distributedTokens; //// How many tokens are distributed by contract
    uint256 private _totalSupply; //// Amount of staked tokens

    address public immutable farmingRewardsFactory; //// address of factory
    address public immutable deployer; //// Issuer of deploy farming pool

    mapping(address => uint) public accountEnterFarm; //// Date when account starts farm

    mapping(address => uint) public userRewardPerTokenPaid; //// Equal rewardPerTokenStored
    mapping(address => uint) private rewards; //// How many tokens already earned by account
    mapping(address => uint) private _balances; //// How many tokens staked by account

    //address => id
    mapping(address => uint) public accountIdByAddress; //// Association account address and his id
    //id => address
    mapping(uint256 => address) public accountAddressById; //// Association account id and his address

    //// Info about created farmingPool
    event FarmingPoolInfo(
        address indexed farmingPool,
        address deployer,
        address indexed stakingToken,
        address indexed rewardToken,
        uint256 startDate,
        uint256 endDate,
        uint256 baseReward,
        uint256 epochDuration,
        uint256 minimumStakingExitTime
    );
    event Stake(address indexed user, uint256 amount); //// Event when account start farm
    event Withdrawn(address indexed user, uint256 amount); //// Event when account withdraw his funds
    event Reward(address indexed user, uint256 reward); //// Event when account withdraw his earned rewards
    event UpdatedRewardForEpoch(address indexed owner, uint256 reward); //// Event when recalculated rewards for account


    /** @dev Set base params for farming reward factory
      */
    modifier updateReward() {
        _updateRewardForEpoch(msg.sender);
        _;
    }

    /** @dev Check is available for account withdraw his staked funds
    */
    modifier earlyStakingExit() {
        uint256 unstakeAvailableDate = accountEnterFarm[msg.sender] + minimumStakingExitTime;
        require(
            block.timestamp > unstakeAvailableDate ||
            (unstakeAvailableDate > endDate && block.timestamp > endDate ) ||
            block.timestamp < startDate,
            'Fail unstake earlier then it available'
        );
        _;
    }

    /** @dev constructor
      * @param _farmingRewardsFactory address of factoryx farming pool
      * @param _deployer address of issuer creating farming pool
      * @param _rewardToken address of token which will give rewards for stake staking token
      * @param _stakingToken address of token which will staked in
      * @param _rewardAmount total amount of rewards how many will be distributed
      * @param _startDate exact time from what time farming pool will be start distribute tokens
      * @param _endDate exact time from what time farming pool will be stop distribute tokens
      * @param _epochDuration duration of farming pool
      * @param _minimumStakingExitTime minimum staking period which user will be not able to withdraw his funds
      */
    constructor(
        address _farmingRewardsFactory,
        address _deployer,
        address _rewardToken,
        address _stakingToken,
        uint256 _rewardAmount,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _epochDuration,
        uint256 _minimumStakingExitTime
    ) {
        require(_farmingRewardsFactory != address(0), 'FarmingRewardsFactory can not be zero address');
        require(_deployer != address(0), 'Deployer can not be zero address');
        require(_startDate > block.timestamp, 'StartDate must be in feature');
        require(_rewardToken != _stakingToken, 'Staking and reward tokens can not be the same.');
        require(_endDate > _startDate, 'Wrong end date epoch');
        require(_rewardAmount > 0, 'Wrong reward amount');
        require(_minimumStakingExitTime < _epochDuration, 'Wrong stake time');

        farmingRewardsFactory = _farmingRewardsFactory;
        deployer = _deployer;
        rewardToken = IERC20(_rewardToken);
        stakingToken = IERC20(_stakingToken);
        startDate = _startDate;
        endDate = _endDate;
        rewardAmount = _rewardAmount;
        epochDuration = _epochDuration;
        minimumStakingExitTime = _minimumStakingExitTime;
        rewardRate = _rewardAmount / _epochDuration;

        emit FarmingPoolInfo(
            address(this),
            _deployer,
            _stakingToken,
            _rewardToken,
            _startDate,
            _endDate,
            _rewardAmount,
            _epochDuration,
            _minimumStakingExitTime
        );

        emit UpdatedRewardForEpoch(_deployer, rewards[_deployer]);
    }

    /**  ========== VIEWS ========== */

    /** @dev Total staked LP token in farming pool
      * @return Amount of total staked LP token in farming pool
      */
    function totalSupply() external override view returns (uint256) {
        return _totalSupply;
    }

    /** @dev Balance of how many currently staked LP tokens
      * @param account address
      * @return Balance of how many currently staked LP tokens specific account
      */
    function balanceOfStakingToken(address account) external override view returns (uint256) {
        return _balances[account];
    }

    /** @dev Get addresses who exist in farming rewards
      * @return Balance of how many currently staked LP tokens specific account
      */
    function getActiveAccountCount() external view returns (uint256) {
        uint256 count;

        for(uint256 i = 1; i <= currentCountAccounts; i++) {
            if (accountAddressById[i] != address(0)) {
                count = count + 1;
            }
        }

        return count;
    }

    /** @dev Check how much reward tokens an address has earned
      * @return Earned reward
     */
    function earned(address account) external override view returns (uint256) {
        return _earned(account);
    }

    /** @dev Get rate reward tokens for duration
      * @return Rate of interest
     */
    function getRewardForDuration() external override view returns (uint256) {
        return rewardRate * (endDate- startDate);
    }

    //// @dev Exit and GetRewards in 1 transaction, receive LP tokens, and rewards tokens
    function exit() override external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /** @dev Calculate date when it last time calls
      * @return Valid date of run
     */
    function lastTimeRewardApplicable() external override view returns (uint256) {
        return _lastTimeRewardApplicable();
    }

    /** @dev Get reward token amount per staked token rate
      * @return Reward per token rate
     */
    function rewardPerToken() external override view returns (uint256) {
        return _rewardPerToken(_lastTimeRewardApplicable());
    }

    /** @dev Entry point to contract to be able to receive a reward
      * @param amount address of issuer creating farming pool
      */
    function farm(uint256 amount) nonReentrant external override {
        require(amount > 0, 'Cannot farm 0');
        require(block.timestamp < endDate, 'Farming pool already finished');

        address to = msg.sender;

        if (to == farmingRewardsFactory) {
            to = deployer;
        }

        _updateRewardForEpoch(to);

        if (accountIdByAddress[to] == 0) {
            currentCountAccounts = currentCountAccounts + 1;
            accountIdByAddress[to] = currentCountAccounts;
            accountAddressById[currentCountAccounts] = to;
        }

        if (block.timestamp >= startDate) {
            accountEnterFarm[to] = block.timestamp;
        } else {
            accountEnterFarm[to] = startDate;
        }

        _totalSupply = _totalSupply + amount;
        _balances[to] = _balances[to] + amount;

        stakingToken.safeTransferFrom(to, address(this), amount);

        emit Stake(to, amount);
    }

    /** @dev Withdraw staked LP tokens
      * @param amount address of issuer creating farming pool
      */
    function withdraw(uint256 amount) override public earlyStakingExit nonReentrant updateReward {
        if (msg.sender == deployer && block.timestamp < endDate) {
            revert("Unavailable withdraw");
        }
        if (_balances[msg.sender] > 0 ) {

            _totalSupply = _totalSupply - amount;
            _balances[msg.sender] = _balances[msg.sender] - amount;

            if (_balances[msg.sender] == 0) {
                accountEnterFarm[msg.sender] = 0;
                accountAddressById[accountIdByAddress[msg.sender]] = address(0);
                accountIdByAddress[msg.sender] = 0;
            }
            stakingToken.safeTransfer(msg.sender, amount);

            emit Withdrawn(msg.sender, amount);
        }
    }

    //// @dev Withdraw earned rewards tokens
    function getReward() override public nonReentrant updateReward {
        if (rewards[msg.sender] > 0) {
            uint256 reward = rewards[msg.sender];
            rewards[msg.sender] = 0;
            uint256 totalRewardDistributed;
            rewardAmount = rewardAmount - reward;
            rewardToken.safeTransfer(msg.sender, reward);
            totalRewardDistributed = totalRewardDistributed + reward;

            distributedTokens = distributedTokens + totalRewardDistributed;
            emit Reward(msg.sender, reward);
        }
    }

    /** @dev Recalculate rewards for account
      * @param account address of issuer
      */
    function _updateRewardForEpoch(address account) internal {
        uint256 lastTime = _lastTimeRewardApplicable();
        rewardPerTokenStored = _rewardPerToken(lastTime);
        lastUpdateTime = lastTime;

        rewards[account] = _earnedForCalculation(account, rewardPerTokenStored);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;

        emit UpdatedRewardForEpoch(account, rewards[account]);
    }

    /** @dev Calculate date when it last time calls
      * @return Valid date of run
     */
    function _lastTimeRewardApplicable() internal view returns (uint256) {
        if (block.timestamp < startDate) {
            return startDate;
        }
        return Math.min(block.timestamp, endDate);
    }

    /** @dev Get reward token amount per staked token rate
      * @return Reward per token rate
     */
    function _rewardPerToken(uint _lastTime) internal view returns (uint256) {
        if (block.timestamp < startDate) {
            return 0;
        }

        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return rewardPerTokenStored + (
        (_lastTime - lastUpdateTime) *
        rewardRate * 1e18
        ) / _totalSupply;
    }

    /** @dev Check how much reward tokens an address has earned
      * @return Earned reward
     */
    function _earnedForCalculation(address account, uint256 _rewardPerTokenLocal) internal view returns (uint256) {

        return _balances[account] *
        (_rewardPerTokenLocal - userRewardPerTokenPaid[account]) /
        1e18 +
        rewards[account];
    }

    /** @dev Check how much reward tokens an address has earned
      * @return Earned reward
     */
    function _earned(address account) internal view returns (uint256) {
        return _balances[account] *
        (_rewardPerToken(_lastTimeRewardApplicable()) - userRewardPerTokenPaid[account]) /
        1e18 +
        rewards[account];
    }
}