import { fn, Op } from "sequelize";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { ValidateAuthorization } from "../Utils/dataContextValidations";
import { MaintenanceMode } from "../globals";

export default (
  app: any,
  baseAppSettings: any,
  dataContext: any
) => {

  app.get("/message/:friendAccountId([\\d]+)", async (req: any, res: any) => {

    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { friendAccountId } = req.params;
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

        const where : any = {
          [Op.or]: [
            {
              AccountId: accountId,
              TargetAccountId: friendAccountId
            },
            {
              AccountId: friendAccountId,
              TargetAccountId: accountId
            }
          ],
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.Messages.findOne({
            where: {
              [Op.or]: [
                {
                  AccountId: accountId,
                  TargetAccountId: friendAccountId
                },
                {
                  AccountId: friendAccountId,
                  TargetAccountId: accountId
                }
              ],
              Id: startingAfter
            },
          }))
        )
          return res.status(statusCode.BadRequest).send();

        const messages = await dataContext.Messages.findAll({
          include: [
            {
              model: dataContext.Accounts,
              as: "Account",
            },
            {
              model: dataContext.Accounts,
              as: "TargetAccount",
            },
          ],
          order: [["Id", "desc"]],
          limit: top,
          where,
        });

        const resolvedMessages = messages.map(
          (msg: any) => ({
            Id: msg.Id,
            Message: msg.Message,
            Date: new Date(msg.Date),
            IsRead: msg.IsRead,
            Sender: {
              Id: msg.Account.Id,
              Avatar: msg.Account.Avatar,
              Username: msg.Account.Username,
            }
          })
        );

        return res.status(statusCode.OK).send(resolvedMessages);
      }
    );
  });

  app.get("/message/game/:roomId([\\w]+)", async (req: any, res: any) => {

    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { roomId } = req.params;
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

        const where : any = {
          [Op.or]: [
            {
              AccountId: accountId,
              TargetAccountId: {
                [Op.ne]: accountId
              }
            },
            {
              TargetAccountId: accountId,
              AccountId: {
                [Op.ne]: accountId
              }
            }
          ],
          RoomIdentifier: roomId,
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.Messages.findOne({
            where
          }))
        )
          return res.status(statusCode.BadRequest).send();

        const messages = await dataContext.Messages.findAll({
          include: [
            {
              model: dataContext.Accounts,
              as: "Account",
            },
            {
              model: dataContext.Accounts,
              as: "TargetAccount",
            },
          ],
          order: [["Id", "desc"]],
          limit: top,
          where,
        });

        const resolvedMessages = messages.map(
          (msg: any) => ({
            Id: msg.Id,
            Message: msg.Message,
            Date: new Date(msg.Date),
            // IsRead: msg.IsRead,
            Sender: {
              Id: msg.Account.Id,
              Avatar: msg.Account.Avatar,
              Username: msg.Account.Username,
            }
          })
        );

        return res.status(statusCode.OK).send(resolvedMessages);
      }
    );
  });

  app.post("/message/:friendAccountId([\\d]+)/read", async (req: any, res: any) => {

    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { friendAccountId } = req.params;
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

        await dataContext.Database.query(`update Message set IsRead = 1 where IsRead = 0 and AccountId = ${friendAccountId} and TargetAccountId = ${accountId} and RoomIdentifier is null`);

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.get("/message/unread", async (req: any, res: any) => {

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

        const messages = await dataContext.Messages.findAll({
          attributes: ['Message.*', 'Account.*', [fn('COUNT', 'Message.Id'), 'MessagesCount']],
          group: [ 'Account.Id' ],
          include: [
            {
              model: dataContext.Accounts,
              as: "Account",
            }
          ],
          where: {
            TargetAccountId: accountId,
            IsRead: false,
            RoomIdentifier: null
          },
        });

        const resolvedData = messages.map((msg: any) => ({
          Sender: {
            Id: msg.Account.Id,
            Avatar: msg.Account.Avatar,
            Username: msg.Account.Username,
          },
          MessagesCount: msg.dataValues.MessagesCount
        }));

        return res.status(statusCode.OK).send(resolvedData);
      }
    );
  });

  app.get("/message/chats", async (req: any, res: any) => {

    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    let { skip, top } = req.query;
    const { authorization } = req.headers;

    if (!top || !/[\d]+/.test(top)) top = 5;
    else top = parseInt(top);

    if (!skip || !/[\d]+/.test(skip)) skip = 0;
    else skip = parseInt(skip);

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

        const messages = (await dataContext.Database.query(`select a.Date, a.Message, (case when a.AccountId = ${accountId} then a.TargetAccountId else a.AccountId end) as OtherAccountId
                                                            from Message a
                                                            left join Message b on ((a.AccountId = b.AccountId and a.TargetAccountId = b.TargetAccountId) or (a.AccountId = b.TargetAccountId and a.TargetAccountId = b.AccountId)) and b.Id > a.Id
                                                            where (a.AccountId = ${accountId} or a.TargetAccountId = ${accountId}) and b.Id is null
                                                            limit ${top}
                                                            ${skip ? `offset ${skip}` : ''}`))[0];

        const accounts = await dataContext.Accounts.findAll({where: {Id: messages.map((e: any) => e.OtherAccountId)}});

        
        const resolvedData = messages.map((msg: any) => {
          
          const acc = accounts.find((acc: any) => acc.Id == msg.OtherAccountId);

          return {
            LastMessage: msg.Message,
            LastMessageDate: msg.Date,
            Account: {
              Id: acc.Id,
              Avatar: acc.Avatar,
              Username: acc.Username,
            },
          }
        });

        return res.status(statusCode.OK).send(resolvedData);
      }
    );
  });
  
};
