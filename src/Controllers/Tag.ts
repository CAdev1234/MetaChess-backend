import { Op } from "sequelize";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { AccountRole as accountRole } from "../Enums/AccountRole";
import {ValidateAuthorization, RequiresRole} from "../Utils/dataContextValidations";
import { Globals, MaintenanceMode } from "../globals";

export default (app: any, baseAppSettings: any, dataContext: any) => {


    app.get('/tags/recent', async (req: any, res: any) => {
        
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
        const { query } = req.query;

        const { authorization } = req.headers;

        await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, responseMessage: string, accountId: number) => {
            
            if (errorStatusCode) return res.status(errorStatusCode).send(responseMessage);

            const hasRequiredRole = await RequiresRole(accountId, [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner], dataContext);
            
            if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

                        
            const tags = await dataContext.Tags.findAll({order: [['LastUsedDate', 'desc']],
                limit: 10
            }).map((e: any) => e.Text);

            return res.status(statusCode.OK).send(tags);

        });

    });



    // app.get('/tags', async (req: any, res: any) => {
        
    //     if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
    //     const { query } = req.query;

    //     let { startingAfter, top } = req.query;
    //     const { authorization } = req.headers;

    //     if (startingAfter && !/[\d]+/.test(startingAfter)) return res.status(statusCode.BadRequest).send("StartingAfter must be an integer");
    //     if (!top || !/[\d]+/.test(top)) top = 25;
    //     else top = parseInt(top);

    //     await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, accountId: number) => {
            
    //         if (errorStatusCode) return res.status(errorStatusCode).send();

    //         const hasRequiredRole = await RequiresRole(accountId, [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner], dataContext);
            
    //         if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

    //         const where = {
    //             IsDeleted: false,
    //             Id: {
    //                 [Op.lt]: startingAfter
    //             }
    //         };

    //         if (!startingAfter) delete where.Id;
    //         else if (!await dataContext.Tags.findOne({where: {Id: startingAfter}})) return res.status(statusCode.BadRequest).send();

            
    //         const tags = await dataContext.Tags.findAll({order: [['Id', 'desc']],
    //             limit: top,
    //             where
    //         }).map(async (e: any) => {
    //             return {
    //                 Id: e.Id,
    //                 Text: e.Text,
    //                 Color: e.Color,
    //                 NewsCount: await dataContext.NewTags.count({where: {
    //                     TagId: e.Id
    //                 }})
    //             }
    //         });

    //         return res.status(statusCode.OK).send(tags);

    //     });

    // });

    // app.post('/tags', async (req: any, res: any) => {
        
    //     if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
    //     const { Text, Color } = req.body;
    //     const { authorization } = req.headers;
        
    //     await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, accountId: number) => {
            
    //         if (errorStatusCode) return res.status(errorStatusCode).send();

    //         const hasRequiredRole = await RequiresRole(accountId, [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner], dataContext);
            
    //         if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

    //         await dataContext.Tags.create({
    //             Text: Text,
    //             Color: Color
    //         });
            
    //         return res.status(statusCode.Created).send();

    //     });

    // });

    // app.post('/tags/:tagId([\\d]+)', async (req: any, res: any) => {
        
    //     if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
    //     const { tagId } = req.params;
    //     const { Text, Color } = req.body;
    //     const { authorization } = req.headers;
        
    //     await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, accountId: number) => {
            
    //         if (errorStatusCode) return res.status(errorStatusCode).send();

    //         const hasRequiredRole = await RequiresRole(accountId, [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner], dataContext);
            
    //         if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

    //         const tag = await dataContext.Tags.findOne({where: {
    //             Id: tagId,
    //             IsDeleted: false
    //         }});
            
    //         if (!tag) return res.status(statusCode.NotFound).send();

    //         tag.update({
    //             Text: Text,
    //             Color: Color
    //         });
            
    //         return res.status(statusCode.OK).send();

    //     });

    // });

    // app.delete('/tags/:tagId([\\d]+)', async (req: any, res: any) => {
        
    //     if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
    //     const { tagId } = req.params;
    //     const { authorization } = req.headers;
        
    //     await ValidateAuthorization(authorization, dataContext, async (errorStatusCode: statusCode, accountId: number) => {
            
    //         if (errorStatusCode) return res.status(errorStatusCode).send();

    //         const hasRequiredRole = await RequiresRole(accountId, [accountRole.Admin, accountRole.SuperAdmin, accountRole.Owner], dataContext);
            
    //         if (!hasRequiredRole) return res.status(statusCode.Forbidden).send();

    //         const tag = await dataContext.Tags.findOne({where: {
    //             Id: tagId,
    //             IsDeleted: false
    //         }});

    //         if (!tag) return res.status(statusCode.NotFound).send();

    //         tag.update({
    //             IsDeleted: true,
    //         });
            
    //         return res.status(statusCode.OK).send();

    //     });

    // });
}