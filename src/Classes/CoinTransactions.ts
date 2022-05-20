import { Op } from "sequelize";
import { CoinTransactionType } from "../Enums/CoinTransactionType";
import dataContext from "../Models/DatabaseModels";

const Add = async (accountId: number, walletAddress: string | null = null, amount: number, type: CoinTransactionType, txHash: string | null = null, description: string | null = null, RunCount: number = 0) => {
    await dataContext.CoinTransactions.create({
        AccountId: accountId,
        Amount: amount,
        Type: type,
        TxHash: txHash,
        WalletAddress: walletAddress,
        Description: '',
        CreationDate: new Date().getTime()
    });
    
}

const ExistCoinTransactionByTxHash = async(txHash: string) => {
    const existCoinTransaction = await dataContext.CoinTransactions.findOne({
        where: {
            TxHash: txHash
        }
    })
    if (existCoinTransaction !== null) return true
    else return false
}

const DepositQuery = async (walletAddress: string | null = null, amount: number, type: CoinTransactionType, txHash: string, description: string | null = null) => {
    const isExistCoinTransaction = await CoinTransactions.ExistCoinTransactionByTxHash(txHash)
    if (isExistCoinTransaction) {
        console.log("CoinTransaction is already exist")
        return
    }
    let account = await dataContext.Accounts.findOne({
        where: {
            WalletAddress: walletAddress
        }
    });
    if (account === null) return
    await account.update({
        CoinBalance: account.CoinBalance + amount
    }).then((res: any) => console.log("====ddd===", res.CoinBalance));
    await dataContext.CoinTransactions.create({
        AccountId: account.Id,
        Amount: amount,
        Type: type,
        TxHash: txHash,
        Description: '',
        WalletAddress: walletAddress,
        CreationDate: new Date().getTime()
    });
    
}

const WithdrawQuery = async (id: number, txHash: string) => {
    const isExistCoinTransaction = await CoinTransactions.ExistCoinTransactionByTxHash(txHash)
    if (isExistCoinTransaction) {
        console.log("CoinTransaction is already exist")
        return
    }
    let coinTransaction = await dataContext.CoinTransactions.findOne({
        where: {
            Id: id
        }
    })
    if (coinTransaction === null) return
    await coinTransaction.update({
        TxHash: txHash,
        Type: CoinTransactionType.Withdraw
    })
    let account = await dataContext.Accounts.findOne({
        where: {
            Id: coinTransaction.AccountId
        }
    })
    
    if (account === null) return
    await account.update({
        CoinBalance: account.CoinBalance += coinTransaction.Amount
    })
    const sumRestPendingCoin = await SumPendingCoinAmount(account.Id)
    return {
        AccountId: account.Id,
        SumPendingCoin: sumRestPendingCoin,
        CoinBalance: account.CoinBalance
    }
}

const SumPendingCoinAmount = async(accountId: string) => {
    const sequelize = dataContext.Database
    const sum = await dataContext.CoinTransactions.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('Amount')), 'totalPendingCoin'],
        ],
        where: {
            AccountId: accountId,
            [Op.or]: [
                {Type: 7},
                {Type: 8}
            ]
        }
    });
    return Number(sum[0].dataValues.totalPendingCoin);
}

const CoinTransactions = {
    Add,
    DepositQuery,
    WithdrawQuery,
    SumPendingCoinAmount,
    ExistCoinTransactionByTxHash,
}

export default CoinTransactions;