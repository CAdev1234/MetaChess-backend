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

interface History {
    move: string,
    fen: string,
    isCheck: boolean,
    isCheckmate: boolean,
    isRepetition: boolean,
    isDraw: boolean,
    isStalemate: boolean,
    timestamp: number
}

interface PlayerDrawHistory {
    pieceSide: PieceSide,
    askDate: number,
    responseDate: number | null,
    accepted: boolean | null,
}

export interface MinMax {
    minium: number
    maxium: number
}

interface Time {
    base: number
    increment: number
}

export interface GameRules {
    chessCoin: MinMax
    hostSide: PieceSide
    // rating: MinMax
    mode: GameMode
    time: Time
    type: GameType
}

export class Timer {
    isRunning: boolean
    finishCallBack!: Function
    startRoundTime!: number
    baseTime!: number;
    timeLeft!: number
    timer: any

    constructor(){
        this.isRunning = false;
    }

    
    init(minutes: number, callback: Function){
        this.finishCallBack = callback;
        this.timeLeft = 1000 * 60 * minutes;
        this.baseTime = this.timeLeft;
        this.isRunning = false;
    }
    
    pause(incrementSeconds?: number){
        if (!this.isRunning) return;
        
        clearTimeout(this.timer);
        this.timeLeft = this.timeLeft - (new Date().getTime() - this.startRoundTime);
        this.isRunning = false;
        
        if (incrementSeconds) this.timeLeft += incrementSeconds * 1000;
        if (this.timeLeft > this.baseTime) this.timeLeft = this.baseTime;
    }
    
    resume() {
        if (this.isRunning) return;
        this.startRoundTime = new Date().getTime();
        this.timer = setTimeout(this.finishCallBack, this.timeLeft);
        this.isRunning = true;
    }

    stop(){
        if (!this.isRunning) return;
        
        clearTimeout(this.timer);
        this.isRunning = false;
    }

}


class PlayerDraw {

    requests: Record<string, number>
    timer: any
    currentActiveRequestPlayer?: string | null

    constructor(){
        this.requests = {};
    }
}

class RoomByTime {
    roomId: string
    rating: MinMax

    constructor(roomId: string, minMax: MinMax)
    {
        this.roomId = roomId;
        this.rating = minMax;
    }
}

export class Room {
    id: string
    host: string
    secondPlayer?: string | null
    playerTurn?: string | null
    roomType: RoomType
    gameIsRunning: boolean
    game?: ChessInstance | null
    gameRules: GameRules
    hostTimer: Timer
    hostPieceSide!: PieceSide
    secondPlayerTimer: Timer
    history: Array<History>
    playerDrawHistory: Array<PlayerDrawHistory>
    gameStartDate!: number
    gameEndDate!: number
    lastHistoryMove: any

    hostInitialTimer: Timer
    secondPlayerInitialTimer: Timer

    hostLeaveTimer: any
    hostAccount: Account
    secondPlayerLeaveTimer: any
    secondPlayerAccount?: Account | null

    hostLeaveTimestamp?: number
    secondPlayerLeaveTimestamp?: number

    playerDraw: PlayerDraw

    spectators: Array<string>;
    spectatorsCount: number;

    spectatorsNotifications: SpectatorsNotification[];

    hostReady: boolean;
    secondPlayerReady: boolean;
    waitingForPlayersReady: boolean
    waitingForPlayersReadTimer: any;

    constructor(id: string, host: string, roomType: RoomType, gameRules: GameRules, account: Account)
    {
        this.id = id;
        this.host = host;
        this.roomType = roomType;
        this.gameIsRunning = false;
        this.gameRules = gameRules;
        this.hostTimer = new Timer();
        this.secondPlayerTimer = new Timer();
        this.history = [];
        this.playerDrawHistory = [];
        this.playerDraw = new PlayerDraw();
        this.hostAccount = account;
        this.hostInitialTimer = new Timer();
        this.secondPlayerInitialTimer = new Timer();
        this.spectators = [];
        this.spectatorsCount = 0;
        this.spectatorsNotifications = [];
        this.hostReady = false;
        this.secondPlayerReady = false;
        this.waitingForPlayersReady = false;
    }

    PlayerLeaveGame(user: string, callback: Function) {
        if (!this.gameIsRunning) return;

        const isHost = user == this.host;

        if (isHost) {
            if (this.hostLeaveTimer) return;
            this.hostLeaveTimestamp = new Date().getTime();
            this.hostLeaveTimer = setTimeout(() => {
                return callback && callback(this.id, isHost, this.hostAccount, this.secondPlayerAccount);
            }, 1000 * Globals.GameLeaveEndGame);
        }
        else {
            if (this.secondPlayerLeaveTimer) return;
            this.secondPlayerLeaveTimestamp = new Date().getTime();
            this.secondPlayerLeaveTimer = setTimeout(() => {
                return callback && callback(this.id, isHost, this.secondPlayerAccount, this.hostAccount);
            }, 1000 * Globals.GameLeaveEndGame);
        }

    }

    PlayerResumeGame(user: string, account: Account) : Room | null {

        if (!this.hostLeaveTimer && !this.secondPlayerLeaveTimer) return null;

        const isHost = account.Id == this.hostAccount.Id && account.GuestId == this.hostAccount.GuestId;

        if (isHost) {
            this.hostLeaveTimestamp = undefined;
            clearTimeout(this.hostLeaveTimer);
            this.hostLeaveTimer = null;
            this.host = user;
            if (this.playerTurn != this.secondPlayer) this.playerTurn = user;
        }
        else {
            this.secondPlayerLeaveTimestamp = undefined;
            clearTimeout(this.secondPlayerLeaveTimer);
            this.secondPlayerLeaveTimer = null;
            this.secondPlayer = user;
            if (this.playerTurn != this.host) this.playerTurn = user;
        }

        return this;
    }

    MovePiece(user: string, move: string) : MovePieceEnum {
        if (!this.gameIsRunning || !this.secondPlayer) return MovePieceEnum.GameNotStarted;
        if (this.playerTurn != user) return MovePieceEnum.NotYourTurn;
        if (this.game!.moves().indexOf(move) == -1) return MovePieceEnum.NotAValidMove;
        // if (this.game!.notatedMoves[move] == null) return MovePieceEnum.NotAValidMove;

        const isHostTurn = this.playerTurn == this.host;

        if (isHostTurn && this.hostInitialTimer.isRunning) this.hostInitialTimer.stop();
        else if (!isHostTurn && this.secondPlayerInitialTimer.isRunning) this.secondPlayerInitialTimer.stop();
        
        this.game!.move(move);

        const historyMove = {
            move,
            fen: this.game!.fen(),
            isCheck: this.game!.in_check(),
            isCheckmate: this.game!.in_checkmate(),
            isDraw: this.game!.in_draw(),
            isRepetition: this.game!.in_threefold_repetition(),
            isStalemate: this.game!.in_stalemate(),
            timestamp: new Date().getTime()
        };

        this.lastHistoryMove = historyMove;

        this.history.push(historyMove);

        return MovePieceEnum.OK;
    }


    AskForDraw(user: string, timeoutCallback?: Function | null) : boolean {

        if (!this.gameIsRunning || this.playerDraw.requests[user] >= 5 || this.playerDraw.currentActiveRequestPlayer) return false;

        this.playerDraw.currentActiveRequestPlayer = user;
        this.playerDraw.requests[user]++;

        this.playerDrawHistory.push({
            pieceSide: this.hostPieceSide!,
            responseDate: null,
            askDate: new Date().getTime(),
            accepted: null
        });

        this.playerDraw.timer = setTimeout(() => {
            if (!this.playerDraw.currentActiveRequestPlayer) return;

            this.playerDraw.currentActiveRequestPlayer = null;

            if (timeoutCallback) timeoutCallback();

        }, 1000*Globals.AskForDrawPrompt);

        return true;

    }

    ResponseToDraw(user: string, accepted: boolean) : boolean {
        
        if (!this.gameIsRunning || !this.playerDraw.currentActiveRequestPlayer || this.playerDraw.currentActiveRequestPlayer == user) return false;

        clearTimeout(this.playerDraw.timer);

        this.playerDrawHistory[this.playerDrawHistory.length - 1].accepted = accepted;
        this.playerDrawHistory[this.playerDrawHistory.length - 1].responseDate = new Date().getTime();

        this.playerDraw.currentActiveRequestPlayer = null;

        return true;
    }

    SkipTurn() : void {

        if (!this.gameIsRunning || !this.secondPlayer) return;

        const isHostTurn = this.playerTurn == this.host;

        if (isHostTurn) {
            this.hostTimer.pause(this.gameRules.time.increment);
            this.playerTurn = this.secondPlayer;
            if (this.history.length == 1) this.secondPlayerInitialTimer.resume();
            else this.secondPlayerTimer.resume();
        }
        else {
            this.secondPlayerTimer.pause(this.gameRules.time.increment);
            this.playerTurn = this.host;
            if (this.history.length == 1) this.hostInitialTimer.resume();
            else this.hostTimer.resume();
        }
    }

    SendSpectatorsNotification(type: SpectatorsNotificationType, acc: Account, io: any) {

        const notification = {
            Type: type,
            AccountId: acc.Id,
            GuestId: acc.GuestId,
            Timestamp: new Date().getTime()
        };

        this.spectatorsNotifications.push(notification);
        io.to(this.id).emit(SocketEvents.SPECTATORSNOTIFICATION, notification);
    }

    SendSpectatorMessage(message: string, acc: Account, io: any) {
        const notification = {
            Type: SpectatorsNotificationType.SpectatorMessage,
            Message: message,
            Account: acc.Id ? {
                Id: acc.Id,
                Avatar: acc.Avatar,
                Username: acc.Username,
            } : undefined,
            GuestId: acc.GuestId,
            Timestamp: new Date().getTime()
        };

        this.spectatorsNotifications.push(notification);
        io.to(this.id).emit(SocketEvents.SPECTATORSNOTIFICATION, notification);
    }

}

export class RoomManager {

    Rooms: Record<string, Room>
    UserRoomId: Record<string, string>
    OpenRoomsByTime: Record<string, RoomByTime[]>
    OpenRoomsByType: Record<number, RoomByTime[]>
    RoomsCount: number

    constructor() {
        this.Rooms = {};
        this.UserRoomId = {};
        this.OpenRoomsByTime = {};
        this.OpenRoomsByType = {
            [GameType.Classical]: [],
            [GameType.Blitz]: [],
            [GameType.Rapid]: [],
            [GameType.Bullet]: []
        };
        this.RoomsCount = 0;
    }
    async CreateRoom(user: string, account: Account, roomType: RoomType, gameRules: GameRules, dataContext: any) {
        var roomId = encryptor.RandomString(32, {symbols: false});
        while (this.Rooms[roomId] != null && await dataContext.GameHistories.findOne({where: {Identifier: roomId}}) == null) {
            roomId = encryptor.RandomString(32, {symbols: false});
        }
        this.Rooms[roomId] = new Room(roomId, user, roomType, gameRules, account);
        this.UserRoomId[GetAccountKey(account)!] = roomId;
        this.RoomsCount++;

        const timeKey = !gameRules.time ? null : `${gameRules.time.base}+${gameRules.time.increment}`;        
        if (timeKey && !this.OpenRoomsByTime[timeKey]) this.OpenRoomsByTime[timeKey] = [];
        const playerElo = GetCorrectRating(account, gameRules.type);
        const roomByTime = new RoomByTime(roomId, { minium: playerElo - 200, maxium: playerElo + 200 });
        if (timeKey) this.OpenRoomsByTime[timeKey].push(roomByTime);
        this.OpenRoomsByType[gameRules.type].push(roomByTime);

        return this.Rooms[roomId];

    }

    LeaveRoom(user: string, players: Record<string, Player>):any {

        const key = GetAccountKey(players[user].account!);
        
        if (!key || !this.UserRoomId[key]) return;

        const roomId = this.UserRoomId[key];

        // const isHost = this.Rooms[roomId].host == user;

        delete this.UserRoomId[key];

        
        // if (isHost) {
            
            (async () => {
                const timeKey = `${this.Rooms[roomId].gameRules.time.base}+${this.Rooms[roomId].gameRules.time.increment}`;
                const ind = this.OpenRoomsByTime[timeKey].findIndex(e => e.roomId == roomId);
                this.OpenRoomsByTime[timeKey].splice(ind, 1);

                const gameType = this.Rooms[roomId].gameRules.type;
                const ind2 = this.OpenRoomsByType[gameType].findIndex(e => e.roomId == roomId);
                this.OpenRoomsByType[gameType].splice(ind2, 1);
            })();
            
            delete this.Rooms[roomId];
            this.RoomsCount--;
        // }
        // else {
        //     const room = this.Rooms[roomId];
        //     room.secondPlayer = null;
        //     room.secondPlayerAccount = null;

        //     const timeKey = `${room.gameRules.time.base}+${room.gameRules.time.increment}`;        
        //     if (!this.OpenRoomsByTime[timeKey]) this.OpenRoomsByTime[timeKey] = [];
        //     const playerElo = GetCorrectRating(room.hostAccount, room.gameRules.type);
        //     const roomByTime = new RoomByTime(roomId, { minium: playerElo - 200, maxium: playerElo + 200 });
        //     this.OpenRoomsByTime[timeKey].push(roomByTime);
        //     this.OpenRoomsByType[room.gameRules.type].push(roomByTime);
        // }

        // return {hostLeft: isHost};

    }
    JoinRoom(user: string, account: Account, roomId: string){
        if (!this.Rooms[roomId] || this.Rooms[roomId].gameEndDate || this.Rooms[roomId].secondPlayer) return;

        this.UserRoomId[GetAccountKey(account)!] = roomId;

        const room = this.Rooms[roomId];

        room.waitingForPlayersReady = true;
        room.secondPlayer = user;
        room.secondPlayerAccount = account;

        (async () => {
            const timeKey = `${room.gameRules.time.base}+${room.gameRules.time.increment}`;
            const ind = this.OpenRoomsByTime[timeKey].findIndex(e => e.roomId == roomId);
            if (ind != -1) this.OpenRoomsByTime[timeKey].splice(ind, 1);

            const gameType = room.gameRules.type;
            const ind2 = this.OpenRoomsByType[gameType].findIndex(e => e.roomId == roomId);
            this.OpenRoomsByType[gameType].splice(ind2, 1);
        })();

        return this.Rooms[roomId];
    }
    DestroyRoom(roomId: string, spectators: Record<string, string>, io: any, updateAccountStatus: Function) {
        const room = this.Rooms[roomId];

        const key = GetAccountKey(room.hostAccount);
        const key2 = GetAccountKey(room.secondPlayerAccount!);

        if (key) delete this.UserRoomId[key];
        if (key2) delete this.UserRoomId[key2];

        if (room.spectatorsCount) {
            room.spectators.forEach((s: string) => {
                delete spectators[s];
            });
            io.of('/').in(room.id).clients((error: any, socketIds: any) => {
                if (error) throw error;
              
                socketIds.forEach((socketId: any) => io.sockets.sockets[socketId].leave(room.id));
              
            });
        }

        // room.hostTimer.stop();
        // room.secondPlayerTimer.stop();
        // if (room.hostLeaveTimer) {
        //     clearTimeout(room.hostLeaveTimer);
        //     room.hostLeaveTimer = true;
        // }
        // if (room.secondPlayerLeaveTimer) {
        //     clearTimeout(room.secondPlayerLeaveTimer);
        //     room.secondPlayerLeaveTimer = true;
        // }
        // if (room.playerDraw.timer) clearTimeout(room.playerDraw.timer);

        (async () => {
            const timeKey = `${this.Rooms[roomId].gameRules.time.base}+${this.Rooms[roomId].gameRules.time.increment}`;
            const ind = this.OpenRoomsByTime[timeKey].findIndex(e => e.roomId == roomId);
            this.OpenRoomsByTime[timeKey].splice(ind, 1);

            const gameType = this.Rooms[roomId].gameRules.type;
            const ind2 = this.OpenRoomsByType[gameType].findIndex(e => e.roomId == roomId);
            this.OpenRoomsByType[gameType].splice(ind2, 1);
        })();

        delete this.Rooms[roomId];
        this.RoomsCount--;

        if (room.hostAccount.Id) {
            (async () => {
                updateAccountStatus(room.hostAccount.Id!, AccountState.Lobby);
            })();
        }
        if (room.secondPlayerAccount?.Id) {
            (async () => {
                updateAccountStatus(room.secondPlayerAccount!.Id!, AccountState.Lobby);
            })();
        }
        
    }
    // PlayerDisconnected(user: string) {
    //     delete this.UserRoomId[user];
    // }
    AddSpectator(roomId: string, socket: any, players: Record<string, Player>, spectators: Record<string, string>, io: any) {
        const room = this.Rooms[roomId];
        spectators[socket.id] = roomId;
        room.spectators.push(socket.id);
        socket.join(roomId);
        room.spectatorsCount++;

        const specUsers = room.spectators.map((s: string) => 
        {
            const specUser = players[s].account!;

            return {
                Id: specUser.Id,
                GuestId: specUser.GuestId,
                Username: specUser.Username
            }
        });
        io.to(roomId).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
        io.to(room.host).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
        io.to(room.secondPlayer).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
    }
    RemoveSpectator(roomId: string, socket: any, players: Record<string, Player>, spectators: Record<string, string>, io: any) {
        const room = this.Rooms[roomId];
        delete spectators[socket.id];
        const ind = room.spectators.indexOf(socket.id);
        room.spectators.splice(ind, 1);
        room.spectatorsCount--;
        socket.leave(roomId);

        const specUsers = room.spectators.map((s: string) => 
        {
            const specUser = players[s].account!;

            return {
                Id: specUser.Id,
                GuestId: specUser.GuestId,
                Username: specUser.Username
            }
        });
        if (room.spectatorsCount) io.to(roomId).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
        io.to(room.host).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
        io.to(room.secondPlayer).emit(SocketEvents.SPECTATORSUPDATE, specUsers);
    }

    GameEnded(roomId: string) {
        const room = this.Rooms[roomId];
        room.gameIsRunning = false;
        room.gameEndDate = new Date().getTime();

        room.hostTimer.stop();
        room.secondPlayerTimer.stop();
        if (room.hostLeaveTimer) {
            clearTimeout(room.hostLeaveTimer);
            room.hostLeaveTimer = true;
        }
        if (room.secondPlayerLeaveTimer) {
            clearTimeout(room.secondPlayerLeaveTimer);
            room.secondPlayerLeaveTimer = true;
        }
        if (room.playerDraw.timer) clearTimeout(room.playerDraw.timer);

    }

    GamePreStarted(roomId: string, playerNotReadCallback: Function){
        const room = this.Rooms[roomId];

        room.playerTurn = room.gameRules.hostSide == PieceSide.White ? room.host :
                          room.gameRules.hostSide == PieceSide.Black ? room.secondPlayer :
                          Math.random() >= 0.5 ? room.host : room.secondPlayer;

        const isHostTurn = room.playerTurn == room.host;

        if (isHostTurn) room.hostPieceSide = PieceSide.White;
        else room.hostPieceSide = PieceSide.Black;

        room.playerDraw.requests[room.host] = 0;
        room.playerDraw.requests[room.secondPlayer!] = 0;        

        room.waitingForPlayersReadTimer = setTimeout(() => {
            playerNotReadCallback();
        }, 90 * 1000);
    }

    GameStarted(roomId: string, timeoutCallback: (player: string, room: Room) => void){

        
        const room = this.Rooms[roomId];

        clearTimeout(room.waitingForPlayersReadTimer);
        room.waitingForPlayersReadTimer = null;

        room.gameIsRunning = true;
        room.waitingForPlayersReady = false;

        const game = new Chess(); //chess.create();

        const isHostTurn = room.playerTurn == room.host;

        room.hostTimer.init(room.gameRules.time.base, () => {
            timeoutCallback(room.host, room);
        });

        room.secondPlayerTimer.init(room.gameRules.time.base, () => {
            timeoutCallback(room.secondPlayer!, room);
        });

        const initialTime = 0.4167; // 25 sec

        room.hostInitialTimer.init(initialTime, () => {
            timeoutCallback(room.host, room);
            // room.hostInitialTimer.stop();
            // room.hostTimer.resume();
        });

        room.secondPlayerInitialTimer.init(initialTime, () => {
            timeoutCallback(room.secondPlayer!, room);
            // room.secondPlayerInitialTimer.stop();
            // room.secondPlayerTimer.resume();
        });

        if (isHostTurn) room.hostInitialTimer.resume();
        else room.secondPlayerInitialTimer.resume();

        room.gameStartDate = new Date().getTime();

        room.game = game;
    }

}