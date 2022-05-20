const Web3 = require('web3')
const MetaChessGAmeAbi = require("./abi/MetaChessGame.json");
import CoinTransactions from "./Classes/CoinTransactions";
import { SocketEvents } from "./Classes/SocketEvents";
import { CoinTransactionType } from "./Enums/CoinTransactionType";

const METACHESSGAME_CONTRACT_ADDRESS = process.env.METACHESSGAME_CONTRACT_ADDRESS;
const wssUrl = `${process.env.WSS_URL}bsc/${process.env.NODE_ENV === 'development' ? 'testnet' : 'mainnet'}/ws`
const web3 = new Web3(wssUrl);
const MetaChessGameContract = new web3.eth.Contract(MetaChessGAmeAbi, METACHESSGAME_CONTRACT_ADDRESS);

var socketInstance: any = null;



const depositDataCallback = async(event: any) => {
  // console.log(`===============deposit event==========${event}`)
  const isExistCoinTransaction = await CoinTransactions.ExistCoinTransactionByTxHash(event.transactionHash)
  if (isExistCoinTransaction) {
      console.log("CoinTransaction is already exist")
      return
  }
  let weiToEther = web3.utils.fromWei(event.returnValues._amount, 'ether')
  await CoinTransactions.DepositQuery(
    event.returnValues._userWallet,
    Number(weiToEther),
    CoinTransactionType.Deposit,
    event.transactionHash
  )
}
const depositChangeCallback = async (event: any) => {
  console.log('======================= changed  ========================')
}
const depositErrorCallback = async(event: any) => {
  console.log('======================= error  ========================')
}


const withdrawDataCallback = async(event: any) => {
  // console.log('------withdraw_event-----', event);
  const result = await CoinTransactions.WithdrawQuery(
    Number(event.returnValues._id),
    event.transactionHash
  )
  if (result === null || result === undefined) return
  socketInstance.emit(SocketEvents.COINTXWITHDRAWSUCCESS, {AccountId: result?.AccountId, SumPendingCoin: result?.SumPendingCoin, CoinBalance: result?.CoinBalance});
}
const withdrawChangeCallback = async(event: any) => {
  console.log('------withdraw_event-----');
}
const withdrawErrorCallback = async(event: any) => {
  console.log('------withdraw_event-----');
}

export const initContractEventListener = (io: any) => {
  MetaChessGameContract.events.DepositToUser({
    filter: {},
    fromBlock: process.env.START_BLOCK
  }, (error: any, event: any) => {})
  .on('data', depositDataCallback)
  .on('changed', depositChangeCallback)  
  .on('error', depositErrorCallback);
  
  
  MetaChessGameContract.events.WithdrawToUser({
    filter: {},
    fromBlock: process.env.START_BLOCK
  }, (error: any, event: any) => {})
  .on('data', withdrawDataCallback)
  .on('changed', withdrawChangeCallback)
  .on('error', withdrawErrorCallback)  

  io.on(SocketEvents.CONNECT, function (socket: any) {
    console.log("socket is connected......")
    socketInstance = socket
  })
}

