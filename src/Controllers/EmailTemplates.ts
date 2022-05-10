import { StatusCode as statusCode } from "../Enums/StatusCode";
import { AccountRole as accountRole } from "../Enums/AccountRole";
import {
  ValidateAuthorization,
  RequiresRole
} from "../Utils/dataContextValidations";
import { Op } from "sequelize";
import { CheckEnumIsValid } from "../Utils/Helpers";
import { BuildActivateAccount, BuildPasswordReset, BuildUpdateAccount, EmailTemplateKeys, EmailTemplateTypes } from "../Classes/EmailManager";

export default (app: any, emailManager: any, dataContext: any) => {

  app.get('/emailTemplates', async (req: any, res: any) => {

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
          Subject: {
            [Op.like]: search
          },
          Id: {
            [Op.lt]: startingAfter,
          },
        };

        if (!search) delete where.Subject;
        if (!startingAfter) delete where.Id;
        else if (
          !(await dataContext.EmailTemplates.findOne({ where: { Id: startingAfter } }))
        )
          return res.status(statusCode.BadRequest).send();

        const emailTemplates = await dataContext.EmailTemplates.findAll({
          attributes: {exclude: ['TemplateData']},
          order: [["Id", "desc"]],
          limit: top,
          where,
        }).map(async (e: any) => {
          return {
            Id: e.Id,
            Subject: e.Subject,
            IsActive: e.IsActive,
            Type: e.Type,
            Body: e.Body,
            CreationDate: new Date(e.CreationDate)
          };
        });

        return res.status(statusCode.OK).send(emailTemplates);
      }
    );

  });
  
  app.get('/emailTemplates/:emailTemplateId([\\d]+)', async (req: any, res: any) => {

    const { emailTemplateId } = req.params;
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

        const emailTemplate = await dataContext.EmailTemplates.findOne({
          where: { Id: emailTemplateId },
        });

        return res.status(statusCode.OK).send({
          Id: emailTemplate.Id,
          Subject: emailTemplate.Subject,
          Body: emailTemplate.Body,
          IsActive: emailTemplate.IsActive,
          Type: emailTemplate.Type,
          CreationDate: emailTemplate.CreationDate,
          TemplateData: !emailTemplate.TemplateData ? {} : JSON.parse(emailTemplate.TemplateData)
        });
      }
    );

  });

  app.post("/emailTemplates", async (req: any, res: any) => {

    const {
      Subject,
      Body,
      Type,
      TemplateData
    } = req.body;

    const { authorization } = req.headers;
    
    if (!Subject || !Body || !TemplateData || !Type || !CheckEnumIsValid(EmailTemplateTypes, Type)) return res.status(statusCode.BadRequest).send();

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

        await dataContext.EmailTemplates.create({
          Subject,
          Body,
          Type,
          TemplateData: JSON.stringify(TemplateData),
          CreationDate: new Date().getTime()
        });

        return res.status(statusCode.Created).send();
      }
    );
  });

  app.post("/emailTemplates/duplicate", async (req: any, res: any) => {

    const {
      Subject,
      Type,
      EmailTemplateId
    } = req.body;

    const { authorization } = req.headers;
    
    if (!Subject || !Type || !CheckEnumIsValid(EmailTemplateTypes, Type)) return res.status(statusCode.BadRequest).send();

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

        const emailTemplate = await dataContext.EmailTemplates.findOne({
          where: {
            Id: EmailTemplateId
          }
        });

        if (!emailTemplate) return res.status(statusCode.NotFound).send();

        await dataContext.EmailTemplates.create({
          Subject,
          Body: emailTemplate.Body,
          Type,
          TemplateData: emailTemplate.TemplateData,
          CreationDate: new Date().getTime()
        });

        return res.status(statusCode.Created).send();
      }
    );
  });

  app.post("/emailTemplates/:emailTemplateId([\\d]+)", async (req: any, res: any) => {
    const { emailTemplateId } = req.params;
    const {
      Subject,
      Body,
      Type,
      TemplateData
    } = req.body;
    const { authorization } = req.headers;
    
    if (!Subject || !Body || !TemplateData || !Type || !CheckEnumIsValid(EmailTemplateTypes, Type)) return res.status(statusCode.BadRequest).send();

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

        const emailTemplate = await dataContext.EmailTemplates.findOne({
          attributes: {exclude: ['Body', 'TemplateData']},
          where: { Id: emailTemplateId },
        });

        if (!emailTemplate) return res.status(statusCode.NotFound).send();

        emailTemplate.update({
          Subject,
          Body,
          TemplateData: JSON.stringify(TemplateData),
          Type
        });

        return res.status(statusCode.OK).send();
      }
    );
  });

  app.post("/emailTemplates/:emailTemplateId([\\d]+)/setActive", async (req: any, res: any) => {
    
    const { emailTemplateId } = req.params;
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

        const emailTemplate = await dataContext.EmailTemplates.findOne({
          attributes: {exclude: ['Body', 'TemplateData']},
          where: { Id: emailTemplateId },
        });

        if (!emailTemplate) return res.status(statusCode.NotFound).send();

        if (emailTemplate.IsActive) return res.status(statusCode.OK).send();

        const activeEmailTemplate = await dataContext.EmailTemplates.findOne({
          attributes: {exclude: ['Body', 'TemplateData']},
          where: { Type: emailTemplate.Type, IsActive: true },
        });

        if (activeEmailTemplate) {
          activeEmailTemplate.update({
            IsActive: false
          });
        }

        emailTemplate.update({
          IsActive: true
        });

        return res.status(statusCode.OK).send();
      }
    );
  }); 

  app.get("/emailTemplates/keys/:emailTemplateType([\\d]+)", async (req: any, res: any) => {

    const { emailTemplateType } = req.params;
    const { authorization } = req.headers;
    
    if (!emailTemplateType || !CheckEnumIsValid(EmailTemplateTypes, emailTemplateType)) return res.status(statusCode.BadRequest).send();

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

        return res.status(statusCode.OK).send(EmailTemplateKeys[emailTemplateType]);
      }
    );
  });  

  app.post("/emailTemplates/testEmail", async (req: any, res: any) => {
    
    const {
      Subject,
      Body,
      Type,
      Email
    } = req.body;
    const { authorization } = req.headers;
    
    if (!Subject || !Body || !Type || !CheckEnumIsValid(EmailTemplateTypes, Type)) return res.status(statusCode.BadRequest).send();

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

        const account = await dataContext.Accounts.findOne({
          where: {
            Id: accountId
          }
        });

        let keys: any;

        switch (Type) {
          case EmailTemplateTypes.ActivateAccount:
          case EmailTemplateTypes.SignUp:
            keys = BuildActivateAccount(account, 'example-code');
            break;          
          case EmailTemplateTypes.PasswordResetRequest:
            keys = BuildPasswordReset(account, 'example-code');
            break;          
          case EmailTemplateTypes.UpdateAccount:
            keys = BuildUpdateAccount(account);
            break;
          default:
            break;
        }
        
        let subject = Subject;
        let body = Body;

        if (keys) {
            Object.keys(keys).forEach(key => {
                subject = subject.replace(new RegExp(`{${key}}`, 'g'), keys[key]);
                body = body.replace(new RegExp(`{${key}}`, 'g'), keys[key]);
            });
        }

        emailManager.SendEmail(Email || account.Email, subject, body);

        return res.status(statusCode.OK).send();
      }
    );
  });

};
