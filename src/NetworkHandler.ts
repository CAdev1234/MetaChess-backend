import { SocketEvents } from "./Classes/SocketEvents";
import { RoomType } from "./Enums/RoomType";
import encryptor, { RandomString } from "./Utils/Encryptor";
import { GameRules, RoomManager } from "./Classes/RoomManager";
import { Player, Account } from "./Classes/Player";
import { MovePieceEnum } from "./Enums/RoomManager";
import { GameResultType } from "./Enums/GameStatus";
import { GetGameType, GameType, GameMode } from "./Enums/GameMode";
import { EloRatingEarned } from "./Classes/EloRating";
import { PieceSide } from "./Enums/PieceSide";
import {
  UpdateRatings,
  AddMatchHistory,
  GetMatchHistoryData,
  AddTreasureHuntMatchHistory,
} from "./Utils/dataContextHelpers";
import { RoomEvent } from "./Enums/RoomEvent";
import { LogType } from "./Enums/LogType";
import { LogCategory } from "./Enums/LogCategory";
import { JoinRoomEnum } from "./Enums/JoinRoomEnum";
import { ResultCondition } from "./Enums/ResultCondition";
import { Globals, MaintenanceMode } from "./globals";
import { QuickPlayManager } from "./Classes/QuickPlayManager";
import { TreasureHuntManager } from "./Classes/TreasureHuntManager";
import { PlayEnum } from "./Enums/TreasureHuntingManager";
import { Op } from "sequelize";
import { GetAccountKey } from "./Utils/Helpers";
import { SpectatorsNotificationType } from "./Enums/Spectators";
import { AccountState } from "./Enums/AccountState";

const overrideSessions: any = {};

export default (
  dataContext: any,
  players: Record<string, Player>,
  playersIds: Record<string, string>,
  aiGames: Record<string, any>,
  userAiGames: Record<string, string>,
  puzzleGames: Record<string, any>,
  userPuzzleGames: Record<string, string>,
  spectators: Record<string, string>,
  roomManager: RoomManager,
  quickPlayManager: QuickPlayManager,
  treasureHuntManager: TreasureHuntManager,
  baseAppSettings: any,
  io: any
) => {

  Globals.AddAppSettingsChangeListener(() => {
    io.emit(SocketEvents.APPSETTINGSCHANGE, baseAppSettings);
  });

  const disconnectedPlayerRooms: Record<string, string> = {};
  const disconnectedPlayerTreasureHunts: Record<string, string> = {};  

  const GameTimeoutCallback = async (player: any, room: any) => {

    try {

      if (
        !roomManager.Rooms[room.id] ||
        !roomManager.Rooms[room.id].gameIsRunning
      )
        return;

      roomManager.GameEnded(room.id);

      let winner = null;
      const gameCancelled = roomManager.Rooms[room.id].history.length < 2;

      if (gameCancelled) {
        io.to(room.host).emit(SocketEvents.GAMECANCELLED, undefined);
        io.to(room.secondPlayer).emit(SocketEvents.GAMECANCELLED, undefined);
        room.SendSpectatorsNotification(SpectatorsNotificationType.Cancelled, player == room.host ? room.hostAccount : room.secondPlayerAccount!, io);
      } else {
        winner =
          player == room.host
            ? room.secondPlayerAccount
            : room.hostAccount!;

        io.to(room.host).emit(SocketEvents.GAMETIMEOUT, { winner });
        io.to(room.secondPlayer).emit(SocketEvents.GAMETIMEOUT, { winner });
      }

      const hostAccount = room.hostAccount!;
      const secondPlayerAccount = room.secondPlayerAccount;

      const keyHost = hostAccount.Id
        ? `account-${hostAccount.Id}`
        : `guest-${hostAccount.GuestId}`;
      const keySecondPlayer = secondPlayerAccount.Id
        ? `account-${secondPlayerAccount.Id}`
        : `guest-${secondPlayerAccount.GuestId}`;

      if (disconnectedPlayerRooms[keyHost])
        delete disconnectedPlayerRooms[keyHost];
      if (disconnectedPlayerRooms[keySecondPlayer])
        delete disconnectedPlayerRooms[keySecondPlayer];

      if (!gameCancelled) {
        let p1RatingInc = null,
          p2RatingInc = null;

        if (room.gameRules.mode == GameMode.Rated) {
          const { hostRating, secondPlayerRating } = await UpdateRatings(
            dataContext,
            room,
            hostAccount,
            secondPlayerAccount,
            winner
          );
          p1RatingInc = hostRating;
          p2RatingInc = secondPlayerRating;
        }

        await AddMatchHistory(
          dataContext,
          room,
          hostAccount,
          secondPlayerAccount,
          winner,
          p1RatingInc,
          p2RatingInc,
          ResultCondition.Timeout
        );
      }

      roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);    
      
    } catch (error: any) {
      dataContext.Logs.create({
        Message: error.stack,
        Type: LogType.Error,
        Category: LogCategory.Socket,
        Date: new Date().getTime(),
      });
    }

  };

  const UpdateStatusToFriends = async (
    accountId: number,
    state: AccountState
  ) => {
    try {
      if (state != AccountState.Offline && !playersIds[accountId]) return;
      
      players[playersIds[accountId]].state = state;

      const account = await dataContext.Accounts.findOne({
        include: [
          {
            model: dataContext.Accounts,
            as: "Friends",
            through: {
              where: {
                IsRejected: false,
                IsAccepted: true,
                IsRemoved: false,
              },
            },
          },
          {
            model: dataContext.Accounts,
            as: "AccountFriends",
            through: {
              where: {
                IsRejected: false,
                IsAccepted: true,
                IsRemoved: false,
              },
            },
          },
        ],
        where: {
          Id: accountId,
        },
      });

      [...account.Friends, ...account.AccountFriends].forEach((acc: any) => {
        if (playersIds[acc.Id]) {
          io.to(playersIds[acc.Id]).emit(SocketEvents.FRIENDSTATUS, {
            Id: acc.Friend.Id,
            State: state,
          });
        }
        // if (playersIds[acc.Id] && playersIds[acc.Id].length) {
        //   playersIds[acc.Id].forEach((socketId: string) => {
        //     io.to(socketId).emit(SocketEvents.FRIENDSTATUS, {
        //       Id: acc.Friend.Id,
        //       Online: goesOnline,
        //     });
        //   });
        // }
      });    
      
    } catch (error: any) {
      dataContext.Logs.create({
        Message: error.stack,
        Type: LogType.Error,
        Category: LogCategory.Socket,
        Date: new Date().getTime(),
      });
    }
  };

  const PlayerLeftCallback = async (
    roomId: string,
    loserIsHost: boolean,
    account: Account,
    winner: Account
  ) => {

    try {

      const room = roomManager.Rooms[roomId];

      if (!room) return;

      roomManager.GameEnded(roomId);

      const key = account!.Id
                ? `account-${account!.Id}`
                : `guest-${account!.GuestId}`;

      delete disconnectedPlayerRooms[key];

      if (room.hostLeaveTimer && room.secondPlayerLeaveTimer) {
        const hostAccount = loserIsHost ? account : winner;
        const secondPlayerAccount = loserIsHost ? winner : account;

        const otherKey = winner!.Id
          ? `account-${winner!.Id}`
          : `guest-${winner!.GuestId}`;
        delete disconnectedPlayerRooms[otherKey];

        let p1RatingInc = null,
          p2RatingInc = null;

        if (room.gameRules.mode == GameMode.Rated) {
          const { hostRating, secondPlayerRating } =
            await UpdateRatings(
              dataContext,
              room,
              hostAccount,
              secondPlayerAccount,
              null
            );
          p1RatingInc = hostRating;
          p2RatingInc = secondPlayerRating;
        }

        await AddMatchHistory(
          dataContext,
          room,
          hostAccount,
          secondPlayerAccount,
          null,
          p1RatingInc,
          p2RatingInc,
          ResultCondition.Leave
        );

        roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
      } else {
        const winnerSocketId = loserIsHost
          ? room.secondPlayer
          : room.host;

        io.to(winnerSocketId).emit(
          SocketEvents.LEAVEGAMEPROMPT,
          null
        );

        setTimeout(async () => {
          if (!roomManager.Rooms[roomId]) return;

          let p1RatingInc = null,
            p2RatingInc = null;

          const hostAccount = room.hostAccount;
          const secondPlayerAccount = room.secondPlayerAccount!;

          if (room.gameRules.mode == GameMode.Rated) {
            const { hostRating, secondPlayerRating } =
              await UpdateRatings(
                dataContext,
                room,
                hostAccount,
                secondPlayerAccount,
                null
              );
            p1RatingInc = hostRating;
            p2RatingInc = secondPlayerRating;
          }

          await AddMatchHistory(
            dataContext,
            room,
            hostAccount,
            secondPlayerAccount,
            null,
            p1RatingInc,
            p2RatingInc,
            ResultCondition.Leave
          );

          roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
        }, 1000 * Globals.GameLeaveEndGamePrompt);
      } 
    } catch (error: any) {
      dataContext.Logs.create({
        Message: error.stack,
        Type: LogType.Error,
        Category: LogCategory.Socket,
        Date: new Date().getTime(),
      });
    }
  }

  const PlayerLeftTreasureHuntCallback = async (
    roomId: string,
    account: Account
  ) => {
    try {
      const room = treasureHuntManager.Rooms[roomId];

      if (!room) return;

      treasureHuntManager.GameEnded(roomId);

      const key = account!.Id!;

      delete disconnectedPlayerTreasureHunts[key];
      
      await AddTreasureHuntMatchHistory(dataContext, room, account);

      treasureHuntManager.DestroyRoom(room.id, UpdateStatusToFriends);
        
    } catch (error: any) {
      dataContext.Logs.create({
        Message: error.stack,
        Type: LogType.Error,
        Category: LogCategory.Socket,
        Date: new Date().getTime(),
      });
    }
    
  }

  io.on(SocketEvents.CONNECT, function (socket: any) {
    var player = new Player();

    players[socket.id] = player;

    socket.on(SocketEvents.DISCONNECT, () => {
      try {
        const user = players[socket.id];

        const userKey = GetAccountKey(user?.account);

        const isSessionOverride = overrideSessions[socket.id];

        // if (!user || !user.account) return;

        const roomId = userKey && roomManager.UserRoomId[userKey];

        if (user?.account?.Id && !isSessionOverride) {
          (async () => {
            UpdateStatusToFriends(user.account!.Id!, AccountState.Offline);
          })();
        }

        if (roomId && !isSessionOverride) {
          const room = roomManager.Rooms[roomId];
          if (room?.gameIsRunning) {
            const key = user.account!.Id
              ? `account-${user.account!.Id}`
              : `guest-${user.account!.GuestId}`;

            // delete roomManager.UserRoomId[userKey!];
            disconnectedPlayerRooms[key] = room.id;

            room.SendSpectatorsNotification(SpectatorsNotificationType.Leave, user.account!, io);

            room.PlayerLeaveGame(
              socket.id,
              PlayerLeftCallback
            );
          } else if (room) {
            roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
            if (room.waitingForPlayersReady) {
              io.to(room.host).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
              io.to(room.secondPlayer).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
              room.SendSpectatorsNotification(SpectatorsNotificationType.Cancelled, room.hostReady ? room.hostAccount : room.secondPlayerAccount!, io);
            }
            // roomManager.PlayerDisconnected(socket.id);
          }
        }

        const userId = user?.account?.Id;
        const treasureHuntRoomId = treasureHuntManager.UserRoomId[userId || 0];

        if (treasureHuntRoomId && !isSessionOverride) {
          const room = treasureHuntManager.Rooms[treasureHuntRoomId];
          const key = user.account!.Id!;
          // delete treasureHuntManager.UserRoomId[user.account!.Id!];
          disconnectedPlayerTreasureHunts[key] = room.id;
          room.LeaveGame(PlayerLeftTreasureHuntCallback);
        }

        if (quickPlayManager.UserQueue[userKey!]) {
          quickPlayManager.CancelQueue(socket.id);
        }

        const specRoomId = spectators[socket.id];

        if (specRoomId) {
          roomManager.RemoveSpectator(specRoomId, socket, players, spectators, io);
        }

        if (user?.account?.Id && !isSessionOverride) {
          delete playersIds[user.account!.Id!];
          // playersIds[user.account!.Id!].splice(
          //   playersIds[user.account!.Id!].indexOf(socket.id),
          //   1
          // );
        }
        else if (user?.account?.GuestId && !isSessionOverride) {
          delete playersIds['g-' + user.account!.GuestId!];
        }

        if (userAiGames[socket.id]) {
          delete aiGames[userAiGames[socket.id]];
          delete userAiGames[socket.id];
        }

        delete players[socket.id];

        if (isSessionOverride) delete overrideSessions[socket.id];
        
      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.MOVEPIECE,
      async (move: string, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !roomId
          )
            return callback && callback(null);

          const room = roomManager.Rooms[roomId];

          if (!room) return callback && callback(MovePieceEnum.GameNotFound);

          if (!room.gameIsRunning)
            return callback && callback(MovePieceEnum.GameNotStarted);

          const stat = room.MovePiece(socket.id, move);

          if (stat != MovePieceEnum.OK) return callback && callback(stat);

          const isCheckmate = room.game!.in_checkmate(),
            isRepetition = room.game!.in_threefold_repetition(),
            isStalemate = room.game!.in_stalemate(),
            isDraw = room.game!.in_draw(),
            isCheck = room.game!.in_check();

          const hostAccount = room.hostAccount;
          const secondPlayerAccount = room.secondPlayerAccount!;
          let winner: Account | null = null;

          let p1RatingInc = null,
            p2RatingInc = null;

          if (isCheckmate || isRepetition || isStalemate || isDraw) {
            roomManager.GameEnded(room.id);

            const keyHost = hostAccount.Id
              ? `account-${hostAccount.Id}`
              : `guest-${hostAccount.GuestId}`;
            const keySecondPlayer = secondPlayerAccount.Id
              ? `account-${secondPlayerAccount.Id}`
              : `guest-${secondPlayerAccount.GuestId}`;

            if (disconnectedPlayerRooms[keyHost])
              delete disconnectedPlayerRooms[keyHost];
            if (disconnectedPlayerRooms[keySecondPlayer])
              delete disconnectedPlayerRooms[keySecondPlayer];

            winner = isDraw
              ? null
              : socket.id == room.host
              ? hostAccount
              : secondPlayerAccount;
            if (room.gameRules.mode == GameMode.Rated) {
              const { hostRating, secondPlayerRating } = await UpdateRatings(
                dataContext,
                room,
                hostAccount,
                secondPlayerAccount,
                winner
              );

              p1RatingInc = hostRating;
              p2RatingInc = secondPlayerRating;
            }
          }

          const gameIsFinished =
            isCheckmate || isRepetition || isStalemate || isDraw;

          const hostTimeLeft = room.hostTimer.isRunning
            ? room.hostTimer.timeLeft -
              (new Date().getTime() - room.hostTimer.startRoundTime)
            : room.hostTimer.timeLeft;
          const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
            ? room.secondPlayerTimer.timeLeft -
              (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
            : room.secondPlayerTimer.timeLeft;

          const result = {
            isCheckmate: isCheckmate,
            isRepetition: isRepetition,
            isStalemate: isStalemate,
            isCheck: isCheck,
            isDraw: isDraw,
            player: players[socket.id].account!,
            move: move,
            fen: room.game!.fen(),
            timestamp: room.lastHistoryMove.timestamp,
            winner: isCheckmate ? players[socket.id].account! : null,
            secondPlayerTimeLeft: secondPlayerTimeLeft,
            hostTimeLeft: hostTimeLeft,
            playerIsHost: socket.id === room.host
          };

          const resultHost = {
            gameResult: result.isCheckmate
              ? socket.id == room.host
                ? GameResultType.Win
                : GameResultType.Lose
              : result.isStalemate || result.isRepetition
              ? GameResultType.Draw
              : null,
          };

          const resultSecondPlayer = {
            gameResult: result.isCheckmate
              ? socket.id == room.host
                ? GameResultType.Win
                : GameResultType.Lose
              : result.isStalemate || result.isRepetition
              ? GameResultType.Draw
              : null,
          };

          io.to(room.id).emit(SocketEvents.SPECTATEPIECEMOVE, result);
          io.to(room.host).emit(SocketEvents.MOVEPIECE, {
            ...result,
            ...resultHost,
          });
          io.to(room.secondPlayer).emit(SocketEvents.MOVEPIECE, {
            ...result,
            ...resultSecondPlayer,
          });

          if (gameIsFinished) {
            await AddMatchHistory(
              dataContext,
              room,
              hostAccount,
              secondPlayerAccount,
              winner!,
              p1RatingInc,
              p2RatingInc,
              ResultCondition.Gameplay
            );

            roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
          } else room.SkipTurn();

          return callback && callback(stat);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.CREATECUSTOMGAME,
      async (gameRules: GameRules, callback: Function) => {
        try {
          if (
            baseAppSettings.MaintenanceMode == MaintenanceMode.Offline ||
            baseAppSettings.MaintenanceMode == MaintenanceMode.GameplayDisabled
          )
            return;

          const userId = players[socket.id].account?.Id;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            roomId ||
            quickPlayManager.UserQueue[userKey!] ||
            (userId && treasureHuntManager.UserRoomId[userId])
          )
            return callback && callback(null);

          gameRules.type = GetGameType(gameRules.time.base);

          const room = await roomManager.CreateRoom(
            socket.id,
            players[socket.id]!.account!,
            RoomType.Custom,
            gameRules,
            dataContext
          );

          io.to("rooms-page").emit("rooms-page", {
            roomId: room.id,
            status: RoomEvent.Created,
            gameRules,
            host: room.hostAccount,
          });

          return callback && callback(room.id);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.JOINGAME,
      async (roomId: string, callback: Function) => {
        try {
          if (
            baseAppSettings.MaintenanceMode == MaintenanceMode.Offline ||
            baseAppSettings.MaintenanceMode == MaintenanceMode.GameplayDisabled
          )
            return;

          const userId = players[socket.id].account?.Id;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const currRoomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            currRoomId ||
            quickPlayManager.UserQueue[userKey!] ||
            (userId && treasureHuntManager.UserRoomId[userId])
          )
            return (
              callback &&
              callback({
                type: JoinRoomEnum.Forbidden,
              })
            );

          if (quickPlayManager.UserQueue[userKey!]) quickPlayManager.CancelQueue(socket.id);

          let room = roomManager.Rooms[roomId];

          if (
            // players[socket.id].account!.Id == room.hostAccount.Id &&
            // players[socket.id].account!.GuestId == room.hostAccount.GuestId
            !room
          )
            return (
              callback &&
              callback({
                type: JoinRoomEnum.NotFound,
              })
            );

          if (
            // players[socket.id].account!.Id == room.hostAccount.Id &&
            // players[socket.id].account!.GuestId == room.hostAccount.GuestId
            room.gameIsRunning ||
            room.waitingForPlayersReady
          )
            return (
              callback &&
              callback({
                type: JoinRoomEnum.AlreadyStarted,
                gameInfo: {
                  historyMoves: room.history,
                  gameRules: room.gameRules,
                  host: room.hostAccount,
                  secondPlayer: room.secondPlayerAccount,
                  gameStartDate: room.gameStartDate,
                }
              })
            );

          // if (room && !room.gameIsRunning) {
            // game is finished but isn't in database yet
          if (room.gameEndDate)
            return (
              callback &&
              callback({
                type: JoinRoomEnum.Forbidden,
              })
            );

          room = roomManager.JoinRoom(
            socket.id,
            players[socket.id]!.account!,
            roomId
          )!;

          if (!room) return callback && callback(false);

          io.to("rooms-page").emit("rooms-page", {
            roomId: room.id,
            status: RoomEvent.GameStarted,
          });

          if (userId) {
            (async () => {
              UpdateStatusToFriends(userId, AccountState.PlayingOnline);
            })();
          }

          // roomManager.GameStarted(roomId, GameTimeoutCallback);

          roomManager.GamePreStarted(roomId, () => {
            roomManager.DestroyRoom(roomId, spectators, io, UpdateStatusToFriends);
            io.to(room.host).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
            io.to(room.secondPlayer).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
            room.SendSpectatorsNotification(SpectatorsNotificationType.Cancelled, room.hostReady ? room.hostAccount : room.secondPlayerAccount!, io);
          });

          const hostAccount = room.hostAccount;
          const secondPlayerAccount = room.secondPlayerAccount!;

          let hostWin: any, hostDraw: any, secondPlayerWin: any;

          if (room.gameRules.mode == GameMode.Rated) {
            hostWin = EloRatingEarned(
              hostAccount,
              secondPlayerAccount,
              room.gameRules.type,
              hostAccount
            );
            hostDraw = EloRatingEarned(
              hostAccount,
              secondPlayerAccount,
              room.gameRules.type
            );
            secondPlayerWin = EloRatingEarned(
              secondPlayerAccount,
              hostAccount,
              room.gameRules.type,
              secondPlayerAccount
            );
          }

          io.to(room.host).emit(SocketEvents.GAMESTART, {
            opponent: secondPlayerAccount,
            user: hostAccount,
            gameElos:
              room.gameRules.mode == GameMode.Casual
                ? undefined
                : {
                    eloWin: hostWin.player1EarnedRating,
                    eloLose: secondPlayerWin.player2EarnedRating,
                    eloDraw: hostDraw.player1EarnedRating,
                  },
            gameRules: room.gameRules,
            side: room.hostPieceSide,
            // startDate: room.gameStartDate,
          });

          io.to(room.secondPlayer).emit(SocketEvents.GAMESTART, {
            opponent: hostAccount,
            user: secondPlayerAccount,
            gameElos:
              room.gameRules.mode == GameMode.Casual
                ? undefined
                : {
                    eloWin: secondPlayerWin.player1EarnedRating,
                    eloLose: hostWin.player2EarnedRating,
                    eloDraw: hostDraw.player2EarnedRating,
                  },
            gameRules: room.gameRules,
            side:
              room.hostPieceSide == PieceSide.Black
                ? PieceSide.White
                : PieceSide.Black,
            // startDate: room.gameStartDate,
          });

          return (
            callback &&
            callback({
              type: JoinRoomEnum.OK,
            })
          );
          // } else if (room && room.gameIsRunning) {
          //   // players[socket.id].spectatingRoomId = roomId;
          //   roomManager.AddSpectator(roomId, socket.id, players, spectators, io);

          //   const hostTimeLeft = room.hostTimer.isRunning
          //     ? room.hostTimer.timeLeft -
          //       (new Date().getTime() - room.hostTimer.startRoundTime)
          //     : room.hostTimer.timeLeft;
          //   const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
          //     ? room.secondPlayerTimer.timeLeft -
          //       (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
          //     : room.secondPlayerTimer.timeLeft;

          //   return (
          //     callback &&
          //     callback({
          //       type: JoinRoomEnum.Spectate,
          //       historyMoves: room.history,
          //       gameRules: room.gameRules,
          //       whitePieces:
          //         room.hostPieceSide == PieceSide.White
          //           ? {
          //               Id: room.hostAccount!.Id,
          //               GuestId: room.hostAccount!.GuestId,
          //             }
          //           : {
          //               Id: room.secondPlayerAccount.Id,
          //               GuestId: room.secondPlayerAccount.GuestId,
          //             },
          //       host: room.hostAccount,
          //       secondPlayer: room.secondPlayerAccount,
          //       gameStartDate: room.gameStartDate,
          //       hostLeft: room.hostLeaveTimestamp != null,
          //       secondPlayerLeft: room.secondPlayerLeaveTimestamp != null,
          //       hostTimeLeft: hostTimeLeft,
          //       secondPlayerTimeLeft: secondPlayerTimeLeft,
          //       isHostTurn: room.playerTurn == room.host,
          //     })
          //   );
          // } else {
          //   const history = await dataContext.GameHistories.findAll({
          //     include: [
          //       {
          //         model: dataContext.Accounts,
          //         as: "Account",
          //       },
          //       {
          //         model: dataContext.Accounts,
          //         as: "Opponent",
          //       },
          //       {
          //         model: dataContext.Guests,
          //         as: "Guest",
          //       },
          //       {
          //         model: dataContext.Guests,
          //         as: "OpponentGuest",
          //       },
          //     ],
          //     where: { Identifier: roomId },
          //   });

          //   if (history) {
          //     const res = GetMatchHistoryData(history);
          //     return callback && callback(res);
          //   } else {
          //     return (
          //       callback &&
          //       callback({
          //         type: JoinRoomEnum.NotFound,
          //       })
          //     );
          //   }
          // }
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(false);
        }
      }
    );

    socket.on(SocketEvents.GAMEREADY,
      async (data: any, callback: Function) => {
        try {
          if (
            baseAppSettings.MaintenanceMode == MaintenanceMode.Offline ||
            baseAppSettings.MaintenanceMode == MaintenanceMode.GameplayDisabled
          )
            return;

          const user = players[socket.id];

          const userKey = GetAccountKey(user?.account);
          
          const roomId = userKey && roomManager.UserRoomId[userKey];
          const room = roomId ? roomManager.Rooms[roomId] : undefined;

          if (!roomId || !room || !room.waitingForPlayersReady || (socket.id != room.host && socket.id != room.secondPlayer)) return callback && callback(null);

          const playerIsHost = socket.id == room.host;

          if (playerIsHost) room.hostReady = true;
          else room.secondPlayerReady = true;

          if (room.hostReady && room.secondPlayerReady) { 
            
            roomManager.GameStarted(roomId, GameTimeoutCallback);

            io.to(room.host).emit(SocketEvents.GAMEREADY, {
              startDate: room.gameStartDate,
            });
            
            io.to(room.secondPlayer).emit(SocketEvents.GAMEREADY, {
              startDate: room.gameStartDate,
            });
          }

        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(false);
        }
      }
    );

    socket.on(SocketEvents.RESIGN, async (value: null, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userKey = GetAccountKey(players[socket.id]?.account);
        const roomId = roomManager.UserRoomId[userKey!];

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          !roomId
        )
          return callback && callback(null);

        const room = roomManager.Rooms[roomId];

        if (!room.gameIsRunning) return callback && callback(null);

        roomManager.GameEnded(roomId);

        room.SendSpectatorsNotification(SpectatorsNotificationType.Resign, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);

        const winner =
          socket.id == room.host
            ? room.secondPlayerAccount!
            : room.hostAccount!;

        io.to(room.host).emit(SocketEvents.RESIGN, { winner });
        io.to(room.secondPlayer).emit(SocketEvents.RESIGN, { winner });

        const hostAccount = room.hostAccount!;
        const secondPlayerAccount = room.secondPlayerAccount!;

        const keyHost = hostAccount.Id
          ? `account-${hostAccount.Id}`
          : `guest-${hostAccount.GuestId}`;
        const keySecondPlayer = secondPlayerAccount.Id
          ? `account-${secondPlayerAccount.Id}`
          : `guest-${secondPlayerAccount.GuestId}`;

        if (disconnectedPlayerRooms[keyHost])
          delete disconnectedPlayerRooms[keyHost];
        if (disconnectedPlayerRooms[keySecondPlayer])
          delete disconnectedPlayerRooms[keySecondPlayer];

        let p1RatingInc = null,
          p2RatingInc = null;

        if (room.gameRules.mode == GameMode.Rated) {
          const { hostRating, secondPlayerRating } = await UpdateRatings(
            dataContext,
            room,
            hostAccount,
            secondPlayerAccount,
            winner
          );
          p1RatingInc = hostRating;
          p2RatingInc = secondPlayerRating;
        }

        await AddMatchHistory(
          dataContext,
          room,
          hostAccount,
          secondPlayerAccount,
          winner,
          p1RatingInc,
          p2RatingInc,
          ResultCondition.Resign
        );

        roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);

        return callback && callback(true);
      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });

        return callback && callback(false);
      }
    });

    socket.on(SocketEvents.REQUESTDRAW,
      async (value: null, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !roomId
          )
            return callback && callback(null);


          const room = roomManager.Rooms[roomId];

          if (!room.gameIsRunning) return callback && callback(null);

          room.SendSpectatorsNotification(SpectatorsNotificationType.DrawRequest, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);

          room.AskForDraw(socket.id);

          if (socket.id == room.host)
            io.to(room.secondPlayer).emit(SocketEvents.REQUESTDRAW, null);
          else io.to(room.host).emit(SocketEvents.REQUESTDRAW, null);

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(false);
        }
      }
    );

    socket.on(SocketEvents.ANSWERDRAWREQUEST,
      async (accepted: boolean, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !roomId
          )
            return callback && callback(null);

          const room = roomManager.Rooms[roomId];

          if (!room.gameIsRunning) return callback && callback(null);

          const success = room.ResponseToDraw(socket.id, accepted);

          const otherUser =
            room.host == socket.id ? room.secondPlayer : room.host;

          if (success && accepted) {
            roomManager.GameEnded(roomId);

            room.SendSpectatorsNotification(SpectatorsNotificationType.AcceptDraw, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);
            io.to(otherUser).emit(SocketEvents.ANSWERDRAWREQUEST, true);

            const hostAccount = room.hostAccount!;
            const secondPlayerAccount = room.secondPlayerAccount!;

            const keyHost = hostAccount.Id
              ? `account-${hostAccount.Id}`
              : `guest-${hostAccount.GuestId}`;
            const keySecondPlayer = secondPlayerAccount.Id
              ? `account-${secondPlayerAccount.Id}`
              : `guest-${secondPlayerAccount.GuestId}`;

            if (disconnectedPlayerRooms[keyHost])
              delete disconnectedPlayerRooms[keyHost];
            if (disconnectedPlayerRooms[keySecondPlayer])
              delete disconnectedPlayerRooms[keySecondPlayer];

            let p1RatingInc = null,
              p2RatingInc = null;

            if (room.gameRules.mode == GameMode.Rated) {
              const { hostRating, secondPlayerRating } = await UpdateRatings(
                dataContext,
                room,
                hostAccount,
                secondPlayerAccount,
                null
              );
              p1RatingInc = hostRating;
              p2RatingInc = secondPlayerRating;
            }

            await AddMatchHistory(
              dataContext,
              room,
              hostAccount,
              secondPlayerAccount,
              null,
              p1RatingInc,
              p2RatingInc,
              ResultCondition.DrawRequest
            );

            roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
          } else if (success) {
            room.SendSpectatorsNotification(SpectatorsNotificationType.DeclineDraw, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);
            io.to(otherUser).emit(SocketEvents.ANSWERDRAWREQUEST, false);
          }

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(false);
        }
      }
    );

    socket.on(SocketEvents.STARTSPECTATING, (roomId: string, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const room = roomManager.Rooms[roomId];

        if (
          !room ||
          spectators[socket.id] ||
          room.host == socket.id ||
          room.secondPlayer == socket.id
        )
          return callback && callback(false);

        roomManager.AddSpectator(roomId, socket, players, spectators, io);

        const hostTimeLeft = room.hostTimer.isRunning
          ? room.hostTimer.timeLeft -
            (new Date().getTime() - room.hostTimer.startRoundTime)
          : room.hostTimer.timeLeft;
        const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
          ? room.secondPlayerTimer.timeLeft -
            (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
          : room.secondPlayerTimer.timeLeft;

        const account = players[socket.id].account;
        if (account?.Id) {
          (async () => {
            UpdateStatusToFriends(account.Id!, AccountState.Spectating);
          })();
        }

        let hostWin: any, hostDraw: any, secondPlayerWin: any;

        if (room.gameRules.mode == GameMode.Rated) {
          hostWin = EloRatingEarned(
            room.hostAccount,
            room.secondPlayerAccount!,
            room.gameRules.type,
            room.hostAccount
          );
          hostDraw = EloRatingEarned(
            room.hostAccount,
            room.secondPlayerAccount!,
            room.gameRules.type
          );
          secondPlayerWin = EloRatingEarned(
            room.secondPlayerAccount!,
            room.hostAccount,
            room.gameRules.type,
            room.secondPlayerAccount
          );
        }

        return (
          callback &&
          callback({
            historyMoves: room.history,
            gameRules: room.gameRules,
            whitePieces:
              room.hostPieceSide == PieceSide.White
                ? {
                    Id: room.hostAccount!.Id,
                    GuestId: room.hostAccount!.GuestId,
                  }
                : {
                    Id: room.secondPlayerAccount!.Id,
                    GuestId: room.secondPlayerAccount!.GuestId,
                  },
            host: room.hostAccount,
            hostGameElos:
              room.gameRules.mode == GameMode.Casual
                ? undefined
                : {
                    eloWin: hostWin.player1EarnedRating,
                    eloLose: secondPlayerWin.player2EarnedRating,
                    eloDraw: hostDraw.player1EarnedRating,
                  },
            secondPlayerGameElos:
              room.gameRules.mode == GameMode.Casual
                ? undefined
                : {
                    eloWin: secondPlayerWin.player1EarnedRating,
                    eloLose: hostWin.player2EarnedRating,
                    eloDraw: hostDraw.player2EarnedRating,
                  },
            secondPlayer: room.secondPlayerAccount,
            gameStartDate: room.gameStartDate,
            hostLeft: room.hostLeaveTimestamp != null,
            secondPlayerLeft: room.secondPlayerLeaveTimestamp != null,
            hostTimeLeft: hostTimeLeft,
            secondPlayerTimeLeft: secondPlayerTimeLeft,
            isHostTurn: room.playerTurn == room.host,
            spectatorNotifications: room.spectatorsNotifications
          })
        );
        
      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.STOPSPECTATING, (data: null, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const roomId = spectators[socket.id];

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          !roomId
        )
          return callback && callback(false);

        const account = players[socket.id].account;
        if (account?.Id) {
          (async () => {
            UpdateStatusToFriends(account.Id!, AccountState.Lobby);
          })();
        }

        roomManager.RemoveSpectator(roomId, socket, players, spectators, io);

        // socket.leave(players[socket.id].spectatingRoomId);
        // players[socket.id].spectatingRoomId = null;
      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.LEAVEGAME, () => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userKey = GetAccountKey(players[socket.id]?.account);
        const roomId = roomManager.UserRoomId[userKey!];

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          !roomId ||
          !roomManager.Rooms[roomId]
        )
          return;

        const user = players[socket.id];
        const room = roomManager.Rooms[roomId];

        if (room.gameEndDate) return;

        if (room.waitingForPlayersReady) {
          roomManager.DestroyRoom(roomId, spectators, io, UpdateStatusToFriends);
          io.to(room.host).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
          io.to(room.secondPlayer).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
          room.SendSpectatorsNotification(SpectatorsNotificationType.Cancelled, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);
        }
        else if (room.gameIsRunning) {
          const key = user.account!.Id
            ? `account-${user.account!.Id}`
            : `guest-${user.account!.GuestId}`;
          disconnectedPlayerRooms[key] = room.id;
          room.SendSpectatorsNotification(SpectatorsNotificationType.Leave, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);
          room.PlayerLeaveGame(
            socket.id,
            PlayerLeftCallback
          );
        } else {
          // const { hostLeft } = roomManager.LeaveRoom(socket.id);
          roomManager.LeaveRoom(socket.id, players);

          // if (hostLeft) {
            io.to("rooms-page").emit(SocketEvents.ROOMSPAGE, {
              roomId,
              status: RoomEvent.Deleted,
            });
          // }
        }
      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.SETUSERTOKEN,
      async (token: string, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          if (!token || players[socket.id].account)
            return callback && callback(null);

          const saltToken = encryptor.Decrypt(token);

          const session = await dataContext.Sessions.findOne({
            include: dataContext.Accounts,
            where: { SaltSessionToken: saltToken },
          });

          if (session == null) {
            return callback && callback(false);
          }

          const oldSocketId = playersIds[session.AccountId];
          if (oldSocketId) {
            const userKey = GetAccountKey(players[oldSocketId]?.account);
            const roomId = userKey ? roomManager.UserRoomId[userKey] : null;
            if (roomId) {
              const room = roomManager.Rooms[roomId];

              if (room.gameIsRunning) {
                if (room.host == oldSocketId) room.host = socket.id;
                else room.secondPlayer = socket.id;
                const newKey = `account-${session.Account.Id}`;
                disconnectedPlayerRooms[newKey] = roomId;
              }
            }
            const treasureQuestRoomId = treasureHuntManager.UserRoomId[session.Account.Id];
            if (treasureQuestRoomId) {
              const room = treasureHuntManager.Rooms[treasureQuestRoomId];
              room.user = socket.id;
              disconnectedPlayerTreasureHunts[session.Account.Id] = treasureQuestRoomId;
            }
            overrideSessions[oldSocketId] = true;
            io.to(oldSocketId).emit(SocketEvents.USERDISCONNECT);
            delete players[oldSocketId];
            delete playersIds[session.AccountId];
          }

          // const wonGames = (await dataContext.Database.query(`select count(if(GameType = ${GameType.Classical}, 1, null)) as ClassicalWonGames,
          //                                                         count(if(GameType = ${GameType.Blitz}, 1, null)) as BlitzWonGames,
          //                                                         count(if(GameType = ${GameType.Bullet}, 1, null)) as BulletWonGames,
          //                                                         count(if(GameType = ${GameType.Rapid}, 1, null)) as RapidWonGames
          //                                                             from GameHistory where AccountId = ${session.AccountId} and Result = ${GameResultType.Win}`))[0][0];

          const playedGames = await dataContext.GameHistories.count({
            where: { AccountId: session.AccountId },
          });

          const today = new Date();

          const treasureHuntGamesToday = await dataContext.TreasureHuntings.count({
            where: {
              AccountId: session.AccountId,
              GameStartDate: {
                [Op.gt]: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime(),
                [Op.lt]: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime()
              }
            },
          });

          const account = {
            Id: session.Account.Id,
            Username: session.Account.Username,
            Email: session.Account.Email,

            Avatar: session.Account.Avatar,

            TreasureHuntTodayGames: treasureHuntGamesToday,

            ClassicalElo: session.Account.ClassicalElo,
            BlitzElo: session.Account.BlitzElo,
            BulletElo: session.Account.BulletElo,
            RapidElo: session.Account.RapidElo,

            BestClassicalElo: session.Account.BestClassicalElo,
            BestBlitzElo: session.Account.BestBlitzElo,
            BestBulletElo: session.Account.BestBulletElo,
            BestRapidElo: session.Account.BestRapidElo,
            

            ClassicalEloSubsequentlyOver2400:
              session.Account.ClassicalEloSubsequentlyOver2400,
            BlitzEloSubsequentlyOver2400:
              session.Account.BlitzEloSubsequentlyOver2400,
            RapidEloSubsequentlyOver2400:
              session.Account.RapidEloSubsequentlyOver2400,
            BulletEloSubsequentlyOver2400:
              session.Account.BulletEloSubsequentlyOver2400,
            PlayedGames: playedGames,
          };

          
          players[socket.id].account = account;
          
          // if (!playersIds[account.Id]) playersIds[account.Id] = [];
          // playersIds[account.Id].push(socket.id);
          
          playersIds[account.Id] = socket.id;
          
          (async () => {
            UpdateStatusToFriends(account.Id, AccountState.Online);
          })();

          const key = `account-${session.Account.Id}`;

          if (disconnectedPlayerRooms[key]) {
            const roomId = disconnectedPlayerRooms[key];
            const room = roomManager.Rooms[roomId];
            const isHost = room.hostAccount.Id == session.Account.Id;
            const opponent = isHost
              ? room.secondPlayerAccount
              : room.hostAccount;

            // room.PlayerResumeGame(socket.id, account);
            // roomManager.UserRoomId[GetAccountKey(account)!] = roomId;

            const hostAccount = room.hostAccount;
            const secondPlayerAccount = room.secondPlayerAccount!;

            const playerWin = isHost
              ? EloRatingEarned(
                  hostAccount,
                  secondPlayerAccount,
                  room.gameRules.type,
                  hostAccount
                )
              : EloRatingEarned(
                  secondPlayerAccount,
                  hostAccount,
                  room.gameRules.type,
                  secondPlayerAccount
                );
            const hostDraw = EloRatingEarned(
              hostAccount,
              secondPlayerAccount,
              room.gameRules.type
            );

            const hostTimeLeft = room.hostTimer.isRunning
              ? room.hostTimer.timeLeft -
                (new Date().getTime() - room.hostTimer.startRoundTime)
              : room.hostTimer.timeLeft;
            const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
              ? room.secondPlayerTimer.timeLeft -
                (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
              : room.secondPlayerTimer.timeLeft;

            socket.emit(SocketEvents.RUNNINGMATCH, {
              identifier: room.id,
              opponent: opponent,
              gameRules: room.gameRules,
              history: room.history,
              leaveTimestamp: isHost ? room.hostLeaveTimestamp : room.secondPlayerLeaveTimestamp,
              opponentTimeLeft: isHost ? secondPlayerTimeLeft : hostTimeLeft,
              timeLeft: isHost ? hostTimeLeft : secondPlayerTimeLeft,
              isYourTurn: room.playerTurn == socket.id,
              side: isHost
                ? room.hostPieceSide
                : room.hostPieceSide == PieceSide.Black
                ? PieceSide.White
                : PieceSide.Black,
              startDate: room.gameStartDate,
              gameElos: {
                eloWin: playerWin.player1EarnedRating,
                eloLose: playerWin.player2EarnedRating,
                eloDraw: isHost
                  ? hostDraw.player1EarnedRating
                  : hostDraw.player2EarnedRating,
              },
            });

            // delete disconnectedPlayerRooms[key];
          }
          else if (disconnectedPlayerTreasureHunts[account.Id]) {

            const roomId = disconnectedPlayerTreasureHunts[account.Id];
            const room = treasureHuntManager.Rooms[roomId];

            // room.ResumeGame();

            socket.emit(SocketEvents.RUNNINGMATCHTREASUREHUNT, {
              leaveTimestamp: room.leaveTimestamp,
              attempts: room.attempts.map(attempt => {
                const treasure = room.treasurePlaces.find(e => e.place.toLowerCase() == attempt.toLowerCase());
                return {
                  place: attempt,
                  level: treasure?.level
                }
              })
            });

            // delete disconnectedPlayerTreasureHunts[account.Id];
          }

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.SETGUESTTOKEN,
      async (token: string, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          if (players[socket.id].account) return callback && callback(null);

          let result = null;
          let guest = !token
            ? null
            : await dataContext.Guests.findOne({
                where: { Identifier: token },
              });

          if (guest) {
            // const wonGames = (await dataContext.Database.query(`select count(if(GameType = ${GameType.Classical}, 1, null)) as ClassicalWonGames,
            //                                                     count(if(GameType = ${GameType.Blitz}, 1, null)) as BlitzWonGames,
            //                                                     count(if(GameType = ${GameType.Bullet}, 1, null)) as BulletWonGames,
            //                                                     count(if(GameType = ${GameType.Rapid}, 1, null)) as RapidWonGames
            //                                                         from GameHistory where GuestId = ${guest.Id} and Result = ${GameResultType.Win}`))[0][0];
            const oldSocketId = playersIds['g-' + guest.Id];
            if (oldSocketId) {
              const userKey = GetAccountKey(players[oldSocketId]?.account);
              const roomId = userKey ? roomManager.UserRoomId[userKey] : null;
              if (roomId) {
                const room = roomManager.Rooms[roomId];
                if (room.host == oldSocketId) room.host = socket.id;
                else room.secondPlayer = socket.id;
                const newKey = `guest-${guest.Id}`;
                disconnectedPlayerRooms[newKey] = roomId;
              }
              overrideSessions[oldSocketId] = true;              
              io.to(oldSocketId).emit(SocketEvents.USERDISCONNECT);
              delete players[oldSocketId];
              delete playersIds['g-' + guest.Id];
            }

            const playedGames = await dataContext.GameHistories.count({
              where: { GuestId: guest.Id },
            });

            players[socket.id].account = {
              GuestId: guest.Id,
              ClassicalElo: guest.ClassicalElo,
              BlitzElo: guest.BlitzElo,
              BulletElo: guest.BulletElo,
              RapidElo: guest.RapidElo,

              // BestClassicalElo: guest.BestClassicalElo,
              // BestBlitzElo: guest.BestBlitzElo,
              // BestBulletElo: guest.BestBulletElo,
              // BestRapidElo: guest.BestRapidElo,

              ClassicalEloSubsequentlyOver2400:
                guest.ClassicalEloSubsequentlyOver2400,
              BlitzEloSubsequentlyOver2400: guest.BlitzEloSubsequentlyOver2400,
              RapidEloSubsequentlyOver2400: guest.RapidEloSubsequentlyOver2400,
              BulletEloSubsequentlyOver2400:
                guest.BulletEloSubsequentlyOver2400,
              PlayedGames: playedGames,
            };

            playersIds['g-' + guest.Id] = socket.id;

            const highestAIGameLevelWon = (await dataContext.AIGameHistories.findOne({
              where: {
                GuestId: guest.Id,
                Result: GameResultType.Win
              },
              order: [["Level", "desc"]],
            }))?.Level || 2;

            result = {
              user: players[socket.id].account,
              highestAIGameLevelWon
            };
          } else {
            const identifier = RandomString(128, { symbols: false });

            guest = await dataContext.Guests.create({
              Identifier: identifier,
              CreationDate: new Date().getTime(),
            });

            players[socket.id].account = {
              GuestId: guest.Id,
              ClassicalElo: guest.ClassicalElo,
              BlitzElo: guest.BlitzElo,
              BulletElo: guest.BulletElo,
              RapidElo: guest.RapidElo,

              // BestClassicalElo: guest.BestClassicalElo,
              // BestBlitzElo: guest.BestBlitzElo,
              // BestBulletElo: guest.BestBulletElo,
              // BestRapidElo: guest.BestRapidElo,

              ClassicalEloSubsequentlyOver2400: false,
              BlitzEloSubsequentlyOver2400: false,
              RapidEloSubsequentlyOver2400: false,
              BulletEloSubsequentlyOver2400: false,
              PlayedGames: 0,
            };

            result = {
              user: players[socket.id].account,
              token: guest.Identifier,
              highestAIGameLevelWon: 2
            };
          }

          const key = `guest-${guest.Id}`;

          if (disconnectedPlayerRooms[key]) {
            // const account = players[socket.id].account!;

            const roomId = disconnectedPlayerRooms[key];
            const room = roomManager.Rooms[roomId];
            const isHost = room.hostAccount.GuestId == guest.Id;
            const opponent = isHost
              ? room.secondPlayerAccount
              : room.hostAccount;

            // room.PlayerResumeGame(socket.id, account);
            // roomManager.UserRoomId[GetAccountKey(account)!] = roomId;

            const hostAccount = room.hostAccount;
            const secondPlayerAccount = room.secondPlayerAccount!;

            const playerWin = isHost
              ? EloRatingEarned(
                  hostAccount,
                  secondPlayerAccount,
                  room.gameRules.type,
                  hostAccount
                )
              : EloRatingEarned(
                  secondPlayerAccount,
                  hostAccount,
                  room.gameRules.type,
                  secondPlayerAccount
                );
            const hostDraw = EloRatingEarned(
              hostAccount,
              secondPlayerAccount,
              room.gameRules.type
            );

            const hostTimeLeft = room.hostTimer.isRunning
              ? room.hostTimer.timeLeft -
                (new Date().getTime() - room.hostTimer.startRoundTime)
              : room.hostTimer.timeLeft;
            const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
              ? room.secondPlayerTimer.timeLeft -
                (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
              : room.secondPlayerTimer.timeLeft;

            socket.emit(SocketEvents.RUNNINGMATCH, {
              identifier: room.id,
              opponent: opponent,
              gameRules: room.gameRules,
              history: room.history,
              leaveTimestamp: isHost ? room.hostLeaveTimestamp : room.secondPlayerLeaveTimestamp,
              opponentTimeLeft: isHost ? secondPlayerTimeLeft : hostTimeLeft,
              timeLeft: isHost ? hostTimeLeft : secondPlayerTimeLeft,
              isYourTurn: room.playerTurn == socket.id,
              side: isHost
                ? room.hostPieceSide
                : room.hostPieceSide == PieceSide.Black
                ? PieceSide.White
                : PieceSide.Black,
              startDate: room.gameStartDate,
              gameElos: {
                eloWin: playerWin.player1EarnedRating,
                eloLose: playerWin.player2EarnedRating,
                eloDraw: isHost
                  ? hostDraw.player1EarnedRating
                  : hostDraw.player2EarnedRating,
              },
            });

            // delete disconnectedPlayerRooms[key];
          }

          return callback && callback(result);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.JOINROOMSPAGE,
      async (data: null, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const rooms = [];
          for (const [key, value] of Object.entries(roomManager.Rooms)) {
            if (value.gameIsRunning || value.gameEndDate) continue;

            rooms.push({
              roomId: key,
              gameRules: value.gameRules,
              host: players[value.host].account,
            });
          }

          socket.join("rooms-page");

          return (
            callback &&
            callback({
              user: players[socket.id].account!,
              rooms,
            })
          );
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.LEAVEGAMEPROMPT,
      async (win: boolean, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !roomId
          )
            return callback && callback(null);

          var room = roomManager.Rooms[roomId];
          roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);

          if (
            (room.hostLeaveTimer && room.secondPlayerLeaveTimer) ||
            (!room.hostLeaveTimer && !room.secondPlayerLeaveTimer)
          )
            return callback && callback(null);

          // if (!loserIsHost) io.to(room.host).emit(SocketEvents.GAMETIMEOUT, {winner});
          // if (loserIsHost) io.to(room.secondPlayer).emit(SocketEvents.GAMETIMEOUT, {winner});

          const notificationType = win ? SpectatorsNotificationType.LeavePromptWin : SpectatorsNotificationType.LeavePromptDraw;
          room.SendSpectatorsNotification(notificationType, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);

          const hostAccount = room.hostAccount;
          const secondPlayerAccount = room.secondPlayerAccount!;

          const winner = !win
            ? null
            : room.hostLeaveTimer
            ? secondPlayerAccount
            : room.hostAccount;

          let p1RatingInc = null,
            p2RatingInc = null;

          if (room.gameRules.mode == GameMode.Rated) {
            const { hostRating, secondPlayerRating } = await UpdateRatings(
              dataContext,
              room,
              hostAccount,
              secondPlayerAccount,
              winner
            );
            p1RatingInc = hostRating;
            p2RatingInc = secondPlayerRating;
          }

          await AddMatchHistory(
            dataContext,
            room,
            hostAccount,
            secondPlayerAccount,
            winner,
            p1RatingInc,
            p2RatingInc,
            ResultCondition.Leave
          );

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.QUICKPLAY,
      (gameRules: GameRules, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline ||
            baseAppSettings.MaintenanceMode == MaintenanceMode.GameplayDisabled) return;

          const userId = players[socket.id].account?.Id;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            roomId ||
            quickPlayManager.UserQueue[userKey!] ||
            (userId && treasureHuntManager.UserRoomId[userId])
          )
            return callback && callback(null);

          quickPlayManager.AddToQueue(
            socket.id,
            players[socket.id].account!,
            gameRules,
            (room) => {
              if (room.roomType == RoomType.Custom) {
                io.to("rooms-page").emit("rooms-page", {
                  roomId: room.id,
                  status: RoomEvent.GameStarted,
                });
              }

              // roomManager.GameStarted(room.id, GameTimeoutCallback);
              roomManager.GamePreStarted(room.id, () => {
                roomManager.DestroyRoom(room.id, spectators, io, UpdateStatusToFriends);
                io.to(room.host).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
                io.to(room.secondPlayer).emit(SocketEvents.GAMECANCELLEDPLAYERNOTREADY);
                room.SendSpectatorsNotification(SpectatorsNotificationType.Cancelled, room.hostReady ? room.hostAccount : room.secondPlayerAccount!, io);
              });

              const hostAccount = room.hostAccount;
              const secondPlayerAccount = room.secondPlayerAccount!;

              let hostWin: any, hostDraw: any, secondPlayerWin: any;

              if (room.gameRules.mode == GameMode.Rated) {
                hostWin = EloRatingEarned(
                  hostAccount,
                  secondPlayerAccount,
                  room.gameRules.type,
                  hostAccount
                );
                hostDraw = EloRatingEarned(
                  hostAccount,
                  secondPlayerAccount,
                  room.gameRules.type
                );
                secondPlayerWin = EloRatingEarned(
                  secondPlayerAccount,
                  hostAccount,
                  room.gameRules.type,
                  secondPlayerAccount
                );
              }

              if (hostAccount.Id) {
                (async () => {
                  UpdateStatusToFriends(hostAccount.Id!, AccountState.PlayingOnline);
                })();
              }

              if (secondPlayerAccount.Id) {
                (async () => {
                  UpdateStatusToFriends(secondPlayerAccount.Id!, AccountState.PlayingOnline);
                })();
              }

              io.to(room.host).emit(SocketEvents.GAMESTART, {
                opponent: secondPlayerAccount,
                user: hostAccount,
                gameElos:
                  room.gameRules.mode == GameMode.Casual
                    ? undefined
                    : {
                        eloWin: hostWin.player1EarnedRating,
                        eloLose: secondPlayerWin.player2EarnedRating,
                        eloDraw: hostDraw.player1EarnedRating,
                      },
                gameRules: room.gameRules,
                side: room.hostPieceSide,
                // startDate: room.gameStartDate,
              });

              io.to(room.secondPlayer).emit(SocketEvents.GAMESTART, {
                opponent: hostAccount,
                user: secondPlayerAccount,
                gameElos:
                  room.gameRules.mode == GameMode.Casual
                    ? undefined
                    : {
                        eloWin: secondPlayerWin.player1EarnedRating,
                        eloLose: hostWin.player2EarnedRating,
                        eloDraw: hostDraw.player2EarnedRating,
                      },
                gameRules: room.gameRules,
                side:
                  room.hostPieceSide == PieceSide.Black
                    ? PieceSide.White
                    : PieceSide.Black,
                // startDate: room.gameStartDate,
              });
            }
          );

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.CANCELQUICKPLAY,
      (data: null, callback: Function) => {
        try {
          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            roomId
          )
            return callback && callback(null);

          quickPlayManager.CancelQueue(socket.id);

          return callback && callback(true);
        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.LEAVEROOMSPAGE, () => {
      socket.leave("rooms-page");
    });

    socket.on(SocketEvents.RESUMEMYGAME, (data: null, callback: Function) => {
      if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

      const userKey = GetAccountKey(players[socket.id]?.account);
      const roomId = roomManager.UserRoomId[userKey!];

      if (
        !players[socket.id] ||
        !players[socket.id].account ||
        !roomId
      )
        return callback && callback(null);

      const user = players[socket.id];
      const room = roomManager.Rooms[roomId];

      if (!room.gameIsRunning || room.gameEndDate)
        return callback && callback(null);
        
      const key = user.account!.Id
        ? `account-${user.account!.Id}`
        : `guest-${user.account!.GuestId}`;
        
      if (!disconnectedPlayerRooms[key]) return callback && callback(null);
        
      room.PlayerResumeGame(socket.id, user.account!);
      
      roomManager.UserRoomId[userKey!] = roomId;
      const isHost = room.host == socket.id;
      const opponent = isHost ? room.secondPlayerAccount : room.hostAccount;
      
      delete disconnectedPlayerRooms[key];

      const hostAccount = room.hostAccount;
      const secondPlayerAccount = room.secondPlayerAccount!;

      const playerWin = isHost
        ? EloRatingEarned(
            hostAccount,
            secondPlayerAccount,
            room.gameRules.type,
            hostAccount
          )
        : EloRatingEarned(
            secondPlayerAccount,
            hostAccount,
            room.gameRules.type,
            secondPlayerAccount
          );
      const hostDraw = EloRatingEarned(
        hostAccount,
        secondPlayerAccount,
        room.gameRules.type
      );

      const hostTimeLeft = room.hostTimer.isRunning
        ? room.hostTimer.timeLeft -
          (new Date().getTime() - room.hostTimer.startRoundTime)
        : room.hostTimer.timeLeft;
      const secondPlayerTimeLeft = room.secondPlayerTimer.isRunning
        ? room.secondPlayerTimer.timeLeft -
          (new Date().getTime() - room.secondPlayerTimer.startRoundTime)
        : room.secondPlayerTimer.timeLeft;

      room.SendSpectatorsNotification(SpectatorsNotificationType.BackToGame, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);

      if (user.account?.Id) {
        (async () => {
          UpdateStatusToFriends(user.account!.Id!, AccountState.PlayingOnline);
        })();
      }

      const specUsers = room.spectators.map((s: string) => 
      {
          const specUser = players[s].account!;

          return {
              Id: specUser.Id,
              GuestId: specUser.GuestId,
              Username: specUser.Username
          }
      });

      return (
        callback &&
        callback({
          identifier: room.id,
          opponent: opponent,
          gameRules: room.gameRules,
          history: room.history,
          secondPlayerTimeLeft: secondPlayerTimeLeft,
          hostTimeLeft: hostTimeLeft,
          playerIsHost: socket.id === room.host,
          isYourTurn: room.playerTurn == socket.id,
          side: isHost
            ? room.hostPieceSide
            : room.hostPieceSide == PieceSide.Black
            ? PieceSide.White
            : PieceSide.Black,
          startDate: room.gameStartDate,
          gameElos: {
            eloWin: playerWin.player1EarnedRating,
            eloLose: playerWin.player2EarnedRating,
            eloDraw: isHost
              ? hostDraw.player1EarnedRating
              : hostDraw.player2EarnedRating,
          },
          spectators: specUsers
        })
      );
    });

    socket.on(SocketEvents.STARTTREASUREHUNT,
      (data: null, callback: Function) => {
        try {

          if (
            baseAppSettings.MaintenanceMode == MaintenanceMode.Offline ||
            baseAppSettings.MaintenanceMode == MaintenanceMode.GameplayDisabled
          )
            return;

          const userId = players[socket.id].account?.Id;

          const userKey = GetAccountKey(players[socket.id]?.account);
          const roomId = roomManager.UserRoomId[userKey!];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !players[socket.id].account!.Id ||
            roomId ||
            quickPlayManager.UserQueue[userKey!] ||
            (userId && treasureHuntManager.UserRoomId[userId])
          )
            return callback && callback(null);

          if (players[socket.id].account!.TreasureHuntTodayGames! >= baseAppSettings.TreasureQuestGamesPerDay) {
            return callback && callback({
              todayAttempts: players[socket.id].account!.TreasureHuntTodayGames
            });
          }

          const room = treasureHuntManager.CreateGame(socket.id, players[socket.id].account!, baseAppSettings.TreasureQuestAttempts);

          if (userId) {
            (async () => {
              UpdateStatusToFriends(userId, AccountState.PlayingTreasure);
            })();
          }

          return callback && callback(true);

        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );
    
    socket.on(SocketEvents.TREASUREHUNTPLACE,
      async (move: string, callback: Function) => {
        try {

          if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

          const userId = players[socket.id].account?.Id;
          const roomId = treasureHuntManager.UserRoomId[userId || 0];

          if (
            !players[socket.id] ||
            !players[socket.id].account ||
            !roomId ||
            !treasureHuntManager.Rooms[roomId]
          )
            return callback && callback(null);

          const room = treasureHuntManager.Rooms[roomId];

          if (!room) return callback && callback(null);

          const resp = room.Play(move);

          if (resp?.status == PlayEnum.OKGameFinished) {

            const key = players[socket.id].account!.Id!;

            if (disconnectedPlayerTreasureHunts[key])
              delete disconnectedPlayerTreasureHunts[key];

            treasureHuntManager.GameEnded(room.id);
            await AddTreasureHuntMatchHistory(dataContext, room, players[socket.id].account!);
            treasureHuntManager.DestroyRoom(room.id, UpdateStatusToFriends);
          }

          return callback && callback(resp);

        } catch (error: any) {
          dataContext.Logs.create({
            Message: error.stack,
            Type: LogType.Error,
            Category: LogCategory.Socket,
            Date: new Date().getTime(),
          });

          return callback && callback(null);
        }
      }
    );

    socket.on(SocketEvents.LEAVEGAMETREASUREHUNT, () => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userId = players[socket.id].account?.Id;

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          !userId ||
          !treasureHuntManager.UserRoomId[userId]
        )
          return;

        const user = players[socket.id];
        const roomId = treasureHuntManager.UserRoomId[userId!];
        const room = treasureHuntManager.Rooms[roomId];

        if (room.gameEndDate) return;
        
        const key = user.account!.Id!;

        disconnectedPlayerTreasureHunts[key] = room.id;

        room.LeaveGame(PlayerLeftTreasureHuntCallback);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.RESUMEMYGAMETREASUREHUNT, (data: null, callback: Function) => {

      if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

      const userId = players[socket.id].account?.Id;
      
      if (
        !players[socket.id] ||
        !players[socket.id].account ||
        !userId ||
        !treasureHuntManager.UserRoomId[userId]
      )
        return callback && callback(null);
      
      const room = treasureHuntManager.Rooms[treasureHuntManager.UserRoomId[userId]];

      if (!room || room.gameEndDate || !disconnectedPlayerTreasureHunts[userId])
        return callback && callback(null);

      room.ResumeGame();
      delete disconnectedPlayerTreasureHunts[userId];

      if (userId) {
        (async () => {
          UpdateStatusToFriends(userId, AccountState.PlayingTreasure);
        })();
      }


      return (
        callback &&
        callback({
          attempts: room.attempts.map(attempt => {
            const treasure = room.treasurePlaces.find(e => e.place.toLowerCase() == attempt.toLowerCase());
            return {
              place: attempt,
              level: treasure?.level
            }
          })
        })
      );
    });

    socket.on(SocketEvents.STARTAIGAME, async (level: number, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userId = players[socket.id].account?.Id;

        const userKey = GetAccountKey(players[socket.id]?.account);
        const roomId = roomManager.UserRoomId[userKey!];

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          roomId ||
          quickPlayManager.UserQueue[userKey!] ||
          (userId && treasureHuntManager.UserRoomId[userId])
        )
          return;

        if (level > 2) {

          const where = {
            AccountId: userId,
            GuestId: players[socket.id].account!.GuestId,
            Result: GameResultType.Win
          };

          if (!where.AccountId) delete where.AccountId;
          else if (!where.GuestId) delete where.GuestId;

          const highestAIGameLevelWon = (await dataContext.AIGameHistories.findOne({
            where,
            order: [["Level", "desc"]],
          }))?.Level || 2;

          if (highestAIGameLevelWon + 1 < level) return callback && callback(false);
        }
          

        let aiGameKey = encryptor.RandomString(32, {symbols: false});
        while (aiGames[aiGameKey] != null) {
          aiGameKey = encryptor.RandomString(32, {symbols: false});
        }

        aiGames[aiGameKey] = {
          socketId: socket.id,
          beginDate: new Date().getTime(),
          level,
          done: () => {
            if (userId) {
              (async () => {
                UpdateStatusToFriends(userId, AccountState.Lobby);
              })();
            }
          }
        }

        userAiGames[socket.id] = aiGameKey;

        if (userId) {
          (async () => {
            UpdateStatusToFriends(userId, AccountState.PlayingAIGame);
          })();
        }

        return callback && callback(aiGameKey);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.LEAVEAIGAME, () => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const aiGameKey = userAiGames[socket.id];

        if (!aiGameKey) return;

        delete aiGames[aiGameKey];
        delete userAiGames[socket.id];

        const userId = players[socket.id].account?.Id;

        if (userId) {
          (async () => {
            UpdateStatusToFriends(userId, AccountState.Lobby);
          })();
        }

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.STARTPUZZLEGAME, async (puzzleId: number, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userId = players[socket.id].account?.Id;

        const userKey = GetAccountKey(players[socket.id]?.account);
        const roomId = roomManager.UserRoomId[userKey!];

        if (
          !players[socket.id] ||
          !players[socket.id].account ||
          roomId ||
          quickPlayManager.UserQueue[userKey!] ||
          (userId && treasureHuntManager.UserRoomId[userId]) ||
          !puzzleId
        )
          return;
          

        let puzzleGameKey = encryptor.RandomString(32, {symbols: false});
        while (puzzleGames[puzzleGameKey] != null) {
          puzzleGameKey = encryptor.RandomString(32, {symbols: false});
        }

        puzzleGames[puzzleGameKey] = {
          socketId: socket.id,
          beginDate: new Date().getTime(),
          puzzleId,
          done: () => {
            if (userId) {
              (async () => {
                UpdateStatusToFriends(userId, AccountState.Lobby);
              })();
            }
          }
        }

        userPuzzleGames[socket.id] = puzzleGameKey;

        if (userId) {
          (async () => {
            UpdateStatusToFriends(userId, AccountState.PlayingPuzzleGame);
          })();
        }

        return callback && callback(puzzleGameKey);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.LEAVEPUZZLEGAME, () => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const puzzleGameKey = userPuzzleGames[socket.id];

        if (!puzzleGameKey) return;

        delete puzzleGames[puzzleGameKey];
        delete userPuzzleGames[socket.id];

        const userId = players[socket.id].account?.Id;

        if (userId) {
          (async () => {
            UpdateStatusToFriends(userId, AccountState.Lobby);
          })();
        }

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });
      }
    });

    socket.on(SocketEvents.MESSAGE, async (data: any, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const { message, accountId } = data;

        if (
          !players[socket.id] ||
          !players[socket.id].account?.Id ||
          !accountId ||
          !message
        )
          return;

        const date = new Date();

        await dataContext.Messages.create({
          Message: message,
          AccountId: players[socket.id].account!.Id,
          TargetAccountId: accountId,
          Date: date.getTime()
        });
        
        if (playersIds[accountId]) {
          const acc = players[socket.id].account!;
          io.to(playersIds[accountId]).emit(SocketEvents.MESSAGE, {
            sender: {
              Id: acc.Id,
              Avatar: acc.Avatar,
              Username: acc.Username
            },
            message: message,
            date: date
          });
        }

        return callback && callback(true);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });

        return callback && callback(false);
      }
    });

    socket.on(SocketEvents.GAMEMESSAGE, async (message: string, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const userKey = GetAccountKey(players[socket.id]?.account);
        const roomId = roomManager.UserRoomId[userKey!];

        if (
          !players[socket.id] ||
          !players[socket.id].account?.Id ||
          !roomId ||
          !message
        )
          return;

        const room = roomManager.Rooms[roomId];
        const otherAccount = room.host == socket.id ? room.secondPlayerAccount : room.hostAccount;

        room.SendSpectatorsNotification(SpectatorsNotificationType.Chat, socket.id == room.host ? room.hostAccount : room.secondPlayerAccount!, io);

        if (!otherAccount?.Id) return;

        const date = new Date();

        await dataContext.Messages.create({
          Message: message,
          AccountId: players[socket.id].account!.Id,
          TargetAccountId: otherAccount.Id,
          RoomIdentifier: roomId,
          Date: date.getTime()
        });
        
        if (playersIds[otherAccount.Id]) {
          // const acc = players[socket.id].account!;
          io.to(playersIds[otherAccount.Id]).emit(SocketEvents.GAMEMESSAGE, {
            // sender: {
            //   Id: acc.Id,
            //   Avatar: acc.Avatar,
            //   Username: acc.Username
            // },
            message: message,
            date: date
          });
        }

        return callback && callback(true);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });

        return callback && callback(false);
      }
    });

    socket.on(SocketEvents.GAMESPECTATORMESSAGE, async (message: string, callback: Function) => {
      try {
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return;

        const roomId = spectators[socket.id];

        if (
          !players[socket.id] ||
          !players[socket.id].account?.Id ||
          !roomId ||
          !message
        )
          return;

        const room = roomManager.Rooms[roomId];

        const date = new Date();

        const acc = players[socket.id].account!;

        await dataContext.Messages.create({
          Message: message,
          AccountId: acc.Id,
          TargetAccountId: acc.Id,
          RoomIdentifier: roomId,
          Date: date.getTime()
        });
        
        room.SendSpectatorMessage(message, acc, io);

        return callback && callback(true);

      } catch (error: any) {
        dataContext.Logs.create({
          Message: error.stack,
          Type: LogType.Error,
          Category: LogCategory.Socket,
          Date: new Date().getTime(),
        });

        return callback && callback(false);
      }
    });

  });
};
