import { Op } from "sequelize";
import { StatusCode as statusCode } from "../Enums/StatusCode";
import { Globals, MaintenanceMode } from "../globals";

export default (app: any, baseAppSettings: any, dataContext: any) => {
    app.get('/countries', async (req: any, res: any) => {

        if (baseAppSettings.MaintenanceMode == MaintenanceMode.Offline) return res.status(statusCode.ServiceUnavailable).send();
        
        const { query } = req.query;

        // Searches countries in database
        const countries = await dataContext.Countries.findAll({where: query && {Name: { [Op.like]: `%${query}%`}}});

        return res.status(statusCode.OK).send(countries);

    });
}