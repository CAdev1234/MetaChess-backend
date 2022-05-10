import { StatusCode as statusCode } from "../Enums/StatusCode";
import { PieceSide as PieceSideEnum } from "../Enums/PieceSide";
import { Globals, MaintenanceMode } from "../globals";
import { ValidateAuthorization } from "../Utils/dataContextValidations";
import { CheckEnumIsValid } from "../Utils/Helpers";
import { GameResultType } from "../Enums/GameStatus";

export default (app: any, aiGames: any, userAiGames: any, baseAppSettings: any, dataContext: any) => {

    app.post('/aigame', async (req: any, res: any) => {

        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();

        const { authorization } = req.headers;
        const { Key, Result, PieceSide, BoardMoves } = req.body;

        if (!Key || !authorization || !aiGames[Key] || !Result || !PieceSide || !BoardMoves || BoardMoves.length < 5 || !CheckEnumIsValid(PieceSideEnum, PieceSide) || !CheckEnumIsValid(GameResultType, Result)) return res.status(statusCode.BadRequest).send();

        let guest = await dataContext.Guests.findOne({
            where: { Identifier: authorization },
        });

        const addMatch = async (accountId?: number, guestId?: number) => {

            const aiGameData = aiGames[Key];

            await dataContext.AIGameHistories.create({
                Level: aiGameData.level,
                GuestId: guestId,
                AccountId: accountId,
                Result: Result,
                PieceSide: PieceSide,
                BoardMoves: JSON.stringify(BoardMoves),
                GameStartDate: aiGameData.beginDate,
                GameEndDate: new Date().getTime()
            });

            aiGames[Key].done();

            delete aiGames[Key];
            delete userAiGames[aiGames[Key].socketId];

            return res.status(statusCode.OK).send();
        }

        if (guest) {
            await addMatch(undefined, guest.Id);
        }
        else {
            await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
                if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);
    
                const account = await dataContext.Accounts.findOne({where: {Id: accountId}});
    
                await addMatch(account.Id, undefined);
    
            });
        }



    });

}