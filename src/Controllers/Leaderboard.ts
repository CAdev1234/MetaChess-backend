import { GameMode, GameType } from "../Enums/GameMode";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { Globals, MaintenanceMode } from "../globals";
import { CheckEnumIsValid } from "../Utils/Helpers";
import { Op } from "sequelize";
import { RoomType } from "../Enums/RoomType";

export default (app: any, baseAppSettings: any, dataContext: any) => {

  app.get("/leaderboard/mostActive", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    let { beginDate, endDate, top, skip } = req.query;

    if (!top || !/[\d]+/.test(top)) top = 3;
    else top = parseInt(top);

    if (!skip || !/[\d]+/.test(skip)) skip = null;

    if (!beginDate || !endDate) return res.status(statusCode.BadRequest).send();

    const leaderboard = (await dataContext.Database.query(`select AccountId as Id, count(0) as Games
                                                            from GameHistory
                                                            where RoomType = ${RoomType.Queue} and AccountId is not null and GameStartDate >= ${new Date(parseInt(beginDate)).getTime()} and GameEndDate <= ${new Date(parseInt(endDate)).getTime()}
                                                            group by AccountId
                                                            order by Games desc
                                                            limit ${top}
                                                            ${skip ? `offset ${skip}` : ''}`))[0];

    const accounts = await dataContext.Accounts.findAll({where: {Id: leaderboard.map((e: any) => e.Id)}});

    const resolvedLeaderboard = leaderboard.map((board: any) => {

        const acc = accounts.find((acc: any) => acc.Id == board.Id);
        return {
            Account: {
                Id: acc.Id,
                Avatar: acc.Avatar,
                Username: acc.Username,
                WalletAddress: !acc.WalletAddress || acc.WalletAddress.length < 10 ? null : {
                  First5: acc.WalletAddress.substring(0, 5),
                  Last5: acc.WalletAddress.substring(acc.WalletAddress.length - 5, acc.WalletAddress.length)
                },
                AverageRating: (acc.ClassicalElo + acc.BlitzElo + acc.RapidElo + acc.BulletElo) / 4
            },
            Games: board.Games
        }
    });

    const count = await dataContext.GameHistories.count({
      where: {
        RoomType: RoomType.Queue,
        GameStartDate: {
          [Op.gt]: new Date(parseInt(beginDate)).getTime()
        },
        GameEndDate: {
          [Op.lt]: new Date(parseInt(endDate)).getTime()
        },
        AccountId: {
          [Op.ne]: null
        }
      },
      distinct: true,
      col: 'AccountId'
    });

    return res.status(statusCode.OK).send({
      count,
      results: resolvedLeaderboard
    });

  });

  app.get("/leaderboard/aiGames", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    let { beginDate, endDate, top, skip } = req.query;

    if (!top || !/[\d]+/.test(top)) top = 3;
    else top = parseInt(top);

    if (!skip || !/[\d]+/.test(skip)) skip = null;

    if (!beginDate || !endDate) return res.status(statusCode.BadRequest).send();

    const leaderboard = (await dataContext.Database.query(`select Id, SUM(case when Result = 1 then 1 else 0 end) as Wins, SUM(case when Result = 2 then 1 else 0 end) as Defeats, SUM(case when Result = 3 then 1 else 0 end) as Draws, count(0) as Games from
                                                            (
                                                                select AccountId as Id, Result
                                                                from AIGameHistory
                                                                where AccountId is not null and GameStartDate >= ${new Date(parseInt(beginDate)).getTime()} and GameEndDate <= ${new Date(parseInt(endDate)).getTime()}
                                                            ) a
                                                            group by Id
                                                            order by Games desc
                                                            limit ${top}
                                                            ${skip ? `offset ${skip}` : ''}`))[0];

    const accounts = await dataContext.Accounts.findAll({where: {Id: leaderboard.map((e: any) => e.Id)}});

    const resolvedLeaderboard = leaderboard.map((board: any) => {

        const acc = accounts.find((acc: any) => acc.Id == board.Id);
        return {
            Account: {
                Id: acc.Id,
                Avatar: acc.Avatar,
                Username: acc.Username,
                WalletAddress: !acc.WalletAddress || acc.WalletAddress.length < 10 ? null : {
                  First5: acc.WalletAddress.substring(0, 5),
                  Last5: acc.WalletAddress.substring(acc.WalletAddress - 5, acc.WalletAddress.length)
                },
                AverageRating: (acc.ClassicalElo + acc.BlitzElo + acc.RapidElo + acc.BulletElo) / 4
            },
            Games: board.Games,
            Wins: board.Wins,
            Defeats: board.Defeats,
            Draws: board.Draws
        }
    });

    const count = await dataContext.AIGameHistories.count({
      where: {
        GameStartDate: {
          [Op.gt]: new Date(parseInt(beginDate)).getTime()
        },
        GameEndDate: {
          [Op.lt]: new Date(parseInt(endDate)).getTime()
        },
        AccountId: {
          [Op.ne]: null
        }
      },
      distinct: true,
      col: 'AccountId'
    });

    return res.status(statusCode.OK).send({
      count,
      results: resolvedLeaderboard
    });

  });

  app.get("/leaderboard/rankingByRating", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    let { beginDate, endDate, top, skip, gameType } = req.query;

    if (!top || !/[\d]+/.test(top)) top = 3;
    else top = parseInt(top);

    if (!skip || !/[\d]+/.test(skip)) skip = null;

    if (!beginDate || !endDate || !gameType || !CheckEnumIsValid(GameType, gameType)) return res.status(statusCode.BadRequest).send();

    const gameTypeProp = GameType.Classical == gameType ? 'ClassicalElo' :
                         GameType.Blitz == gameType ? 'BlitzElo' :
                         GameType.Rapid == gameType ? 'RapidElo' :
                         'BulletElo';

    const leaderboard = (await dataContext.Database.query(`select a.Id, a.${gameTypeProp} as Rating, SUM(case when b.Result = 1 then 1 else 0 end) as Wins, SUM(case when b.Result = 2 then 1 else 0 end) as Defeats, SUM(case when b.Result = 3 then 1 else 0 end) as Draws, count(0) as Games
                                                            from Account a
                                                            inner join GameHistory b on a.Id = b.AccountId and b.GameMode = ${GameMode.Rated} and b.GameType = ${gameType} and b.GameStartDate >= ${new Date(parseInt(beginDate)).getTime()} and b.GameEndDate <= ${new Date(parseInt(endDate)).getTime()}
                                                            group by Id
                                                            order by Rating desc
                                                            limit ${top}
                                                            ${skip ? `offset ${skip}` : ''}`))[0];

    const accounts = await dataContext.Accounts.findAll({where: {Id: leaderboard.map((e: any) => e.Id)}});

    const resolvedLeaderboard = leaderboard.map((board: any) => {

        const acc = accounts.find((acc: any) => acc.Id == board.Id);
        return {
            Account: {
                Id: acc.Id,
                Avatar: acc.Avatar,
                Username: acc.Username,
                WalletAddress: !acc.WalletAddress || acc.WalletAddress.length < 10 ? null : {
                  First5: acc.WalletAddress.substring(0, 5),
                  Last5: acc.WalletAddress.substring(acc.WalletAddress - 5, acc.WalletAddress.length)
                }
            },
            Games: board.Games,
            Wins: board.Wins,
            Defeats: board.Defeats,
            Draws: board.Draws,
            Rating: board.Rating

        }
    });

    const count = await dataContext.GameHistories.count({
      where: {
        GameMode: GameMode.Rated,
        GameType: gameType,
        GameStartDate: {
          [Op.gt]: new Date(parseInt(beginDate)).getTime()
        },
        GameEndDate: {
          [Op.lt]: new Date(parseInt(endDate)).getTime()
        },
        AccountId: {
          [Op.ne]: null
        }
      },
      distinct: true,
      col: 'AccountId'
    });

    return res.status(statusCode.OK).send({
      count,
      results: resolvedLeaderboard
    });

  });
};
