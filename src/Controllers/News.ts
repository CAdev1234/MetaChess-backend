import { Op } from "sequelize";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { Globals, MaintenanceMode } from "../globals";

export default (app: any, baseAppSettings: any, dataContext: any) => {

    app.get('/news', async (req: any, res: any) => {
        
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();

        let { top, skip } = req.query;

        if (!top || !/[\d]+/.test(top)) top = 25;
        else top = parseInt(top);

        if (!skip || !/[\d]+/.test(skip)) skip = 0;
        else skip = parseInt(skip);

            
        const where: any = {
            IsDeleted: false,
            [Op.or]: [
                {
                    IsDraft: false
                },
                {
                    IsDraft: true,
                    ScheduleDate: {
                        [Op.lt]: new Date().getTime()
                    }
                }
            ]
        };
        
        const news = await dataContext.News.findAll({order: [['PostDate', 'desc']],
            include: {
                model: dataContext.NewTags,
                include: dataContext.Tags
            },
            limit: top,
            offset: skip,
            where
        }).map(async (e: any) => {
            return {
                Id: e.Id,
                Title: e.Title,
                SmallDescription: e.SmallDescription,
                Views: e.Views,
                PostDate: e.PostDate,
                Tags: e.NewTags.map((t: any) => t.Tag.Text)
            }
        });

        delete where.Id;
        const newsCount = await dataContext.News.count({ where });

        return res.status(statusCode.OK).send({
            count: newsCount,
            results: news
        });

    });

    app.get('/news/:newId([\\d]+)', async (req: any, res: any) => {
        
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
        const { newId } = req.params;
        
        const newObj = await dataContext.News.findOne({
            include: {
                model: dataContext.NewTags,
                include: dataContext.Tags
            },
            where: {
                Id: newId,
                IsDeleted: false,
                [Op.or]: [
                    {
                        IsDraft: false
                    },
                    {
                        IsDraft: true,
                        ScheduleDate: {
                            [Op.gt]: new Date().getTime()
                        }
                    }
                ],
            }
        });

        if (!newObj) return res.status(statusCode.NotFound).send();

        return res.status(statusCode.OK).send({
            Id: newObj.Id,
            Title: newObj.Title,
            Content: newObj.Content,
            Views: newObj.Views,
            PostDate: newObj.PostDate,
            Tags: newObj.NewTags.map((t: any) => t.Tag.Text)
        });

    });

    app.post('/news/:newId([\\d]+)/view', async (req: any, res: any) => {
        
        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
        const { newId } = req.params;
        
        const news = await dataContext.News.findOne({where: {Id: newId, IsDeleted: false, IsDraft: false}});

        if (!news) return res.status(statusCode.NotFound).send();

        news.update({
            Views: news.Views + 1
        });

        return res.status(statusCode.OK).send();

    });

}