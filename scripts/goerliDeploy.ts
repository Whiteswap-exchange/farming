import fs from 'fs'
import { makeDeploy } from './deployBasic'
import dotenv from "dotenv";
import {BN} from "BN.js";

dotenv.config();
const NETWORK_NAME = 'goerli'
declare var process : {
  env: {
    INFURA_API_KEY: string
    PRIVATE_KEY: string
    WHITESWAP_V2_FACTORY: string
    TIMELOCK: string
    WSD: string
    LOCK_AMOUNT: number
    WS_UNLOCK_COMMISSION_PERCENT: number
  }
}
const INFURA_ID = process.env.INFURA_API_KEY.toString()
const PRIVATE_KEY = process.env.PRIVATE_KEY
const WHITESWAP_V2_FACTORY = process.env.WHITESWAP_V2_FACTORY
const TIMELOCK = process.env.TIMELOCK
const WSD = process.env.WSD
const LOCK_AMOUNT = process.env.LOCK_AMOUNT
const WS_UNLOCK_COMMISSION_PERCENT = process.env.WS_UNLOCK_COMMISSION_PERCENT

async function main() {
  try {
    await makeDeploy(
        NETWORK_NAME,
        INFURA_ID,
        WSD,
        PRIVATE_KEY,
        WHITESWAP_V2_FACTORY,
        TIMELOCK,
        LOCK_AMOUNT,
        WS_UNLOCK_COMMISSION_PERCENT)
  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }

}
main();
