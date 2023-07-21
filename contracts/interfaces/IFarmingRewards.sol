//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

interface IFarmingRewards {
    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function getRewardForDuration() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOfStakingToken(address account) external view returns (uint);

    function farm(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;
}