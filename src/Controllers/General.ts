import { StatusCode as statusCode } from "../Enums/StatusCode";
import { Globals } from "../globals";

export default (app: any, baseAppSettings: any, dataContext: any) => {

    app.get('/serverstatus', async (req: any, res: any) => {

        return res.status(statusCode.OK).send(
            {...baseAppSettings, Status: 0}
        );

    });

}