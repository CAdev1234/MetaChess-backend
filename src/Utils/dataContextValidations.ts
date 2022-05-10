import { StatusCode as statusCode } from "../Enums/StatusCode";
import { AccountRole } from "../Enums/AccountRole";
var encryptor = require("../Utils/Encryptor");

export async function ValidateAuthorization(
  authorization: string,
  dataContext: any,
  callBack: Function
) {
  try {
    if (!authorization) return callBack(statusCode.Unauthorized);
    
    const saltToken = encryptor.Decrypt(authorization);

    // encryptor.Generate(authorization, async (saltToken) => {
    const session = await dataContext.Sessions.findOne({
      where: { SaltSessionToken: saltToken },
    });

    if (!session) return callBack(statusCode.Unauthorized);

    if (session) {
      const account = await dataContext.Accounts.findOne({
        where: { Id: session.AccountId },
      });

      if (account.IsBanned) return callBack(statusCode.Unauthorized, 'blocked');
      else if (session.Expires < new Date().getTime()) return callBack(statusCode.Unauthorized, 'session expired');
      else if (!account.IsVerified) return callBack(statusCode.Unauthorized, 'not verified');
    }

    return callBack(null, null, session.AccountId);

  } catch (error) {
      return callBack(statusCode.Unauthorized);
  }
  // });
}

export async function RequiresRole(
  accountId: number,
  roles: Array<AccountRole>,
  dataContext: any
) {
  const account = await dataContext.Accounts.findOne({
    where: { Id: accountId },
  });

  return roles.indexOf(account.Role) != -1;
}

export async function RequiresRoleAcc(
  account: any,
  roles: Array<AccountRole>
) {
  return roles.indexOf(account.Role) != -1;
}

export default {
  ValidateAuthorization,
  RequiresRole,
};
