import { Op } from "sequelize";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { ValidateAuthorization } from "../Utils/dataContextValidations";
import { Globals, MaintenanceMode } from "../globals";
import { Player } from "../Classes/Player";
import { SocketEvents } from "../Classes/SocketEvents";

export default (
  app: any,
  dataContext: any,
  players: Record<string, Player>,
  playersIds: Record<number, string>,
  roomManager: any,
  treasureHuntManager: any,
  baseAppSettings: any,
  io: any
) => {
  app.get("/friend/list", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (
        errorStatusCode: statusCode,
        responseMessage: string,
        accountId: number
      ) => {
        if (errorStatusCode)
          return res.status(errorStatusCode).send(responseMessage);

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

        const friendsList = [...account.Friends, ...account.AccountFriends].map(
          (acc: any) => ({
            Id: acc.Friend.Id,
            Account: {
              Id: acc.Id,
              Avatar: acc.Avatar,
              Username: acc.Username,
              GameStatus: playersIds[acc.Id] ? players[playersIds[acc.Id]]?.state : undefined,
              IsOnline: !!playersIds[acc.Id],
            },
          })
        );

        return res.status(statusCode.OK).send(friendsList);
      }
    );
  });

  app.get("/friend/requests", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    let { startingAfter, top } = req.query;
    const { authorization } = req.headers;

    if (startingAfter && !/[\d]+/.test(startingAfter))
      return res
        .status(statusCode.BadRequest)
        .send("StartingAfter must be an integer");
    if (!top || !/[\d]+/.test(top)) top = 25;
    else top = parseInt(top);

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (
        errorStatusCode: statusCode,
        responseMessage: string,
        accountId: number
      ) => {
        if (errorStatusCode)
          return res.status(errorStatusCode).send(responseMessage);

        const where: any = {
          FriendId: accountId,
          IsRejected: false,
          IsAccepted: false,
          IsRemoved: false,
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.Friends.findOne({
            where: {
              AccountId: accountId,
              FriendId: startingAfter,
              IsAccepted: true,
            },
          }))
        )
          return res.status(statusCode.BadRequest).send();

        // Get all friend requests
        const friendRequests = await dataContext.Friends.findAll({
          order: [["Id", "desc"]],
          limit: top,
          where,
        });

        const account = await dataContext.Accounts.findOne({
          include: [
            {
              model: dataContext.Accounts,
              as: "AccountFriends",
              through: {
                where: {
                  Id: friendRequests.map((e: any) => e.Id)
                },
              },
            },
          ],
          where: {
            Id: accountId,
          },
        });

        const resolvedFriendRequests = account.AccountFriends.map((acc: any) => {
          return {
            Id: acc.Friend.Id,
            Account: {
              Id: acc.Id,
              Avatar: acc.Avatar,
              Fullname: acc.Fullname,
              Username: acc.Username,
            },
          };
        });

        return res.status(statusCode.OK).send(resolvedFriendRequests);
      }
    );
  });

  app.post("/friend/requests/:inviteId([\\d]+/accept)", async (req: any, res: any) => {
      if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
        return res.status(statusCode.ServiceUnavailable).send();

      const { inviteId } = req.params;
      const { authorization } = req.headers;

      await ValidateAuthorization(
        authorization,
        dataContext,
        async (
          errorStatusCode: statusCode,
          responseMessage: string,
          accountId: number
        ) => {
          if (errorStatusCode)
            return res.status(errorStatusCode).send(responseMessage);

          // Get friend request to update
          const friendRequest = await dataContext.Friends.findOne({
            where: {
              Id: inviteId,
              FriendId: accountId,
              IsRejected: false,
              IsAccepted: false,
              IsRemoved: false,
            },
          });

          if (!friendRequest) return res.status(statusCode.NotFound).send();


          const friendsCount = dataContext.Friends.count({
            where: {
              [Op.or]: [
                {
                  AccountId: accountId,
                  IsRemoved: false,
                  IsRejected: false,
                  IsAccepted: true
                },
                {
                  FriendId: accountId,
                  IsRemoved: false,
                  IsRejected: false,
                  IsAccepted: true
                },
              ],
            }
          });

          if (friendsCount == 200) return res.status(statusCode.NotAcceptable).send();

          await friendRequest.update({
            IsAccepted: true,
            ResponseDate: new Date().getTime(),
          });

          const otherGuySocketId = playersIds[friendRequest.AccountId];
          const otherGuyIsOnline = otherGuySocketId && !!players[otherGuySocketId]?.account;

          if (otherGuyIsOnline) {
            
            const currSocketId = playersIds[accountId];
            const currAccountIsOnline = currSocketId && !!players[currSocketId]?.account;
            const currAccount = currAccountIsOnline ? players[currSocketId].account : await dataContext.Accounts.findByPk(accountId);

            io.to(otherGuySocketId).emit(SocketEvents.FRIENDADDED, {
              Id: friendRequest.Id,
              Account: {
                Id: currAccount!.Id,
                Avatar: currAccount!.Avatar,
                Username: currAccount!.Username,
                IsOnline: currAccountIsOnline
              },
            });
          }

          return res.status(statusCode.OK).send(otherGuyIsOnline);
        }
      );
    }
  );

  app.post("/friend/requests/:inviteId([\\d]+)/refuse", async (req: any, res: any) => {
      if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
        return res.status(statusCode.ServiceUnavailable).send();

      const { inviteId } = req.params;
      const { authorization } = req.headers;

      await ValidateAuthorization(
        authorization,
        dataContext,
        async (
          errorStatusCode: statusCode,
          responseMessage: string,
          accountId: number
        ) => {
          if (errorStatusCode)
            return res.status(errorStatusCode).send(responseMessage);

          // Get friend request to update
          const friendRequest = await dataContext.Friends.findOne({
            where: {
              Id: inviteId,
              FriendId: accountId,
              IsRejected: false,
              IsAccepted: false,
              IsRemoved: false,
            },
          });

          if (!friendRequest) return res.status(statusCode.NotFound).send();

          await friendRequest.update({
            IsRejected: true,
            ResponseDate: new Date().getTime(),
          });

          return res.status(statusCode.OK).send({
            Id: inviteId,
            IsRejected: true,
          });
        }
      );
    }
  );

  app.post("/friend/requests/:userId([\\d]+)", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { userId } = req.params;
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (
        errorStatusCode: statusCode,
        responseMessage: string,
        accountId: number
      ) => {
        if (errorStatusCode)
          return res.status(errorStatusCode).send(responseMessage);

        if (userId == accountId)
          return res.status(statusCode.BadRequest).send("1");

        const friendsCount = dataContext.Friends.count({
          where: {
            [Op.or]: [
              {
                AccountId: accountId,
                IsRemoved: false,
                IsRejected: false,
                IsAccepted: true
              },
              {
                FriendId: accountId,
                IsRemoved: false,
                IsRejected: false,
                IsAccepted: true
              },
            ],
          }
        });

        if (friendsCount == 200) return res.status(statusCode.NotAcceptable).send();

        // Searches target account in database
        const targetFriend = await dataContext.Accounts.findOne({
          where: { Id: userId },
        });

        if (!targetFriend) return res.status(statusCode.BadRequest).send("2");

        // Searches friend request in database
        const friendRequest = await dataContext.Friends.findOne({
          where: {
            [Op.or]: [
              {
                AccountId: accountId,
                FriendId: userId,
                IsRemoved: false,
                IsRejected: false,
              },
              {
                AccountId: userId,
                FriendId: accountId,
                IsRemoved: false,
                IsRejected: false,
              },
            ],
          },
        });

        if (friendRequest) {
          if (friendRequest.IsAccepted)
            return res.status(statusCode.Conflict).send("3");
          // If friend request was already made returns error
          else return res.status(statusCode.OK).send();
        } else {
          
          const newFriendRequest = await dataContext.Friends.create({
            AccountId: accountId,
            FriendId: userId,
            SentDate: new Date().getTime(),
          });

          const otherGuySocketId = playersIds[userId];
          const otherGuyIsOnline = otherGuySocketId && !!players[otherGuySocketId]?.account;

          if (otherGuyIsOnline) {
            
            const currSocketId = playersIds[accountId];
            const currAccountIsOnline = currSocketId && !!players[currSocketId]?.account;
            const currAccount = currAccountIsOnline ? players[currSocketId].account : await dataContext.Accounts.findByPk(accountId);

            io.to(otherGuySocketId).emit(SocketEvents.FRIENDREQUEST, {
              Id: newFriendRequest.Id,
              Account: {
                Id: currAccount!.Id,
                Avatar: currAccount!.Avatar,
                Username: currAccount!.Username,
                IsOnline: currAccountIsOnline
              },
            });
          }
        }

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.post("/friend/requests/:inviteId([\\d]+)/remove", async (req: any, res: any) => {
      if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
        return res.status(statusCode.ServiceUnavailable).send();

      const { inviteId } = req.params;
      const { authorization } = req.headers;

      await ValidateAuthorization(
        authorization,
        dataContext,
        async (
          errorStatusCode: statusCode,
          responseMessage: string,
          accountId: number
        ) => {
          if (errorStatusCode)
            return res.status(errorStatusCode).send(responseMessage);

          // Get friend request to update
          const friendRequest = await dataContext.Friends.findOne({
            where: {
              Id: inviteId,
              IsAccepted: true,
              IsRemoved: false,
              [Op.or]: {
                AccountId: accountId,
                FriendId: accountId,
              },
            },
          });

          if (!friendRequest) return res.status(statusCode.NotFound).send();

          await friendRequest.update({
            IsRemoved: true,
          });

          return res.status(statusCode.OK).send();
        }
      );
    }
  );
};
