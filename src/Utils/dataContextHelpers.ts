import { GameType, GameMode } from "../Enums/GameMode";
import { EloRating } from "../Classes/EloRating";
import { Room } from "../Classes/RoomManager";
import { Account } from "../Classes/Player";
import { RandomString } from "./Encryptor";
import { GameResultType } from "../Enums/GameStatus";
import { PieceSide } from "../Enums/PieceSide";
import { ResultCondition } from "../Enums/ResultCondition";
import { TreasureHuntGame } from "../Classes/TreasureHuntManager";


export async function UpdateRatings(dataContext: any, room: Room, host: Account, secondPlayer: Account, winner: Account | null) : Promise<any> {

    let hostUpdateModel: any = {}
    let secondPlayerUpdateModel: any = {};

    // const gameType = GetGameType(room.gameRules.time.base);
    
    const playerNewRating = EloRating(host, secondPlayer, room.gameRules.type, winner);

    const eloTypeProp = room.gameRules.type == GameType.Blitz ? "BlitzElo" :
                        room.gameRules.type == GameType.Bullet ? "BulletElo" :
                        room.gameRules.type == GameType.Rapid ? "RapidElo" :
                        "ClassicalElo";

    // const bestEloTypeProp = room.gameRules.type == GameType.Blitz ? "BestBlitzElo" :
    //                         room.gameRules.type == GameType.Bullet ? "BestBulletElo" :
    //                         room.gameRules.type == GameType.Rapid ? "BestRapidElo" :
    //                         "BestClassicalElo";



    // room.hostAccount![eloTypeProp] = playerNewRating.player1Rating;
    // room.secondPlayerAccount[eloTypeProp] = playerNewRating.player2Rating;

    const p1EloIncremented = playerNewRating.player1Rating - host[eloTypeProp];
    const p2EloIncremented = playerNewRating.player2Rating - secondPlayer[eloTypeProp];

    const p1r = Math.round(playerNewRating.player1Rating);
    const p2r = Math.round(playerNewRating.player2Rating);


    host[eloTypeProp] = p1r;
    secondPlayer[eloTypeProp] = p2r;

    // const bestElo = "Best" + eloTypeProp;

    // if (host[eloTypeProp] > host[bestEloTypeProp]) {
    //     host[bestEloTypeProp] = host[eloTypeProp];
    //     hostUpdateModel[bestEloTypeProp] = p1r;
    // }
    // if (secondPlayer[eloTypeProp] > secondPlayer[bestEloTypeProp]) {
    //     secondPlayer[bestEloTypeProp] = secondPlayer[eloTypeProp];
    //     secondPlayerUpdateModel[bestEloTypeProp] = p2r;
    // }

    hostUpdateModel[eloTypeProp] = p1r;
    secondPlayerUpdateModel[eloTypeProp] = p2r;
    
    if (host.GuestId) {
        await dataContext.Guests.update(hostUpdateModel, {
            where: {
                Id: host.GuestId
            }
        });
    }
    else {
        await dataContext.Accounts.update(hostUpdateModel, {
            where: {
                Id: host.Id
            }
        });
    }

    if (secondPlayer.GuestId) {
        await dataContext.Guests.update(secondPlayerUpdateModel, {
            where: {
                Id: secondPlayer.GuestId
            }
        });
    }
    else {
        await dataContext.Accounts.update(secondPlayerUpdateModel, {
            where: {
                Id: secondPlayer.Id
            }
        });
    }

    return {hostRating: p1EloIncremented, secondPlayerRating: p2EloIncremented};
}


export async function AddMatchHistory(dataContext: any, room: Room, host: Account, secondPlayer: Account, winner: Account | null, hostEloIncrement: number, secondPlayerEloIncrement: number, resultCondition: ResultCondition) {
    
    const history = JSON.stringify(room.history);
    const drawRequestHistory = JSON.stringify(room.playerDrawHistory);

    // const gameType = GetGameType(room.gameRules.time.base);

    // const eloTypeProp = room.gameRules.type == GameType.Blitz ? "BlitzWonGames" :
    //                     room.gameRules.type == GameType.Bullet ? "BulletWonGames" :
    //                     room.gameRules.type == GameType.Rapid ? "RapidWonGames" :
    //                     "ClassicalWonGames";

    const eloTypeProp = room.gameRules.type == GameType.Blitz ? "BlitzElo" :
                        room.gameRules.type == GameType.Bullet ? "BulletElo" :
                        room.gameRules.type == GameType.Rapid ? "RapidElo" :
                        "ClassicalElo";

    const eloTypeSubsequentlyProp = room.gameRules.type == GameType.Blitz ? "BlitzEloSubsequentlyOver2400" :
                        room.gameRules.type == GameType.Bullet ? "BulletEloSubsequentlyOver2400" :
                        room.gameRules.type == GameType.Rapid ? "RapidEloSubsequentlyOver2400" :
                        "ClassicalEloSubsequentlyOver2400";                     

    const isDraw = winner == null;
    const hostWon = isDraw ? null : host.Id == winner!.Id && host.GuestId == winner!.GuestId ? true : false;

    // if (!isDraw) {
    //     if (hostWon) host[eloTypeProp]++;
    //     else secondPlayer[eloTypeProp]++;
    // }

    host.PlayedGames++;
    secondPlayer.PlayedGames++;
                
    await dataContext.GameHistories.create({
        Identifier: room.id,
        RoomType: room.roomType,
        GameType: room.gameRules.type,
        Result: isDraw ? GameResultType.Draw : hostWon ? GameResultType.Win : GameResultType.Lose,
        GameMode: room.gameRules.mode,
        AccountId: host.Id ? host.Id : null,
        OpponentId: secondPlayer.Id ? secondPlayer.Id : null,
        GuestId: host.GuestId ? host.GuestId : null,
        OpponentGuestId: secondPlayer.GuestId ? secondPlayer.GuestId : null,
        BoardMoves: history,
        DrawRequestHistory: drawRequestHistory,
        PieceSide: room.hostPieceSide,
        EloEarned: hostEloIncrement,
        GameStartDate: room.gameStartDate,
        GameEndDate: room.gameEndDate,
        ClassicalElo: host.ClassicalElo,
        BlitzElo: host.BlitzElo,
        RapidElo: host.RapidElo,
        BulletElo: host.BulletElo,
        TimeBase: room.gameRules.time.base,
        TimeIncrement: room.gameRules.time.increment,
        ResultCondition: resultCondition
    });

    const subsequentlyUpdateModel = {
        [eloTypeSubsequentlyProp]: true
    }

    if (room.gameRules.mode == GameMode.Rated && !host[eloTypeSubsequentlyProp] && host[eloTypeProp] >= 2400)
    {

        const idType = host.Id ? "Id" : "GuestId";
        
        const counts = (await dataContext.Database.query(`select count(0) from (
                                                              select * from GameHistory where ${idType} = ${host[idType]} and GameMode = 2 order by Id desc limit 50
                                                          ) a
                                                          where ${host[eloTypeProp]} >= 2400`))[0][0];

        if (counts == 50) {
            if (host.GuestId) {
                await dataContext.Guests.update(subsequentlyUpdateModel, {
                    where: {
                        Id: host.GuestId
                    }
                });
            }
            else {
                await dataContext.Accounts.update(subsequentlyUpdateModel, {
                    where: {
                        Id: host.Id
                    }
                });
            }
            host[eloTypeSubsequentlyProp] = true;
        }

    }

    
    
    await dataContext.GameHistories.create({
        Identifier: room.id,
        RoomType: room.roomType,
        GameType: room.gameRules.type,
        Result: isDraw ? GameResultType.Draw : !hostWon ? GameResultType.Win : GameResultType.Lose,
        GameMode: room.gameRules.mode,
        AccountId: secondPlayer.Id ? secondPlayer.Id : null,
        OpponentId: host.Id ? host.Id : null,
        GuestId: secondPlayer.GuestId ? secondPlayer.GuestId : null,
        OpponentGuestId: host.GuestId ? host.GuestId : null,
        BoardMoves: history,
        DrawRequestHistory: drawRequestHistory,
        PieceSide: room.hostPieceSide == PieceSide.White ? PieceSide.Black : PieceSide.White,
        EloEarned: secondPlayerEloIncrement,
        GameStartDate: room.gameStartDate,
        GameEndDate: room.gameEndDate,
        ClassicalElo: secondPlayer.ClassicalElo,
        BlitzElo: secondPlayer.BlitzElo,
        RapidElo: secondPlayer.RapidElo,
        BulletElo: secondPlayer.BulletElo,
        TimeBase: room.gameRules.time.base,
        TimeIncrement: room.gameRules.time.increment,
        ResultCondition: resultCondition
    });


    if (room.gameRules.mode == GameMode.Rated && !secondPlayer[eloTypeSubsequentlyProp] && secondPlayer[eloTypeProp] >= 2400)
    {

        const idType = secondPlayer.Id ? "Id" : "GuestId";
        
        const counts = (await dataContext.Database.query(`select count(0) from (
                                                              select * from GameHistory where ${idType} = ${secondPlayer[idType]} and GameMode = 2 order by Id desc limit 50
                                                          ) a
                                                          where ${secondPlayer[eloTypeProp]} >= 2400`))[0][0];

        if (counts == 50) {
            if (secondPlayer.GuestId) {
                await dataContext.Guests.update(subsequentlyUpdateModel, {
                    where: {
                        Id: secondPlayer.GuestId
                    }
                });
            }
            else {
                await dataContext.Accounts.update(subsequentlyUpdateModel, {
                    where: {
                        Id: secondPlayer.Id
                    }
                });
            }
            secondPlayer[eloTypeSubsequentlyProp] = true;
        }

    }

}



export function GetMatchHistoryData(matchHistory: any) : any {
    return {
        Id: matchHistory.Id,
        StartDate: matchHistory.GameStartDate,
        EndDate: matchHistory.GameEndDate,
        Identifier: matchHistory.Identifier,
        PieceSide: matchHistory.PieceSide,
        EloEarned: matchHistory.EloEarned,
        GameMode: matchHistory.GameMode,
        BoardMoves: matchHistory.BoardMoves,
        ResultCondition: matchHistory.ResultCondition,
        Winner: matchHistory.Result == GameResultType.Draw ? null : matchHistory.Result == GameResultType.Win ? {
                    Id: matchHistory.Account.Id
                } : matchHistory.OpponentId != null ? {
                    Id: matchHistory.Opponent.Id
                } : {
                    GuestId: matchHistory.OpponentGuest.Id,
                },
        Opponent: matchHistory.OpponentId != null ? {
                    Id: matchHistory.Opponent.Id,
                    Username: matchHistory.Opponent.Username
                } : {
                    GuestId: matchHistory.OpponentGuest.Id,
                },
        Time: {
            base: matchHistory.TimeBase,
            increment: matchHistory.TimeIncrement
        }
    };
}



export async function AddTreasureHuntMatchHistory(dataContext: any, room: TreasureHuntGame, account: Account) {
    
    account.TreasureHuntTodayGames!++;
                
    await dataContext.TreasureHuntings.create({
        AccountId: account.Id,
        TreasurePlaces: JSON.stringify(room.treasurePlaces),
        Attempts: JSON.stringify(room.attempts),
        GameStartDate: room.gameStartDate,
        GameEndDate: room.gameEndDate,
        TreasuresFound: room.treasuresFound,
    });

}