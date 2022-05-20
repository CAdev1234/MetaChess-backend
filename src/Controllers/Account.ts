import { col, fn, Op } from "sequelize";
import encryptor, { RandomString } from "../Utils/Encryptor";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import {
  ValidateAuthorization,
  RequiresRole,
} from "../Utils/dataContextValidations";
import { GameResultType } from "../Enums/GameStatus";
import { GetMatchHistoryData } from "../Utils/dataContextHelpers";
import { Globals, MaintenanceMode } from "../globals";
import { AccountPrivileges } from "../Enums/AccountPrivileges";
import { LinkCodeStatus, LinkCodeType } from "../Enums/LinkCode";
import {
  BuildActivateAccount,
  BuildPasswordReset,
  BuildUpdateAccount,
  EmailTemplateAccountReplaceKeysInterface,
  EmailTemplateActivateAccountReplaceKeysInterface,
  EmailTemplatePasswordResetRequestReplaceKeysInterface,
  EmailTemplateTypes,
} from "../Classes/EmailManager";
import CoinTransactions from "../Classes/CoinTransactions";

export default (
  app: any,
  emailManager: any,
  baseAppSettings: any,
  dataContext: any
) => {
  app.post("/account/login", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { Email, Password } = req.body;

    if (!Email || !Password) return res.status(statusCode.BadRequest).send();

    // Searches account with the email send in database
    const account = await dataContext.Accounts.findOne({ where: { Email } });

    // If email/username was not found in database, returns NotFound
    if (!account) return res.status(statusCode.NotFound).send();

    if (account.IsBanned)
      return res.status(statusCode.Unauthorized).send("blocked");
    else if (!account.IsVerified)
      return res.status(statusCode.Unauthorized).send("not verified");

    if (account.FailedPasswordAttempts >= 5)
      return res.status(statusCode.Locked).send({
        FailedAttempts: account.FailedPasswordAttempts,
      });

    // Check is encrypted (Rfc2898DeriveBytes) password matches
    encryptor.IsValid(
      Password,
      account.SaltPassword,
      async (valid: boolean) => {
        // If passwords did not match, returns Unauthorized
        if (!valid) {
          account.update({
            FailedPasswordAttempts: account.FailedPasswordAttempts + 1,
          });
          return res.status(statusCode.Unauthorized).send();
        }

        // Generate token for the client
        var token = encryptor.RandomString(128, { symbols: false });

        const saltToken = encryptor.Encrypt(token);

        // Encrypts the token to save in database
        // encryptor.Generate(token, async (saltToken) => {

        var nowDate = new Date();

        // Save session to database

        await dataContext.Sessions.create({
          SaltSessionToken: token,
          AccountId: account.Id,
          CreationDate: nowDate.getTime(),
          Expires: new Date(
            nowDate.setFullYear(nowDate.getFullYear() + 1)
          ).getTime(),
        });

        return res.status(statusCode.OK).send(saltToken);
        // });
      }
    );
  });

  app.post("/account/create", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const {
      Email,
      Fullname,
      Username,
      Type,
      CountryId,
      Password,
      CoinBalance,
      WalletAddress,
    } = req.body;

    if (!Type || (Type < 1 && Type > 6) || !Email || !Username || !Password)
      return res.status(statusCode.BadRequest).send();

    // Searches account with sent email in database
    const account = await dataContext.Accounts.findOne({
      where: { [Op.or]: [{ Email }, { Username }] },
    });

    // If email already exists in database, returns Confliect (email is unique)
    if (account)
      return res
        .status(statusCode.Conflict)
        .send(account.Email == Email ? "1" : "2");

    // Encrypts password to save in database (Rfc2898DeriveBytes)
    encryptor.Generate(Password, async (saltPassword: string) => {
      // Save account to database
      const account = await dataContext.Accounts.create({
        Email,
        Fullname,
        Username,
        Type,
        CountryId,
        SaltPassword: saltPassword,
        Privileges: AccountPrivileges.All,
        CreationDate: new Date().getTime(),
        // IsVerified: true,
        CoinBalance,
        WalletAddress,
      });

      const code = RandomString(32, { symbols: false });

      await dataContext.LinkCodes.create({
        Identifier: code,
        Type: LinkCodeType.Verification,
        Status: LinkCodeStatus.Default,
        AccountId: account.Id,
        Date: new Date().getTime(),
      });

      const keys = BuildActivateAccount(account, code);

      emailManager.SendEmailByType(Email, EmailTemplateTypes.SignUp, keys);

      return res.status(statusCode.Created).send();
    });
  });

  app.get("/account/summary", async (req: any, res: any) => {
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
          where: { Id: accountId },
        });

        const today = new Date();
        const treasureHuntGamesToday = await dataContext.TreasureHuntings.count(
          {
            where: {
              AccountId: account.Id,
              GameStartDate: {
                [Op.gt]: new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                  0,
                  0,
                  0,
                  0
                ).getTime(),
                [Op.lt]: new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                  23,
                  59,
                  59,
                  999
                ).getTime(),
              },
            },
          }
        );

        let settings;
        try {
          settings = JSON.parse(account.Settings);
        } catch (error) {
          settings = {};
        }

        const HighestAIGameLevelWon =
          (await dataContext.AIGameHistories.findOne({
            where: {
              AccountId: accountId,
              Result: GameResultType.Win,
            },
            order: [["Level", "desc"]],
          }))?.Level || 2;

        const sumPendingCoin = await CoinTransactions.SumPendingCoinAmount(account.Id)
        

        return res.status(statusCode.OK).send({
          Id: account.Id,
          Username: account.Username,
          Email: account.Email,
          ClassicalElo: account.ClassicalElo,
          BlitzElo: account.BlitzElo,
          BulletElo: account.BulletElo,
          RapidElo: account.RapidElo,
          IsBanned: account.IsBanned,
          Privileges: account.Privileges,
          TreasureGamesPlayedToday: treasureHuntGamesToday,
          Avatar: account.Avatar,
          Settings: settings || {},
          HighestAIGameLevelWon,
          WalletAddress: account.WalletAddress,
          CoinBalance: account.CoinBalance,
          SumPendingCoin: sumPendingCoin
        });
      }
    );
  });

  app.get("/account/gameHistory", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { authorization } = req.headers;
    let { skip, top, beginDate, endDate } = req.query;

    if (!endDate) endDate = new Date().getTime();
    if (!beginDate) {
      beginDate = endDate;
      beginDate.setDate(endDate.getDate() - 7);
      beginDate = beginDate.getTime();
    }

    if (!top || !/[\d]+/.test(top)) top = 25;
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

        const where: any = {
          AccountId: accountId,
          GameEndDate: {
            [Op.gte]: beginDate,
            [Op.lte]: endDate,
          },
        };

        const histories = await dataContext.GameHistories.findAll({
          include: [
            {
              model: dataContext.Accounts,
              as: "Account",
            },
            {
              model: dataContext.Accounts,
              as: "Opponent",
            },
            {
              model: dataContext.Guests,
              as: "Guest",
            },
            {
              model: dataContext.Guests,
              as: "OpponentGuest",
            },
          ],
          limit: top,
          offset: skip,
          order: [["Id", "desc"]],
          where: where,
        });

        const results = histories.map((e: any) => GetMatchHistoryData(e));
        const count = await dataContext.GameHistories.count({where});

        return res.status(statusCode.OK).send({
            results,
            count
        });
      }
    );
  });

  app.get("/account/find", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { query } = req.query;
    let { startingAfter, top } = req.query;
    const { authorization } = req.headers;

    if (startingAfter && !/[\d]+/.test(startingAfter))
      return res
        .status(statusCode.BadRequest)
        .send("StartingAfter must be an integer");
    if (!top || !/[\d]+/.test(top)) top = 25;
    else top = parseInt(top);

    if (!query || query == "") return res.status(statusCode.BadRequest).send();

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
          Username: { [Op.like]: `%${query}%` },
          Id: {
            [Op.lt]: startingAfter,
            [Op.ne]: accountId,
          },
        };

        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.Accounts.findOne({
            where: { Id: startingAfter },
          }))
        )
          return res.status(statusCode.BadRequest).send();

        const accounts = await dataContext.Accounts.findAll({
          order: [["Id", "desc"]],
          limit: top,
          where,
        }).map((e: any) => {
          return {
            Id: e.Id,
            Fullname: e.Fullname,
            Username: e.Username,
          };
        });

        return res.status(statusCode.OK).send(accounts);
      }
    );
  });

  app.post("/account/forgotPassword", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { Email } = req.body;

    const account = await dataContext.Accounts.findOne({ where: { Email } });

    const code = RandomString(32, { symbols: false });

    await dataContext.LinkCodes.create({
      Identifier: code,
      Type: LinkCodeType.PasswordReset,
      Status: LinkCodeStatus.Default,
      AccountId: account.Id,
      Date: new Date().getTime(),
    });

    const keys = BuildPasswordReset(account, code);

    const sent = emailManager.SendEmailByType(
      Email,
      EmailTemplateTypes.PasswordResetRequest,
      keys
    );

    if (!sent) return res.status(statusCode.InternalServerError).send();

    return res.status(statusCode.OK).send();
  });

  app.post("/account/passwordReset", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { Code, Password } = req.body;

    const linkCode = await dataContext.LinkCodes.findOne({
      include: [
        {
          model: dataContext.Accounts,
          as: "Account",
        },
      ],
      where: {
        Identifier: Code,
        Type: LinkCodeType.PasswordReset,
      },
    });

    if (!linkCode) return res.status(statusCode.NotFound).send();

    if (linkCode.Status == LinkCodeStatus.Accepted)
      return res
        .status(statusCode.BadRequest)
        .send("This link has already been used.");

    // Encrypts password to save in database (Rfc2898DeriveBytes)
    encryptor.Generate(Password, async (saltPassword: string) => {
      linkCode.update({
        Status: LinkCodeStatus.Accepted,
      });

      linkCode.Account.update({
        SaltPassword: saltPassword,
      });

      return res.status(statusCode.OK).send();
    });
  });

  app.post("/account/verificationResend", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { Email } = req.body;

    const account = await dataContext.Accounts.findOne({ where: { Email } });

    if (!account) return res.status(statusCode.NotFound).send();

    if (account.IsVerified)
      return res
        .status(statusCode.BadRequest)
        .send("Your account is already verified.");

    const code = RandomString(32, { symbols: false });

    await dataContext.LinkCodes.create({
      Identifier: code,
      Type: LinkCodeType.Verification,
      Status: LinkCodeStatus.Default,
      AccountId: account.Id,
      Date: new Date().getTime(),
    });

    const keys = BuildActivateAccount(account, code);

    const sent = await emailManager.SendEmailByType(
      Email,
      EmailTemplateTypes.ActivateAccount,
      keys
    );

    if (!sent) return res.status(statusCode.InternalServerError).send();

    return res.status(statusCode.OK).send();
  });

  app.post("/account/verificationAccept", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { Code } = req.body;

    const linkCode = await dataContext.LinkCodes.findOne({
      include: [
        {
          model: dataContext.Accounts,
          as: "Account",
        },
      ],
      where: {
        Identifier: Code,
        Type: LinkCodeType.Verification,
      },
    });

    if (!linkCode) return res.status(statusCode.NotFound).send();

    if (linkCode.Account.IsVerified)
      return res
        .status(statusCode.BadRequest)
        .send("Your account is already verified.");

    linkCode.Account.update({
      IsVerified: true,
    });

    linkCode.update({
      Status: LinkCodeStatus.Accepted,
    });

    return res.status(statusCode.OK).send();
  });

  app.post("/account/update", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { authorization } = req.headers;
    const { Fullname, Type, CountryId, WalletAddress, Avatar, Settings } =
      req.body;

    const toUpdate: any = {};

    if (Fullname) toUpdate.Fullname = Fullname;
    if (Type) toUpdate.Type = Type;
    if (CountryId) toUpdate.CountryId = CountryId;
    if (WalletAddress) toUpdate.WalletAddress = WalletAddress;
    if (Avatar) toUpdate.Avatar = Avatar;
    if (Settings) toUpdate.Settings = JSON.stringify(Settings);

    if (!Object.keys(toUpdate).length) return res.status(statusCode.OK).send();

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
          where: { Id: accountId },
        });

        await account.update(toUpdate);

        if (toUpdate.WalletAddress) {
          const keys = BuildUpdateAccount(account);

          emailManager.SendEmailByType(
            account.Email,
            EmailTemplateTypes.UpdateAccount,
            keys
          );
        }

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.get("/account/statistics", async (req: any, res: any) => {
    if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline)
      return res.status(statusCode.ServiceUnavailable).send();

    const { authorization } = req.headers;
    let { beginDate, endDate } = req.query;

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

        const whereDate: any = {
          GameEndDate: {
            [Op.gte]: beginDate,
            [Op.lte]: endDate,
          },
        };

        if (!beginDate || !endDate) {
          delete whereDate.GameEndDate;
        }

        const wonGames = await dataContext.GameHistories.count({
          where: {
            ...whereDate,
            AccountId: accountId,
            Result: GameResultType.Win,
          },
        });

        const drawGames = await dataContext.GameHistories.count({
          where: {
            ...whereDate,
            AccountId: accountId,
            Result: GameResultType.Draw,
          },
        });

        const lostGames = await dataContext.GameHistories.count({
          where: {
            ...whereDate,
            AccountId: accountId,
            Result: GameResultType.Lose,
          },
        });

        const treasuresFoundRow = await dataContext.TreasureHuntings.findOne({
          attributes: [
            "AccountId",
            [fn("sum", col("TreasuresFound")), "treasuresFound"],
            [fn("count", col("Id")), "treasureGames"],
          ],
          group: ["AccountId"],
          where: {
            // TreasuresFound: {
            //     [Op.gt]: 0
            // },
            ...whereDate,
            AccountId: accountId,
          },
        });

        return res.status(statusCode.OK).send({
          WonGames: wonGames,
          DrawGames: drawGames,
          LostGames: lostGames,
          TreasuresFound: treasuresFoundRow?.dataValues.treasuresFound || 0,
          TreasureGames: treasuresFoundRow?.dataValues.treasureGames || 0,
        });
      }
    );
  });
};
