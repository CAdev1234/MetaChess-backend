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
    dbId: number;
    host: string
    hostAccount: Account;
    tournamentRules: TournamentRules;
    rooms: string[];
    // players: string[];
    hasStarted: boolean;
    hasEnded: boolean;
    registeredPlayers: Account[];

    constructor(id: string, host: string, tournamentRules: TournamentRules, account: Account)
    {
        this.id = id;
        this.dbId = 0;
        this.host = host;
        this.hostAccount = account;
        this.tournamentRules = tournamentRules;
        this.rooms = [];
        // this.players = [host];
        this.registeredPlayers = [account];
        this.hasStarted = false;
        this.hasEnded = false;
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
    async CreateTournament(user: string, account: Account, tournamentRules: TournamentRules, dataContext: any) {
        var tournamentId = encryptor.RandomString(32, {symbols: false});
        while (this.Tournaments[tournamentId] != null && await dataContext.Tournaments.findOne({where: {Identifier: tournamentId}}) == null) {
            tournamentId = encryptor.RandomString(32, {symbols: false});
        }
        const tourn = new Tournament(tournamentId, user, tournamentRules, account);
        
        const tournament = await dataContext.Tournaments.create({
            Identifier: tournamentId,
            AccountId: account.Id,
            Date: new Date().getTime(),
            BeginDate: tournamentRules.startDate.getTime(),
            EndDate: tournamentRules.endDate.getTime(),
            AmountOfPlayers: tournamentRules.amountOfPlayers,
            AccountIds: JSON.stringify(tourn.registeredPlayers.map(e => e.Id)),
            GameRules: JSON.stringify(tournamentRules.gameRules),
            Password: tournamentRules.password
        });

        tourn.dbId = tournament.Id;
        this.Tournaments[tournamentId] = tourn;
        this.TournamentsCount++;

        // TODO: Timer to start

        return this.Tournaments[tournamentId];

    }

    async LeaveTournament(user: string, tournamentId: string, players: Record<string, Player>, dataContext: any) {

        const tournament = this.Tournaments[tournamentId];

        if (!tournament || tournament.hasStarted) return;

        const player = players[user].account!;
        const isHost = players[user].account?.Id == tournament.hostAccount.Id;

        const playerInd = tournament.registeredPlayers.findIndex(e => e.Id == player.Id);
        if (playerInd == -1) return;
        
        tournament.registeredPlayers.splice(playerInd, 1);

        const dbTournament = await dataContext.Tournaments.findOne({ where: { Id: tournament.dbId }});

        if (isHost) {
            await dbTournament.destroy();
        }
        else {
            await dbTournament.update({
                AccountIds: JSON.stringify(tournament.registeredPlayers.map(e => e.Id))
            });
        }
    }
    // TODO: stop accepting people, tournament name, duration, TIME IN UTC, min duration is 45 min, cancel tournament if not 5 people
    async JoinTournament(user: string, account: Account, tournamentId: string, dataContext: any){
        // TODO: Limit players (min: 5, max: 500)
        const tournament = this.Tournaments[tournamentId];

        if (!tournament || tournament.hasStarted) return;

        const alreadyIn = tournament.registeredPlayers.some(e => e.Id == account.Id);

        if (alreadyIn) return;

        // this.Tournaments[tournamentId].players.push(user);
        this.Tournaments[tournamentId].registeredPlayers.push(account);
        
        const dbTournament = await dataContext.Tournaments.findOne({ where: { Id: tournament.dbId }});

        await dbTournament.update({
            AccountIds: JSON.stringify(tournament.registeredPlayers.map(e => e.Id))
        });

        return this.Tournaments[tournamentId];
    }

    DestroyTournament(tournamentId: string, spectators: Record<string, string>, io: any, updateAccountStatus: Function) {
        
        delete this.Tournaments[tournamentId];
        this.TournamentsCount--;
        
    }

    TournamentEnded(roomId: string) {
        const tournament = this.Tournaments[roomId];
        tournament.hasEnded = true;
    }

    TournamentStarted(tournamentId: string){
        
        const tournament = this.Tournaments[tournamentId];

        tournament.hasStarted = true;
    }

}