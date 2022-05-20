// var shortid = require('shortid');

import { AccountState } from "../Enums/AccountState";

export interface Account {
    Id?: number;
    Username?: string;
    Email?: string;
    GuestId?: number;
    ClassicalElo: number;
    BlitzElo: number;
    RapidElo: number;
    BulletElo: number;
    Avatar?: string;
    WalletAddress?: string;
    CoinBalance?: number;

    // BestClassicalElo: number;
    // BestBlitzElo: number;
    // BestRapidElo: number;
    // BestBulletElo: number;

    ClassicalEloSubsequentlyOver2400: boolean;
    BlitzEloSubsequentlyOver2400: boolean;
    RapidEloSubsequentlyOver2400: boolean;
    BulletEloSubsequentlyOver2400: boolean;
    PlayedGames: number;
    TreasureHuntTodayGames?: number;
}

export class Player {
    account: Account | null
    state: AccountState
    constructor(){
        this.account = null;
        this.state = AccountState.Lobby;
    }
};