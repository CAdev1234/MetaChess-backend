"use strict";

var express = require("express");
require('express-async-errors');
var cors = require("cors");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const helmet = require("helmet");
require("dotenv").config()



import { RoomManager } from "./Classes/RoomManager";
import { EmailManager } from "./Classes/EmailManager";

import GeneralController from "./Controllers/General";
import AccountController from "./Controllers/Account";
import CountryController from "./Controllers/Country";
import MessageController from "./Controllers/Message";
import FriendController from "./Controllers/Friend";
import TagController from "./Controllers/Tag";
import NewsController from "./Controllers/News";
import BackofficeController from "./Controllers/Backoffice";
import EmailTemplatesController from "./Controllers/EmailTemplates";
import AIGameController from "./Controllers/AIGame";
import PuzzleGameController from "./Controllers/Puzzle";
import NetworkHandler from "./NetworkHandler";
import CoinTransactionController from "./Controllers/CoinTransaction";

import dataContext from "./Models/DatabaseModels";
import { StatusCode } from "./Enums/StatusCode";
import { LogType } from "./Enums/LogType";
import { LogCategory } from "./Enums/LogCategory";
import { QuickPlayManager } from "./Classes/QuickPlayManager";
import Leaderboard from "./Controllers/Leaderboard";
import { TreasureHuntManager } from "./Classes/TreasureHuntManager";
import { initContractEventListener } from "./ContractEventHandler";

var io = require("socket.io")(process.env.PORT || 44307);
io.eio.pingTimeout = 600000; // 2 minutes
io.eio.pingInterval = 5000;  // 5 seconds


var app = express();

app.use(helmet());
//set cors
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json({limit: "5mb"}));
app.use(cookieParser());
var http = require("http").Server(app);
// var SocketEvents = require("./SocketEvents.js");
// Custom Classes
// var Player = require('./Classes/Player.js');            // Player class
// var Piece = require('./Classes/Piece.js');              // Piece Class
// SocketEvents = new Events();
var players = {};
var playersIds = {};
var aiGames = {};
const userAiGames = {};
var puzzleGames = {};
const userPuzzleGames = {};
var spectators = {};
var roomManager = new RoomManager();
var quickPlayManager = new QuickPlayManager(roomManager, players, dataContext);
var treasureHuntManager = new TreasureHuntManager();
var baseAppSettings : any = {};
var emailManager = new EmailManager(dataContext);

(async () => {

  const appSettings = await dataContext.BaseAppSettings.findOne();

  baseAppSettings.MaintenanceMode = appSettings.MaintenanceMode;
  baseAppSettings.MaintenanceTime = appSettings.MaintenanceTime;
  baseAppSettings.MaintenanceDuration = appSettings.MaintenanceDuration;
  baseAppSettings.Level1TreasureValue = appSettings.Level1TreasureValue;
  baseAppSettings.Level2TreasureValue = appSettings.Level2TreasureValue;
  baseAppSettings.Level3TreasureValue = appSettings.Level3TreasureValue;
  baseAppSettings.TreasureQuestAttempts = appSettings.TreasureQuestAttempts;
  baseAppSettings.TreasureQuestGamesPerDay = appSettings.TreasureQuestGamesPerDay;
  baseAppSettings.BoardOddSquaresColor = appSettings.BoardOddSquaresColor;
  baseAppSettings.BoardEvenSquaresColor = appSettings.BoardEvenSquaresColor;
  baseAppSettings.BoardLastPlaySquaresColor = appSettings.BoardLastPlaySquaresColor;
  baseAppSettings.BoardPossibleMovesColor = appSettings.BoardPossibleMovesColor;
  baseAppSettings.BoardPossibleCapturesColor = appSettings.BoardPossibleCapturesColor;
  baseAppSettings.BoardCheckSquaresColor = appSettings.BoardCheckSquaresColor;
  baseAppSettings.TreasureQuestSound = appSettings.TreasureQuestSound;
  
  GeneralController(app, baseAppSettings, dataContext);
  AccountController(app, emailManager, baseAppSettings, dataContext);
  CountryController(app, baseAppSettings, dataContext);
  MessageController(app, baseAppSettings, dataContext);
  FriendController(app, dataContext, players, playersIds, roomManager, treasureHuntManager, baseAppSettings, io);
  TagController(app, baseAppSettings, dataContext);
  NewsController(app, baseAppSettings, dataContext);
  BackofficeController(app, emailManager, baseAppSettings, playersIds, roomManager, treasureHuntManager, dataContext);
  EmailTemplatesController(app, emailManager, dataContext);
  Leaderboard(app, baseAppSettings, dataContext);
  AIGameController(app, aiGames, userAiGames, baseAppSettings, dataContext);
  PuzzleGameController(app, puzzleGames, userPuzzleGames, baseAppSettings, dataContext);
  NetworkHandler(dataContext, players, playersIds, aiGames, userAiGames, puzzleGames, userPuzzleGames, spectators, roomManager, quickPlayManager, treasureHuntManager, baseAppSettings, io);
  CoinTransactionController(app, baseAppSettings, dataContext);
})();
  
app.use(function (err: any, req: any, res: any, next: any) {
  dataContext.Logs.create({
    Message: JSON.stringify(err.stack),
    Type: LogType.Error,
    Category: LogCategory.Controller,
    Date: new Date().getTime(),
  });

  return res.status(StatusCode.InternalServerError).send();
});

initContractEventListener(io)

http.listen(44308, () => {
  console.log("listening on *:44308");
});

