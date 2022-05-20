export enum CoinTransactionType {
    Deposit = 1, // + 
    Withdraw = 2, // -
    TreasureQuestFee = 3, // +
    TreasureReward = 4, // +
    WeeklyReward = 5, // +
    MonthlyReward = 6, // +
    WithdrawRequest = 7,
    WithdrawPending = 8,
}

// when user call withdraw api, then 
// withdrawRequest -> withdrawPending -> withdraw