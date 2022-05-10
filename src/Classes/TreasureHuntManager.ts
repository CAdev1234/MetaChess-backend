import { PlayEnum, PlayObjectResponse } from '../Enums/TreasureHuntingManager';
import { Account } from "./Player";
import { Globals } from '../globals';
import encryptor from "../Utils/Encryptor";
import { GetRandomNumber } from '../Utils/Helpers';
import { AccountState } from '../Enums/AccountState';


const BOARD_SQUARES = [
    "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8",
    "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
    "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
    "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8",
    "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
    "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8",
    "H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"
]

interface Treasure {
    level: number
    place: string
}

export class TreasureHuntGame {

    id: string
    user: string
    treasurePlaces: Treasure[]
    attempts: string[]
    leaveTimer: any
    gameStartDate!: number
    gameEndDate!: number
    treasuresFound: number
    account: Account
    maxAttempts: number
    leaveTimestamp?: number

    constructor(id: string, user: string, account: Account, maxAttempts: number)
    {
        this.id = id;
        this.treasurePlaces = [];
        this.attempts = [];
        this.gameStartDate = new Date().getTime();
        this.user = user;
        this.treasuresFound = 0;
        this.account = account;
        this.maxAttempts = maxAttempts;

        for (let i = 0; i < 6; i++) {

            let place: string | undefined;

            while (!place || this.treasurePlaces.some(t => t.place == place)) {
                const rand = GetRandomNumber(0, BOARD_SQUARES.length - 1);
                place = BOARD_SQUARES[rand];                
            }
            
            const randLevel = GetRandomNumber(1, 100);
            // 58, 30, 12
            const treasureLevel = randLevel <= 12 ? 3 :
                                 randLevel > 12 && randLevel <= 42 ? 2 :
                                 1;

            this.treasurePlaces.push({ place, level: treasureLevel });
            
        }
    }

    Play(place: string) : PlayObjectResponse | undefined {

        if (this.gameEndDate) return;

        if (this.attempts.length >= this.maxAttempts) return { status: PlayEnum.AttemptsExceeded };
        if (this.attempts.includes(place)) return { status: PlayEnum.PlaceAlreadyClicked };

        const treasureFound = this.treasurePlaces.find(t => t.place == place.toUpperCase());
        let level;

        if (treasureFound) {
            level = treasureFound.level;
            this.treasuresFound++;
        }

        this.attempts.push(place);

        return { status: this.attempts.length == this.maxAttempts ? PlayEnum.OKGameFinished : PlayEnum.OK, level };
    }

    LeaveGame(callback: Function) {

        if (this.gameEndDate || this.leaveTimestamp) return;

        this.leaveTimestamp = new Date().getTime();

        this.leaveTimer = setTimeout(() => {
            return callback && callback(this.id, this.account);
        }, 1000 * Globals.TreasureHuntingLeaveEndGame);
    }
    
    ResumeGame() {

        if (!this.leaveTimer) return null;

        this.leaveTimestamp = undefined;

        clearTimeout(this.leaveTimer);
        this.leaveTimer = null;        
    }

    
}

export class TreasureHuntManager {
    
    Rooms: Record<string, TreasureHuntGame>
    RoomsCount: number
    UserRoomId: Record<number, string>

    constructor() {
        this.Rooms = {};
        this.RoomsCount = 0;
        this.UserRoomId = {};
    }

    CreateGame(user: string, account: Account, maxAttempts: number): TreasureHuntGame {
        var roomId = encryptor.RandomString(32, {symbols: false});
        while (this.Rooms[roomId] != null) {
            roomId = encryptor.RandomString(32, {symbols: false});
        }
        this.Rooms[roomId] = new TreasureHuntGame(roomId, user, account, maxAttempts);
        this.UserRoomId[account.Id!] = roomId;
        this.RoomsCount++;

        return this.Rooms[roomId];
    }

    GameEnded(roomId: string) {
        const room = this.Rooms[roomId];
        room.gameEndDate = new Date().getTime();

        if (room.leaveTimer) {
            clearTimeout(room.leaveTimer);
            room.leaveTimer = true;
        }

    }

    DestroyRoom(roomId: string, updateAccountStatus: Function) {
        const room = this.Rooms[roomId];
        delete this.UserRoomId[room.account.Id!];    

        delete this.Rooms[roomId];
        this.RoomsCount--;

        (async () => {
            updateAccountStatus(room.account.Id!, AccountState.Lobby);
        })();
    }
}