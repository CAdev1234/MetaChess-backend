import CoinTransactions from "../Classes/CoinTransactions";
import { CoinTransactionType } from "../Enums/CoinTransactionType";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { MaintenanceMode } from "../globals";
import { ValidateAuthorization } from "../Utils/dataContextValidations";


export default (app: any, baseAppSettings: any, dataContext: any) => {
    app.post('/coinTransaction/withdraw', async (req: any, res: any) => {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        const { authorization } = req.headers;
        const { Amount, WalletAddress } = req.body;
        if (Amount <= 0) return res.status(statusCode.BadRequest).send();
        await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
            if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);
            const account = await dataContext.Accounts.findOne({where: {Id: accountId}});
            if (account.CoinBalance < Amount) return res.status(statusCode.NotAcceptable).send();
            
            await CoinTransactions.Add(account.Id, WalletAddress, Amount * (-1), CoinTransactionType.WithdrawRequest)
            const sumPendingCoin = await CoinTransactions.SumPendingCoinAmount(account.Id)
            return res.status(statusCode.OK).send({SumPendingCoin: sumPendingCoin});
        });

        
    })
}