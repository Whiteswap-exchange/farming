//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

interface ITreasure {
    function lock(
        uint256 lockAmount,
        uint256 farmingStart,
        uint256 lockDuration,
        uint256 epochDuration,
        uint8 fee,
        address farmingPool,
        address account
    ) external;

    function unlock(address farmingPool) external;

    function getStartFarmingPoolDate(address account, address farmingPool) external view returns(uint256);

    function getUnlockDate(address account, address farmingPool) external view returns(uint256);

    function getLockDuration(address account, address farmingPool) external view returns(uint256);

    function getLockFee(address account, address farmingPool) external view returns(uint256);

    function getContribution(address account, address farmingPool) external view returns(uint256);

    function getIsDistributedLockedFunds(address account, address farmingPool) external view returns(bool);

    function changeFeeRecipient(address _feeRecipient) external;
}
