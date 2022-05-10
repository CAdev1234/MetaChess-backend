import { Account } from "./Player";
import { GameType } from "../Enums/GameMode";



interface EloRatingResult {
    player1Rating: number
    player2Rating: number
}


function Probability(rating1: number, rating2: number) {
    return 1.0 * 1.0 / (1 + 1.0 *  
    (Math.pow(10, 1.0 * 
    (rating1 - rating2) / 400))); 
}

function CalculateK(account: Account, hasEloSubsequentlyOver2400: boolean, gameType: GameType) : number {
    if (hasEloSubsequentlyOver2400) return 10;
    else if (gameType == GameType.Blitz || gameType == GameType.Rapid || gameType == GameType.Bullet) return 20;
    else if (account.PlayedGames >= 30) return 40; // 40 for a player new to the rating list until he has completed events with at least 30 games
    else return 20;
}

export function EloRatingEarned(player1: Account, player2: Account, gameType: GameType, winner?: Account | null) {
    const eloTypeProp = gameType == GameType.Blitz ? "BlitzElo" :
                        gameType == GameType.Bullet ? "BulletElo" :
                        gameType == GameType.Rapid ? "RapidElo" :
                        "ClassicalElo";

    const eloTypeSubsequentlyProp = gameType == GameType.Blitz ? "BlitzEloSubsequentlyOver2400" :
                        gameType == GameType.Bullet ? "BulletEloSubsequentlyOver2400" :
                        gameType == GameType.Rapid ? "RapidEloSubsequentlyOver2400" :
                        "ClassicalEloSubsequentlyOver2400";   

    const player1Rating = player1[eloTypeProp];
    const player2Rating = player2[eloTypeProp];

    const player1Chance = Probability(player1Rating, player2Rating);
    const player2Chance = Probability(player2Rating, player1Rating);

    return {
        player1EarnedRating: parseFloat((CalculateK(player1, player1[eloTypeSubsequentlyProp], gameType) * ((winner == null ? .5 : player1.Id == winner.Id && player1.GuestId == winner.GuestId ? 1 : 0) - player2Chance)).toFixed(1)),
        player2EarnedRating: parseFloat((CalculateK(player2, player2[eloTypeSubsequentlyProp], gameType) * ((winner == null ? .5 : player2.Id == winner.Id && player2.GuestId == winner.GuestId ? 1 : 0) - player1Chance)).toFixed(1))
    }
}

export function EloRating(player1: Account, player2: Account, gameType: GameType, winner?: Account | null) : EloRatingResult {

    const eloTypeProp = gameType == GameType.Blitz ? "BlitzElo" :
                                    gameType == GameType.Bullet ? "BulletElo" :
                                    gameType == GameType.Rapid ? "RapidElo" :
                                    "ClassicalElo";

    const player1Rating = player1[eloTypeProp];
    const player2Rating = player2[eloTypeProp];

    const {player1EarnedRating, player2EarnedRating} = EloRatingEarned(player1, player2, gameType, winner);

    return {
        player1Rating: player1Rating + player1EarnedRating,
        player2Rating: player2Rating + player2EarnedRating
    }


}