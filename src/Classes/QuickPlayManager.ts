import { GetGameType, GameType, GetRandomBaseTime } from '../Enums/GameMode';
import { PieceSide } from '../Enums/PieceSide';
import { RoomType } from '../Enums/RoomType';
import Encryptor from '../Utils/Encryptor';
import { GetAccountKey, GetCorrectRating } from '../Utils/Helpers';
import { Account, Player } from './Player';
import { MinMax, GameRules, RoomManager, Room } from './RoomManager';

class QuickPlayQueue {
    socketId: string
    rating: MinMax
    gameRules: GameRules

    constructor(socketId: string, minMax: MinMax, gameRules: GameRules)
    {
        this.socketId = socketId;
        this.rating = minMax;
        this.gameRules = gameRules;
    }
}

export class QuickPlayManager {
    
    List: Record<string, QuickPlayQueue[]>
    UserQueue: Record<string, QuickPlayQueue>
    RoomManager: RoomManager
    Players: Record<string, Player>
    DataContext: any
    GameTypeQueues: Record<number, QuickPlayQueue[]>

    constructor(roomManager: RoomManager, players: Record<string, Player>, dataContext: any) {
        this.List = {};
        this.RoomManager = roomManager;
        this.Players = players;
        this.DataContext = dataContext;
        this.UserQueue = {};
        this.GameTypeQueues = {
            [GameType.Classical]: [],
            [GameType.Blitz]: [],
            [GameType.Rapid]: [],
            [GameType.Bullet]: []
        }

    }

    AddToQueue(user: string, account: Account, gameRules: GameRules, startGameCallback: (room: Room) => void) {

        (async () => {

            const timeKey = !gameRules.time ? null : `${gameRules.time.base}+${gameRules.time.increment}`;
            const playerElo = GetCorrectRating(account, gameRules.type);
            
            if (timeKey && this.List[timeKey]) {
                for (const queueItem of this.List[timeKey]) {

                    const userKey = GetAccountKey(this.Players[queueItem.socketId]?.account);
                    const roomId = this.RoomManager.UserRoomId[userKey!];

                    if (playerElo >= queueItem.rating.minium && playerElo <= queueItem.rating.maxium && gameRules.mode == queueItem.gameRules.mode && this.Players[queueItem.socketId] && !roomId) {

                        const room = this.RoomManager.CreateRoom(queueItem.socketId, this.Players[queueItem.socketId]!.account!, RoomType.Queue, gameRules, this.DataContext);
                        
                        this.RoomManager.JoinRoom(user, this.Players[user]!.account!, room.id)!;

                        const ind = this.List[timeKey].findIndex(e => e.socketId == queueItem.socketId);
                        this.List[timeKey].splice(ind, 1);

                        const ind2 = this.GameTypeQueues[gameRules.type].findIndex(e => e.socketId == queueItem.socketId);
                        this.GameTypeQueues[gameRules.type].splice(ind2, 1);
                        
                        delete this.UserQueue[userKey!];

                        startGameCallback(room);
                        
                        return;
                    }
                }
            }
            
            if (gameRules.type || gameRules.time) {
                for (const queueItem of this.GameTypeQueues[gameRules.type]) {

                    const userKey = GetAccountKey(this.Players[queueItem.socketId]?.account);
                    const roomId = this.RoomManager.UserRoomId[userKey!];

                    if (playerElo >= queueItem.rating.minium && playerElo <= queueItem.rating.maxium && gameRules.mode == queueItem.gameRules.mode && this.Players[queueItem.socketId] && !roomId) {

                        if (!gameRules.time && queueItem.gameRules.time) {
                            gameRules.time = {...queueItem.gameRules.time};
                            gameRules.type = GetGameType(gameRules.time.base);
                        }
                        if (!gameRules.time) {
                            const baseTime = GetRandomBaseTime(gameRules.type);
                            gameRules.time = {...baseTime};
                        }

                        const room = this.RoomManager.CreateRoom(queueItem.socketId, this.Players[queueItem.socketId]!.account!, RoomType.Queue, gameRules, this.DataContext);
                        
                        this.RoomManager.JoinRoom(user, this.Players[user]!.account!, room.id)!;

                        const ind2 = this.GameTypeQueues[gameRules.type].findIndex(e => e.socketId == queueItem.socketId);
                        this.GameTypeQueues[gameRules.type].splice(ind2, 1);
                        
                        delete this.UserQueue[userKey!];

                        startGameCallback(room);
                        
                        return;
                    }
                }
            }
            
            if (timeKey && this.RoomManager.OpenRoomsByTime[timeKey]) {
                for (const room of this.RoomManager.OpenRoomsByTime[timeKey]) {
                    const realRoom = this.RoomManager.Rooms[room.roomId];
                    if (playerElo >= room.rating.minium && playerElo <= room.rating.maxium && gameRules.mode == realRoom.gameRules.mode && !realRoom.secondPlayer) {

                        const _room = this.RoomManager.Rooms[room.roomId];
                        if (!_room.gameRules.time) {
                            _room.gameRules.time = {...gameRules.time};
                            _room.gameRules.type = GetGameType(gameRules.time.base);
                        }

                        this.RoomManager.JoinRoom(user, this.Players[user]!.account!, room.roomId)!;

                        startGameCallback(this.RoomManager.Rooms[room.roomId]);
                        
                        return;
                    }
                }
            }
            else if (!timeKey) {
                for (const room of this.RoomManager.OpenRoomsByType[gameRules.type]) {
                    const realRoom = this.RoomManager.Rooms[room.roomId];
                    if (playerElo >= room.rating.minium && playerElo <= room.rating.maxium && gameRules.mode == realRoom.gameRules.mode && !realRoom.secondPlayer) {

                        if (!realRoom.gameRules.time) {
                            const baseTime = GetRandomBaseTime(realRoom.gameRules.type);
                            realRoom.gameRules.time = {...baseTime};
                        }

                        this.RoomManager.JoinRoom(user, this.Players[user]!.account!, room.roomId)!;

                        startGameCallback(this.RoomManager.Rooms[room.roomId]);
                        
                        return;
                    }
                }
            }
            
            if (timeKey && !this.List[timeKey]) this.List[timeKey] = [];
            if (timeKey) gameRules.type = GetGameType(gameRules.time.base);
            gameRules.hostSide = PieceSide.Random;
            const quickPlay = new QuickPlayQueue(user, { minium: playerElo - 200, maxium: playerElo + 200 }, gameRules);
            this.UserQueue[GetAccountKey(account)!] = quickPlay;
            if (timeKey) this.List[timeKey].push(quickPlay);
            this.GameTypeQueues[gameRules.type].push(quickPlay);

        })();
    }

    CancelQueue(user: string): void {

        (async () => {

            const userKey = GetAccountKey(this.Players[user]?.account);
            const roomId = this.RoomManager.UserRoomId[userKey!];
            
            if (roomId) return;

            const room = this.UserQueue[userKey!];

            if (room.gameRules.time) {
                const timeKey = `${room.gameRules.time.base}+${room.gameRules.time.increment}`;

                const ind = this.List[timeKey].findIndex(e => e.socketId == user);
                if (ind != -1) this.List[timeKey].splice(ind, 1);
            }
            const ind2 = this.GameTypeQueues[room.gameRules.type].findIndex(e => e.socketId == user);
            if (ind2 != -1) this.GameTypeQueues[room.gameRules.type].splice(ind2, 1);

            delete this.UserQueue[userKey!];

        })();

    }
}