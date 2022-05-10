import { Op, Sequelize } from "sequelize";
import { GameResultType } from "../Enums/GameStatus";
import { PuzzleStatus } from "../Enums/Puzzle";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { Globals, MaintenanceMode } from "../globals";
import { ValidateAuthorization } from "../Utils/dataContextValidations";
import { CheckEnumIsValid } from "../Utils/Helpers";

export default (app: any, puzzleGames: any, userPuzzleGames: any, baseAppSettings: any, dataContext: any) => {
    app.get('/puzzles/random', async (req: any, res: any) => {

        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();

        const puzzle = await dataContext.Puzzles.findOne({
            where: {
                Status: PuzzleStatus.Published
            },
            order: Sequelize.literal('rand()'),
        });

        const resolvedPuzzle = puzzle ? {
            Id: puzzle.Id,
            Name: puzzle.Name,
            BaseTime: puzzle.BaseTime,
            IncrementTime: puzzle.IncrementTime,
            IsWhite: puzzle.IsWhite,
            Type: puzzle.Type,
            SurviveTurns: puzzle.SurviveTurns,
            CreationDate: puzzle.CreationDate,
            Data: JSON.parse(puzzle.Data)
        } : null;

        return res.status(statusCode.OK).send(resolvedPuzzle);

    });

    app.post('/puzzles', async (req: any, res: any) => {

        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();

        const { authorization } = req.headers;
        const { Key, Result, BoardMoves } = req.body;

        if (!Key || !authorization || !puzzleGames[Key] || !Result || !BoardMoves || BoardMoves.length < 1 || !CheckEnumIsValid(GameResultType, Result)) return res.status(statusCode.BadRequest).send();

        let guest = await dataContext.Guests.findOne({
            where: { Identifier: authorization },
        });

        const addMatch = async (accountId?: number, guestId?: number) => {

            const aiGameData = puzzleGames[Key];

            await dataContext.PuzzleGameHistories.create({
                GuestId: guestId,
                PuzzleId: aiGameData.puzzleId,
                AccountId: accountId,
                Result: Result,
                BoardMoves: JSON.stringify(BoardMoves),
                GameStartDate: aiGameData.beginDate,
                GameEndDate: new Date().getTime()
            });

            puzzleGames[Key].done();

            delete puzzleGames[Key];
            delete userPuzzleGames[puzzleGames[Key].socketId];

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