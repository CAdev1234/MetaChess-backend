export enum SocketEvents {
    // Connections
    CONNECT = 'connection',
    DISCONNECT = 'disconnect',

    SETUSERTOKEN = 'set-user-token',
    SETGUESTTOKEN = 'set-guest-token',
    CREATECUSTOMGAME = 'create-custom-game',
    CAPTUREGAME = 'capture-game',
    STARTSPECTATING = 'start-spectating',
    STOPSPECTATING = 'stop-spectating',
    JOINGAME = 'join-game',
    GAMEREADY = 'game-ready',
    GAMECANCELLEDPLAYERNOTREADY = 'game-cancelled-player-not-ready',
    LEAVEGAME = 'leave-game',
    GAMESTART = 'game-start',
    GAMETIMEOUT = 'game-timeout',
    GAMECANCELLED = 'game-cancelled',
    MOVEPIECE = 'move-piece',
    RESIGN = 'resign',
    REQUESTDRAW = 'request-draw',
    ANSWERDRAWREQUEST = 'answer-draw-request',
    RESUMEMYGAME = 'resume-my-game',
    STARTAIGAME = 'start-ai-game',
    LEAVEAIGAME = 'leave-ai-game',
    STARTPUZZLEGAME = 'start-puzzle-game',
    LEAVEPUZZLEGAME = 'leave-puzzle-game',

    STARTTREASUREHUNT = 'start-treasure-hunt',
    TREASUREHUNTPLACE = 'treasure-hunt-place',
    RESUMEMYGAMETREASUREHUNT = 'resume-my-game-treasure-hunt',
    LEAVEGAMETREASUREHUNT = 'leave-game-treasure-hunt',
    RUNNINGMATCHTREASUREHUNT = 'running-match-treasure-hunt',

    SPECTATEPIECEMOVE = 'spectate-piece-move',
    SPECTATORSUPDATE = 'spectators-update',
    SPECTATORSNOTIFICATION = 'spectators-notification',

    ROOMSPAGE = 'rooms-page',

    USERDISCONNECT = 'user-disconnect',

    FRIENDSTATUS = 'friend-status',
    FRIENDADDED = 'friend-added',
    FRIENDREQUEST = 'friend-request',

    MESSAGE = 'message',
    GAMEMESSAGE = 'game-message',
    GAMESPECTATORMESSAGE = 'game-spectator-message',

    QUICKPLAY = 'quick-play',
    CANCELQUICKPLAY = 'cancel-quickplay',


    PLAYERLEFTMATCH = 'player-left-match',
    PLAYERRESUMEMATCH = 'player-resume-match',
    RUNNINGMATCH = 'running-match',

    CHECK = 'game-check',
    GAMEFINISH = 'game-finished',


    JOINROOMSPAGE = 'join-rooms-page',
    LEAVEGAMEPROMPT = 'leave-game-prompt',
    
    LEAVEROOMSPAGE = 'leave-rooms-page',

    APPSETTINGSCHANGE = 'app-settings-change',

    // Coin Transaction
    COINTXWITHDRAWSUCCESS = 'coin-transaction-withdraw-success'


    // // Creating Player
    // REGISTER = 'register',
    // SPAWN = 'spawn',
    // LOGIN = 'Login',

    // // Gameplay Events
    // MOVEPIECE = 'MovePiece',
    // CAPTURE = "Capture",
    // PROMOTION = "Promotion",
    // MESSAGE = "SendMessage",

    // // Game Request
    // REMATCH = "Rematch",
    // REQUESTDRAW = "RequestDraw",
    // ACCEPTDRAW = "AcceptDraw",
    // DECLINEDRAW = "DeclineDraw",
    // // Matchmaking
    // STARTMATCHMAKING = "StartMatchmaking",
    // MATCHREQUEST  = "MatchRequest",
    // CREATEGAME = "CreateGame",
};


// module.exports = class Events {
//     constructor() {
//         // Connections
//         this.CONNECT = 'connection';
//         this.DISCONNECT = 'disconnect';

//         // Creating Player
//         this.REGISTER = 'register';
//         this.SPAWN = 'spawn';
//         this.LOGIN = 'Login';

//         // Gameplay Events
//         this.MOVEPIECE = 'MovePiece';
//         this.CAPTURE = "Capture";
//         this.PROMOTION = "Promotion";
//         this.MESSAGE = "SendMessage";

//         // Game Request
//         this.REMATCH = "Rematch";
//         this.REQUESTDRAW = "RequestDraw";
//         this.ACCEPTDRAW = "AcceptDraw";
//         this.DECLINEDRAW = "DeclineDraw";
//         // Matchmaking
//         this.STARTMATCHMAKING = "StartMatchmaking";
//         this.MATCHREQUEST  = "MatchRequest";
//         this.CREATEGAME = "CreateGame";
//     }
// };