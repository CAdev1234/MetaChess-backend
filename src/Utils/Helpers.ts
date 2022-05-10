import { GameType } from "../Enums/GameMode";
import {Account} from "../Classes/Player";

export function GetRandomNumber(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function GetCorrectRating(account: Account, gameType: GameType) : number {
    
    const eloTypeProp = gameType == GameType.Blitz ? "BlitzElo" :
                        gameType == GameType.Bullet ? "BulletElo" :
                        gameType == GameType.Rapid ? "RapidElo" :
                        "ClassicalElo";

    return account[eloTypeProp];
}

export const CheckEnumIsValid = (enumObj: any, enumValue: number) => Object.keys(enumObj).some(key => enumObj[key] == enumValue)

export const GetAccountKey = (account: Account | null) => !account ? null : account.Id || `g-${account.GuestId}`;