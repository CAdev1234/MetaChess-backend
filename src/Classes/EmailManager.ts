import { LogCategory } from "../Enums/LogCategory";
import { LogType } from "../Enums/LogType";

const nodemailer = require("nodemailer");

export enum EmailTemplateTypes {
    SignUp = 1,
    PasswordResetRequest,
    ActivateAccount,
    UpdateAccount
}

// Classes

class EmailTemplateAccountReplaceKeysClass {
    Fullname = "";
    Username = "";
    Email = "";
    ClassicalElo = 0;
    BlitzElo = 0;
    RapidElo = 0;
    BulletElo = 0;
    WalletAddress = "";
}

class EmailTemplatePasswordResetRequestReplaceKeysClass extends EmailTemplateAccountReplaceKeysClass {
    PasswordResetCode = "";
}

class EmailTemplateActivateAccountReplaceKeysClass extends EmailTemplateAccountReplaceKeysClass {
    ActivateAccountCode = "";
}

// Interfaces

export interface EmailTemplateAccountReplaceKeysInterface extends EmailTemplateAccountReplaceKeysClass {};

export interface EmailTemplatePasswordResetRequestReplaceKeysInterface extends EmailTemplatePasswordResetRequestReplaceKeysClass {}

export interface EmailTemplateActivateAccountReplaceKeysInterface extends EmailTemplateActivateAccountReplaceKeysClass {}


export const EmailTemplateKeys: any = {
    [EmailTemplateTypes.SignUp]: Object.keys(new EmailTemplateActivateAccountReplaceKeysClass()).map(e => `{${e}}`),
    [EmailTemplateTypes.PasswordResetRequest]: Object.keys(new EmailTemplatePasswordResetRequestReplaceKeysClass()).map(e => `{${e}}`),
    [EmailTemplateTypes.ActivateAccount]: Object.keys(new EmailTemplateActivateAccountReplaceKeysClass()).map(e => `{${e}}`),
    [EmailTemplateTypes.UpdateAccount]: Object.keys(new EmailTemplateAccountReplaceKeysClass()).map(e => `{${e}}`),
};

const resolveWalletAddress = (walletAddress: string) => !walletAddress || walletAddress.length < 10 ? (walletAddress || '') : `${walletAddress.substring(0, 5)}...${walletAddress.substring(walletAddress.length - 5, walletAddress.length)}`

export const BuildActivateAccount = (account: any, code: string): EmailTemplateActivateAccountReplaceKeysInterface => {
  return {
    Fullname: account.Fullname,
    Username: account.Username,
    Email: account.Email,
    ClassicalElo: account.ClassicalElo,
    BlitzElo: account.BlitzElo,
    RapidElo: account.RapidElo,
    BulletElo: account.BulletElo,
    WalletAddress: resolveWalletAddress(account.WalletAddress),
    ActivateAccountCode: code,
  };
}

export const BuildPasswordReset = (account: any, code: string): EmailTemplatePasswordResetRequestReplaceKeysInterface => {
  return {
    Fullname: account.Fullname,
    Username: account.Username,
    Email: account.Email,
    ClassicalElo: account.ClassicalElo,
    BlitzElo: account.BlitzElo,
    RapidElo: account.RapidElo,
    BulletElo: account.BulletElo,
    WalletAddress: resolveWalletAddress(account.WalletAddress),
    PasswordResetCode: code,
  };
}

export const BuildUpdateAccount = (account: any): EmailTemplateAccountReplaceKeysInterface => {
  return {
    Fullname: account.Fullname,
    Username: account.Username,
    Email: account.Email,
    ClassicalElo: account.ClassicalElo,
    BlitzElo: account.BlitzElo,
    RapidElo: account.RapidElo,
    BulletElo: account.BulletElo,
    WalletAddress: resolveWalletAddress(account.WalletAddress),
  };
}



export class EmailManager {
  MailTransporter: any;
  DataContext: any

  constructor(dataContext: any) {
    this.DataContext = dataContext;
    this.MailTransporter = nodemailer.createTransport({
      host: "mail.privateemail.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: "noreply@metachess.network", // generated ethereal user
        pass: "WUCN7$dN9M9UPyg5942W!$4s%ntH35Cm", // generated ethereal password
      },
    });
  }

  async SendEmailByType(to: string, type: EmailTemplateTypes, replaceKeys?: any) {
    try {

        const emailTemplate = await this.DataContext.EmailTemplates.findOne({
            where: { Type: type, IsActive: true },
        });

        if (!emailTemplate) {
            throw 'Template not found.';
        }

        let subject = emailTemplate.Subject;
        let body = emailTemplate.Body;

        if (replaceKeys) {
            Object.keys(replaceKeys).forEach(key => {
                subject = subject.replace(new RegExp(`{${key}}`, 'g'), replaceKeys[key]);
                body = body.replace(new RegExp(`{${key}}`, 'g'), replaceKeys[key]);
            });
        }

        await this.MailTransporter.sendMail({
          from: '"Metachess" <noreply@metachess.network>',
          replyTo: '"Metachess" <contact@metachess.network>',
          to: to,
          subject: subject,
          html: body
        });

        return true;

    } catch (error) {
      this.DataContext.Logs.create({
        Message: `Could not send email of type "${type}" to ${to}. Error: ${JSON.stringify(error.stack)}`,
        Type: LogType.Error,
        Category: LogCategory.Email,
        Date: new Date().getTime(),
      });

      return false;
    }
  }

  async SendEmail(to: string, subject: string, html: string) {
    try {
        await this.MailTransporter.sendMail({
          from: '"Metachess" <noreply@metachess.network>',
          replyTo: '"Metachess" <contact@metachess.network>',
          to: to,
          subject: subject,
          html: html
        });
        return true;
    } catch (error) {
      this.DataContext.Logs.create({
        Message: `Could not send email "${subject}" to ${to}. Error: ${JSON.stringify(error.stack)}`,
        Type: LogType.Error,
        Category: LogCategory.Email,
        Date: new Date().getTime(),
      });
      return false;
    }
  }
}
