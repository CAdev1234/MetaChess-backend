import { StatusCode as statusCode } from "../Enums/StatusCode";
import { AccountRole as accountRole } from "../Enums/AccountRole";
import {
  ValidateAuthorization,
  RequiresRole,
  RequiresRoleAcc,
} from "../Utils/dataContextValidations";
import { Op } from "sequelize";
import { Globals } from "../globals";
import { AccountPrivileges } from "../Enums/AccountPrivileges";
import encryptor from "../Utils/Encryptor";
import { PuzzleStatus, PuzzleType } from "../Enums/Puzzle";
import { CheckEnumIsValid } from "../Utils/Helpers";

export default (app: any, emailManager: any, baseAppSettings: any, playersIds: any, roomManager: any, treasureHuntManager: any, dataContext: any) => {

  app.post('/backoffice/login', async (req: any, res: any) => {
    
    const { Email, Password } = req.body;

    if (!Email || !Password) return res.status(statusCode.BadRequest).send();

    // Searches account with the email send in database
    const account = await dataContext.Accounts.findOne({where: {Email}});

    // If email/username was not found in database, returns NotFound
    if (!account) return res.status(statusCode.NotFound).send();

    if (account.IsBanned) return res.status(statusCode.Unauthorized).send('blocked');

    if (account.FailedPasswordAttempts >= 5) return res.status(statusCode.Locked).send({
        FailedAttempts: account.FailedPasswordAttempts
    });

    
    // Check is encrypted (Rfc2898DeriveBytes) password matches
    encryptor.IsValid(Password, account.SaltPassword, async (valid: boolean) => {

        // If passwords did not match, returns Unauthorized
        if (!valid) {
            account.update({
                FailedPasswordAttempts: account.FailedPasswordAttempts + 1
            });
            return res.status(statusCode.Unauthorized).send();
        }

        const hasRequiredRole = await RequiresRoleAcc(
          account,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner]
        );

        if (!hasRequiredRole) return res.status(statusCode.Unauthorized).send();

        // Generate token for the client
        var token = encryptor.RandomString(128, {symbols: false});

        const saltToken = encryptor.Encrypt(token);

        // Encrypts the token to save in database
        // encryptor.Generate(token, async (saltToken) => {
            
        var nowDate = new Date();
        
        // Save session to database
        
        await dataContext.Sessions.create({
            SaltSessionToken: token,
            AccountId: account.Id,
            CreationDate: nowDate.getTime(),
            Expires: new Date(nowDate.setFullYear(nowDate.getFullYear() + 1)).getTime()
        });
            
        return res.status(statusCode.OK).send(saltToken);
        // });



    });

  });

  app.post("/backoffice/serverstatus", async (req: any, res: any) => {
    const { Mode, Time, Duration } = req.body;
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: any, responseMessage: string, accountId: any) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const appSettings = await dataContext.BaseAppSettings.findOne();

        appSettings.update({ MaintenanceMode: Mode, MaintenanceTime: Time, MaintenanceDuration: Duration});

        baseAppSettings.MaintenanceMode = Mode;
        baseAppSettings.MaintenanceTime = Time ? new Date(Time).getTime() : null;
        baseAppSettings.MaintenanceDuration = Duration;

        Globals.TriggerAppSettingsChange();

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.post("/backoffice/appsettings", async (req: any, res: any) => {
    const { Level1TreasureValue, Level2TreasureValue, Level3TreasureValue, BoardOddSquaresColor, BoardEvenSquaresColor } = req.body;
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: any, responseMessage: string, accountId: any) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const appSettings = await dataContext.BaseAppSettings.findOne();

        appSettings.update({
          Level1TreasureValue,
          Level2TreasureValue,
          Level3TreasureValue,
          BoardOddSquaresColor,
          BoardEvenSquaresColor
        });

        baseAppSettings.Level1TreasureValue = Level1TreasureValue;
        baseAppSettings.Level2TreasureValue = Level2TreasureValue;
        baseAppSettings.Level3TreasureValue = Level3TreasureValue;
        baseAppSettings.BoardOddSquaresColor = BoardOddSquaresColor;
        baseAppSettings.BoardEvenSquaresColor = BoardEvenSquaresColor;

        Globals.TriggerAppSettingsChange();

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.get("/backoffice/news", async (req: any, res: any) => {
    
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
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const where: any = {
          IsDeleted: false,
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.News.findOne({ where: { Id: startingAfter } }))
        )
          return res.status(statusCode.BadRequest).send();

        const news = await dataContext.News.findAll({
          order: [["Id", "desc"]],
          include: {
            model: dataContext.NewTags,
            include: dataContext.Tags,
          },
          limit: top,
          where,
        }).map(async (e: any) => {
          return {
            Id: e.Id,
            Title: e.Title,
            SmallDescription: e.SmallDescription,
            // Content: e.Content,
            ScheduleDate: new Date(e.ScheduleDate),
            IsDraft: e.IsDraft && (!e.ScheduleDate || e.ScheduleDate >= new Date().getTime()),
            Tags: e.NewTags.map((t: any) => t.Tag.Text),
          };
        });

        return res.status(statusCode.OK).send(news);
      }
    );
  });

  app.get("/backoffice/news/:newId([\\d]+)", async (req: any, res: any) => {
    const { newId } = req.params;
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const newItem = await dataContext.News.findOne({
          include: {
            model: dataContext.NewTags,
            include: dataContext.Tags,
          },
          where: { Id: newId, IsDeleted: false },
        });

        if (!newItem) return res.status(statusCode.NotFound).send();

        const result = {
          Id: newItem.Id,
          Title: newItem.Title,
          SmallDescription: newItem.SmallDescription,
          Content: newItem.Content,
          ScheduleDate: newItem.ScheduleDate,
          IsDraft: newItem.IsDraft && (!newItem.ScheduleDate || newItem.ScheduleDate >= new Date().getTime()),
          Tags: newItem.NewTags.map((t: any) => t.Tag.Text),
        };

        return res.status(statusCode.OK).send(result);
      }
    );
  });

  app.post("/backoffice/news", async (req: any, res: any) => {
    const {
      Title,
      Content,
      SmallDescription,
      ScheduleDate,
      Tags,
      IsDraft,
      PostDate
    } = req.body;
    const { authorization } = req.headers;

    if (!Title || !Content || !SmallDescription) return res.status(statusCode.BadRequest).send();

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: any, responseMessage: string, accountId: any) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        // if (Tags && await dataContext.Tags.count({where: {Id: Tags, IsDeleted: false}}) != Tags.length) return res.status(statusCode.BadRequest).send();

        const addedNew = await dataContext.News.create({
          Title,
          SmallDescription,
          Content,
          ScheduleDate: ScheduleDate ? new Date(ScheduleDate).getTime() : null,
          IsDraft,
          PostDate: PostDate ? new Date(PostDate).getTime() : ScheduleDate ? new Date(ScheduleDate).getTime() : new Date().getTime()
          // PostDate:
          //   !IsDraft && ScheduleDate != null ? new Date().getTime() : null,
        });

        if (Tags && Tags.length > 0) {
          let tagsToUpdate = await dataContext.Tags.findAll({
            where: { Text: Tags },
          });

          for (const tag of Tags) {
            const tagToUpdate = tagsToUpdate.find((e: any) => e.Text == tag);

            if (tagToUpdate) {
              tagToUpdate.update({
                LastUsedDate: new Date().getTime(),
              });
            } else {
              await dataContext.Tags.create({
                Text: tag,
                LastUsedDate: new Date().getTime(),
              });
            }
          }

          tagsToUpdate = await dataContext.Tags.findAll({
            where: { Text: Tags },
          });

          tagsToUpdate.forEach(async (tag: any) => {
            await dataContext.NewTags.create({
              TagId: tag.Id,
              NewId: addedNew.Id,
            });
          });
        }

        return res.status(statusCode.Created).send();
      }
    );
  });

  app.post("/backoffice/news/:newId([\\d]+)", async (req: any, res: any) => {
    const { newId } = req.params;
    const {
      Title,
      Content,
      SmallDescription,
      ScheduleDate,
      PostDate,
      Tags,
      IsDraft,
    } = req.body;
    const { authorization } = req.headers;

    if (!Title || !Content || !SmallDescription) return res.status(statusCode.BadRequest).send();

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        // if (
        //   Tags &&
        //   (await dataContext.Tags.count({
        //     where: { Id: Tags, IsDeleted: false },
        //   })) != Tags.length
        // )
        //   return res.status(statusCode.BadRequest).send();

        const newToUpdate = await dataContext.News.findOne({
          include: dataContext.NewTags,
          where: { Id: newId, IsDeleted: false },
        });

        if (!newToUpdate) return res.status(statusCode.NotFound).send();

        newToUpdate.update({
          Title,
          SmallDescription,
          Content,
          ScheduleDate: ScheduleDate ? new Date(ScheduleDate).getTime() : null,
          IsDraft,
          PostDate: PostDate ? new Date(PostDate).getTime() : ScheduleDate ? new Date(ScheduleDate).getTime() : new Date().getTime()
          // PostDate:
          //   !IsDraft && ScheduleDate != null ? new Date().getTime() : null,
        });

        let tagsToUpdate : any = [];

        if (Tags && Tags.length > 0) {
          tagsToUpdate = await dataContext.Tags.findAll({
            where: { Text: Tags },
          });

          for (const tag of Tags) {
            const tagToUpdate = tagsToUpdate.find((e: any) => e.Text == tag);

            if (tagToUpdate) {
              tagToUpdate.update({
                LastUsedDate: new Date().getTime(),
              });
            } else {
              await dataContext.Tags.create({
                Text: tag,
                LastUsedDate: new Date().getTime(),
              });
            }
          }

          tagsToUpdate = await dataContext.Tags.findAll({
            where: { Text: Tags },
          });
        }

        newToUpdate.NewTags.forEach(async (e: any) => {
          if (!tagsToUpdate.some((e: any) => e.Id == e.TagId)) {
            await e.destroy();
          }
        });

        tagsToUpdate.forEach(async (e: any) => {
          if (!newToUpdate.NewTags.some((a: any) => a.TagId == e.Id)) {
            await dataContext.NewTags.create({
              TagId: e.Id,
              NewId: newId,
            });
          }
        });

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.delete("/backoffice/news/:newId([\\d]+)", async (req: any, res: any) => {
    const { newId } = req.params;
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const newToRemove = await dataContext.News.findOne({
          where: { Id: newId, IsDeleted: false },
        });

        if (!newToRemove) return res.status(statusCode.NotFound).send();

        newToRemove.update({
          IsDeleted: true,
        });

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.get("/backoffice/accounts", async (req: any, res: any) => {
    let { skip, top, search } = req.query;
    const { authorization } = req.headers;

    if (!top || !/[\d]+/.test(top)) top = 25;
    else top = parseInt(top);

    if (!skip || !/[\d]+/.test(skip)) skip = 0;
    else skip = parseInt(skip);

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        let where: any = {
          [Op.or]: [
            {
              Username: {
                [Op.like]: `%${search}%`,
              }
            },
            {
              Fullname: {
                [Op.like]: `%${search}%`,
              }              
            },
            {
              Email: {
                [Op.like]: `%${search}%`,
              }
            },
          ]
        }

        if (!search) where = undefined;

        const accounts = await dataContext.Accounts.findAll({
          order: [["Id", "desc"]],
          limit: top,
          offset: skip,
          where
        }).map(async (e: any) => {
          return {
            Id: e.Id,
            IsBanned: e.IsBanned,
            Privileges: e.Privileges,
            Fullname: e.Fullname,
            Username: e.Username,
            Role: e.Role,
            GameStatus: roomManager.UserRoomId[e.Id] ? 'pvp' : treasureHuntManager.UserRoomId[e.Id] ? 'treasure-quest' : undefined,
            RoomId: roomManager.UserRoomId[e.Id],
            IsOnline: !!playersIds[e.Id],
            FailedPasswordAttempts: e.FailedPasswordAttempts,
          };
        });

        const count = await dataContext.Accounts.count({where});

        return res.status(statusCode.OK).send({
          results: accounts,
          count
        });
      }
    );
  });

  app.get("/backoffice/accounts/stats", async (req: any, res: any) => {
    
    const { authorization } = req.headers;

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const AllUsers = await dataContext.Accounts.count();

        const VerifiedUsers = await dataContext.Accounts.count({
          where: {
            IsVerified: true
          }
        });

        const BannedUsers = await dataContext.Accounts.count({
          where: {
            IsBanned: true
          }
        });

        const AllGuests = await dataContext.Guests.count();

        const OnlineGuests = Object.keys(playersIds).filter(e => e.startsWith('g-')).length;


        return res.status(statusCode.OK).send({
          AllUsers,
          VerifiedUsers,
          BannedUsers,
          AllGuests,
          OnlineGuests,
          OnlineUsers: Object.keys(playersIds).length - OnlineGuests,
        });
      }
    );
  });

  app.post("/backoffice/accounts/:userId([\\d]+)",
    async (req: any, res: any) => {
      const { userId } = req.params;
      const { authorization } = req.headers;
      const { Role, IsBanned, Privileges } = req.body;

      if (Role < 0 || Role > 2 || Privileges > AccountPrivileges.All) return res.status(statusCode.BadRequest).send();

      await ValidateAuthorization(
        authorization,
        dataContext,
        async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
          if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

          const hasRequiredRole = await RequiresRole(
            accountId,
            [accountRole.SuperAdmin, accountRole.Owner],
            dataContext
          );

          if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

          var senderAccount = await dataContext.Accounts.findOne({
            where: { Id: accountId },
          });
          var account = await dataContext.Accounts.findOne({
            where: { Id: userId },
          });

          if (!account) return res.status(statusCode.NotFound).send();

          if (senderAccount.Role <= account.Role || senderAccount.Role == Role)
            return res.status(statusCode.Forbidden).send();

          account.update({
            Role: Role,
            Privileges: Privileges,
            IsBanned: IsBanned
          });

          return res.status(statusCode.OK).send();
        }
      );
    }
  );

  app.post("/backoffice/accounts/:userId([\\d]+/passwordattempts)",
    async (req: any, res: any) => {
      const { userId } = req.params;
      const { authorization } = req.headers;

      await ValidateAuthorization(
        authorization,
        dataContext,
        async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
          if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

          const hasRequiredRole = await RequiresRole(
            accountId,
            [accountRole.SuperAdmin, accountRole.Owner],
            dataContext
          );

          if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

          var senderAccount = await dataContext.Accounts.findOne({
            where: { Id: accountId },
          });
          var account = await dataContext.Accounts.findOne({
            where: { Id: userId },
          });

          if (!account) return res.status(statusCode.NotFound).send();

          if (senderAccount.Role <= account.Role)
            return res.status(statusCode.Forbidden).send();

          account.update({
            FailedPasswordAttempts: 0,
          });

          return res.status(statusCode.OK).send();
        }
      );
    }
  );

  app.get('/backoffice/puzzles', async (req: any, res: any) => {

    let { startingAfter, top, search } = req.query;
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
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const where: any = {
          Name: {
            [Op.like]: search
          },
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!search) delete where.Name;
        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.Puzzles.findOne({ where: { Id: startingAfter } }))
        )
          return res.status(statusCode.BadRequest).send();

        const puzzles = await dataContext.Puzzles.findAll({
          order: [["Id", "desc"]],
          limit: top,
          where,
        }).map(async (e: any) => {
          return {
            Id: e.Id,
            Name: e.Name,
            Data: e.Data,
            CreationDate: new Date(e.CreationDate),
            BaseTime: e.BaseTime,
            IncrementTime: e.IncrementTime,
            Type: e.Type,
            SurviveTurns: e.SurviveTurns,
            Status: e.Status,
            IsWhite: e.IsWhite
          };
        });

        return res.status(statusCode.OK).send(puzzles);
      }
    );

  });

  app.post("/backoffice/puzzles", async (req: any, res: any) => {
    const {
      Name,
      Data,
      Status,
      BaseTime,
      IncrementTime,
      Type,
      SurviveTurns,
      IsWhite
    } = req.body;

    const { authorization } = req.headers;
    
    if (!Name || !Data || !CheckEnumIsValid(PuzzleStatus, Status) || !CheckEnumIsValid(PuzzleType, Type) || (Type == PuzzleType.Survive && !SurviveTurns)) return res.status(statusCode.BadRequest).send();

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: any, responseMessage: string, accountId: any) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const existingPuzzle = await dataContext.Puzzles.findOne({where: { Name }});

        if (existingPuzzle) return res.status(statusCode.Conflict).send();

        await dataContext.Puzzles.create({
          Name,
          Data,
          CreationDate: new Date().getTime(),
          BaseTime,
          IncrementTime,
          Type,
          SurviveTurns,
          Status,
          IsWhite
        });

        return res.status(statusCode.Created).send();
      }
    );
  });

  app.post("/backoffice/puzzles/:puzzleId([\\d]+)", async (req: any, res: any) => {
    const { puzzleId } = req.params;
    const {
      Name,
      Data,
      Status,
      BaseTime,
      IncrementTime,
      Type,
      SurviveTurns,
      IsWhite
    } = req.body;
    const { authorization } = req.headers;
    
    if (!Name || !Data || !CheckEnumIsValid(PuzzleStatus, Status) || !CheckEnumIsValid(PuzzleType, Type) || (Type == PuzzleType.Survive && !SurviveTurns)) return res.status(statusCode.BadRequest).send();

    await ValidateAuthorization(
      authorization,
      dataContext,
      async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
        if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

        const hasRequiredRole = await RequiresRole(
          accountId,
          [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner],
          dataContext
        );

        if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

        const puzzle = await dataContext.Puzzles.findOne({
          where: { Id: puzzleId },
        });

        if (!puzzle) return res.status(statusCode.NotFound).send();

        if (puzzle.Name != Name) { 
          const existingPuzzle = await dataContext.Puzzles.findOne({where: { Name }});
          
          if (existingPuzzle) return res.status(statusCode.Conflict).send();
        }

        puzzle.update({
          Name,
          Data,
          BaseTime,
          IncrementTime,
          Type,
          SurviveTurns,
          Status,
          IsWhite
        });

        return res.status(statusCode.OK).send();
      }
    );
  });

};
