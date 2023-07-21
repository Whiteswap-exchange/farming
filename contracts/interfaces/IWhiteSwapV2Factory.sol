//SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.19;

interface IWhiteSwapV2Factory {
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);
}
