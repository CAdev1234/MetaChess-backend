// import chess, { GameClient } from "chess";
import {Chess, ChessInstance} from "chess.js"
import encryptor from "../Utils/Encryptor";
import { GetAccountKey, GetCorrectRating } from "../Utils/Helpers";
import { GameMode, GameType } from "../Enums/GameMode";
import {Account} from "../Classes/Player";
import {PieceSide} from "../Enums/PieceSide";
import {RoomType} from "../Enums/RoomType";
import { MovePieceEnum } from "../Enums/RoomManager";
import { Player } from "./Player";
import { Globals } from "../globals";
import { SocketEvents } from "./SocketEvents";
import { SpectatorsNotification, SpectatorsNotificationType } from "../Enums/Spectators";
import { AccountState } from "../Enums/AccountState";
import { GameRules } from "./RoomManager";

export interface TournamentRules {
    startDate: Date;
    endDate: Date;
    amountOfPlayers: number;
    gameRules: GameRules;
    password?: string;
}

export class Tournament {
    id: string
    host: string
    hostAccount: Account;
    tournamentRules: TournamentRules;
    rooms: string[];
    players: string[];
    hasStarted: boolean;
    hasEnded: boolean;
    registeredPlayers: Account[];
    password?: string;

    constructor(id: string, host: string, tournamentRules: TournamentRules, account: Account, password?: string)
    {
        this.id = id;
        this.host = host;
        this.hostAccount = account;
        this.tournamentRules = tournamentRules;
        this.rooms = [];
        this.players = [];
        this.registeredPlayers = [];
        this.hasStarted = false;
        this.hasEnded = false;
        this.password = password;
    }
    
}

export class TournamentManager {

    Tournaments: Record<string, Tournament>
    // UserTournamentIds: Record<string, string[]>
    TournamentsCount: number

    constructor() {
        this.Tournaments = {};
        // this.UserTournamentIds = {};
        this.TournamentsCount = 0;
    }
    CreateTournament(user: string, account: Account, tournamentRules: TournamentRules, dataContext: any) {
        var tournamentId = encryptor.RandomString(32, {symbols: false});
        // while (this.Tournaments[tournamentId] != null && dataContext.GameHistories.findOne({where: {Identifier: tournamentId}}) == null) {
        //     tournamentId = encryptor.RandomString(32, {symbols: false});
        // }
        this.Tournaments[tournamentId] = new Tournament(tournamentId, user, tournamentRules, account);
        this.TournamentsCount++;

        return this.Tournaments[tournamentId];

    }

    LeaveTournament(user: string, tournamentId: string, players: Record<string, Player>):any {

        const key = GetAccountKey(players[user].account!);
        
        if (!key) return;
            
        // (async () => {
        //     const timeKey = `${this.Rooms[roomId].gameRules.time.base}+${this.Rooms[roomId].gameRules.time.increment}`;
        //     const ind = this.OpenRoomsByTime[timeKey].findIndex(e => e.roomId == roomId);
        //     this.OpenRoomsByTime[timeKey].splice(ind, 1);

        //     const gameType = this.Rooms[roomId].gameRules.type;
        //     const ind2 = this.OpenRoomsByType[gameType].findIndex(e => e.roomId == roomId);
        //     this.OpenRoomsByType[gameType].splice(ind2, 1);
        // })();
        
        // delete this.Rooms[roomId];
        // this.RoomsCount--;

    }

    JoinTournament(user: string, account: Account, tournamentId: string){

        if (!this.Tournaments[tournamentId] || this.Tournaments[tournamentId].hasStarted) return;

        this.Tournaments[tournamentId].players.push(user);
        this.Tournaments[tournamentId].registeredPlayers.push(account);

        return this.Tournaments[tournamentId];
    }

    DestroyTournament(tournamentId: string, spectators: Record<string, string>, io: any, updateAccountStatus: Function) {
        
        delete this.Tournaments[tournamentId];
        this.TournamentsCount--;
        
    }

    GameEnded(roomId: string) {
        const tournament = this.Tournaments[roomId];
        tournament.hasEnded = true;
    }

    GameStarted(tournamentId: string){
        
        const tournament = this.Tournaments[tournamentId];

        tournament.hasStarted = true;
    }

}