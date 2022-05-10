
import {Sequelize, DataTypes, Model} from 'sequelize';

// password: F!f34PPUA*cT8XdY28$pW7zvVF^5LNJS4!QRaww3Yu5TstpWD4wy7xy65jLSjtha
const sequelize = new Sequelize('brainiacchess', 'root', '', {
    dialect: 'mysql',
    // logging: false
})

class Account extends Model {
    public Username!: string 
    public Fullname!: string 
}

Account.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    IsBanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    Privileges: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    FailedPasswordAttempts: {
        type: DataTypes.SMALLINT,
        defaultValue: 0,
        allowNull: false
    },
    Fullname: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    Username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ClassicalEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    BlitzEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    RapidEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    BulletEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    ClassicalElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    BlitzElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    RapidElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    BulletElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    GuestId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Type: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    Role: {
        type: DataTypes.INTEGER,
    },
    CountryId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SaltPassword: {
        type: DataTypes.STRING,
        allowNull: false
    },
    CreationDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    IsVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    Avatar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    Settings: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    WalletAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    Balance: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
}, {
    tableName: "Account",
    sequelize,
    timestamps: false
});


class LinkCode extends Model {

}

LinkCode.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Identifier: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Type: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    Status: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    Date: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
}, {
    tableName: "LinkCode",
    sequelize,
    timestamps: false
});

class Guest extends Model {
    
}

Guest.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Identifier: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ClassicalEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    BlitzEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    RapidEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    BulletEloSubsequentlyOver2400: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    ClassicalElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    BlitzElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    RapidElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    BulletElo: {
        type: DataTypes.INTEGER,
        defaultValue: 1500,
        allowNull: false
    },
    CreationDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    MergeDate: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
}, {
    tableName: "Guest",
    sequelize,
    timestamps: false
});

class GameHistory extends Model {
    
}

GameHistory.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Identifier: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Result: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    GameMode: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    GameType: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    RoomType: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    GuestId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    OpponentId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    OpponentGuestId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    PieceSide: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    BoardMoves: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    DrawRequestHistory: {
        type: DataTypes.STRING,
        allowNull: false
    },
    EloEarned: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    ClassicalElo: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    BlitzElo: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    RapidElo: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    BulletElo: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TimeBase: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TimeIncrement: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ResultCondition: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    GameStartDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    GameEndDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
}, {
    tableName: "GameHistory",
    sequelize,
    timestamps: false
});


class Friend extends Model {
    
}

Friend.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    FriendId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    SentDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    IsAccepted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    IsRejected: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    ResponseDate: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    IsRemoved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
}, {
    tableName: "Friend",
    sequelize,
    timestamps: false
});

class Country extends Model {
    
}

Country.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Code: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: "Country",
    sequelize,
    timestamps: false
});

class New extends Model {
    
}

New.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Views: {
        type: DataTypes.BIGINT,
    },
    Title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    SmallDescription: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Content: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ScheduleDate: {
        type: DataTypes.BIGINT,
    },
    PostDate: {
        type: DataTypes.BIGINT,
    },
    IsDraft: {
        type: DataTypes.BOOLEAN
    },
    IsDeleted: {
        type: DataTypes.BOOLEAN
    },
}, {
    tableName: "New",
    sequelize,
    timestamps: false
});

class Tag extends Model {
    
}

Tag.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Text: {
        type: DataTypes.STRING,
        allowNull: false
    },
    LastUsedDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
    // Color: {
    //     type: DataTypes.STRING,
    //     allowNull: false
    // },
    // IsDeleted: {
    //     type: DataTypes.BOOLEAN
    // },
}, {
    tableName: "Tag",
    sequelize,
    timestamps: false
});

class NewTag extends Model {
    
}

NewTag.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    NewId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TagId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
}, {
    tableName: "NewTag",
    sequelize,
    timestamps: false
});


class Session extends Model {
    
}


Session.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    SaltSessionToken: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        // references: {
        //     model: Account,
        //     key: 'Id'
        // }
    },
    CreationDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    Expires: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
},
{
    tableName: "Session",
    sequelize,
    timestamps: false
});


class Log extends Model {
    
}


Log.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Message: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Type: {
        type: DataTypes.TINYINT,
        allowNull: false,
    },
    Category: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Date: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
},
{
    tableName: "Log",
    sequelize,
    timestamps: false
});


class Puzzle extends Model {
    
}


Puzzle.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    Data: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    CreationDate: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    BaseTime: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    IncrementTime: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    SurviveTurns: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Type: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    Status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
    },
    IsWhite: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
},
{
    tableName: "Puzzle",
    sequelize,
    timestamps: false
});


class Message extends Model {
    
}


Message.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TargetAccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    RoomIdentifier: {
        type: DataTypes.STRING,
        allowNull: true
    },
    IsRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0
    },
    Date: {
        type: DataTypes.BIGINT,
        allowNull: false
    }
},
{
    tableName: "Message",
    sequelize,
    timestamps: false
});


class TreasureHunting extends Model {
    
}

TreasureHunting.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TreasurePlaces: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    Attempts: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    GameStartDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    GameEndDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    TreasuresFound: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
    },
}, {
    tableName: "TreasureHunting",
    sequelize,
    timestamps: false
});

class BaseAppSettings extends Model {
    
}

BaseAppSettings.init({
    Id: {
        type: DataTypes.TINYINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    MaintenanceMode: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
    },
    MaintenanceTime: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    MaintenanceDuration: { // Minutes
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Level1TreasureValue: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    Level2TreasureValue: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    Level3TreasureValue: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    TreasureQuestAttempts: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    TreasureQuestGamesPerDay: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    BoardOddSquaresColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    BoardEvenSquaresColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    BoardLastPlaySquaresColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    BoardPossibleMovesColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    BoardPossibleCapturesColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    BoardCheckSquaresColor: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    TreasureQuestSound: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: "BaseAppSettings",
    sequelize,
    timestamps: false
});


class AIGameHistory extends Model {
    
}

AIGameHistory.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Level: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    GuestId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Result: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    PieceSide: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    BoardMoves: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    GameStartDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    GameEndDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
}, {
    tableName: "AIGameHistory",
    sequelize,
    timestamps: false
});




class PuzzleGameHistory extends Model {
    
}

PuzzleGameHistory.init({
    Id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    PuzzleId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    GuestId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    AccountId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    Result: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    BoardMoves: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    GameStartDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    GameEndDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
}, {
    tableName: "PuzzleGameHistory",
    sequelize,
    timestamps: false
});




class EmailTemplate extends Model {
    
}

EmailTemplate.init({
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    Subject: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    Body: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    Type: {
        type: DataTypes.TINYINT,
        allowNull: false
    },
    CreationDate: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    TemplateData: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: "EmailTemplate",
    sequelize,
    timestamps: false
});



Account.belongsToMany(Account, {
    as: 'Friends',
    foreignKey: 'AccountId',
    through: 'Friend'
});

Account.belongsToMany(Account, { 
    as: 'AccountFriends',
    foreignKey: 'FriendId',
    through: 'Friend'
});

// Account.belongsToMany(Account, { as: 'Friends', through: Friend });

// Friend.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});
// Friend.belongsTo(Account, {as: 'Friend', foreignKey: 'FriendId'});

// Account.hasMany(Friend, { as: 'Account', foreignKey: 'AccountId' });
// Account.hasMany(Friend, { as: 'Friend', foreignKey: 'FriendId' });

// Friend.belongsTo(Account, { as: 'Account', foreignKey: 'AccountId' });
// Friend.belongsTo(Account, { as: 'Friend', foreignKey: 'FriendId' });

Guest.hasOne(Account, {
    foreignKey: 'GuestId'
});

Account.hasOne(Log, {
    foreignKey: 'AccountId'
})

Session.belongsTo(Account, {
    foreignKey: 'AccountId'
});

Account.belongsTo(Country, {
    foreignKey: 'CountryId'
});

// Friend.hasOne(Account, {
//     foreignKey: 'AccountId',
//     targetKey: 'Id'
// });

// Friend.belongsTo(Account, {
//     foreignKey: 'AccountId'
// });

NewTag.belongsTo(New, {
    foreignKey: 'NewId'
});

NewTag.belongsTo(Tag, {
    foreignKey: 'TagId'
});

New.hasMany(NewTag);

Tag.hasMany(NewTag);

// Account.hasMany(Friend);

// Account.hasMany(GameHistory, {as: 'Account', foreignKey: 'AccountId'});
// Guest.hasMany(GameHistory, {as: 'Guest', foreignKey: 'GuestId'});

// Account.hasMany(AIGameHistory, {as: 'Account', foreignKey: 'AccountId'});
// Guest.hasMany(AIGameHistory, {as: 'Guest', foreignKey: 'GuestId'});

Account.hasMany(GameHistory, {as: 'Opponent', foreignKey: 'OpponentId'});
Guest.hasMany(GameHistory, {as: 'OpponentGuest', foreignKey: 'OpponentGuestId'});

AIGameHistory.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});
AIGameHistory.belongsTo(Guest, {as: 'Guest', foreignKey: 'GuestId'});

GameHistory.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});
GameHistory.belongsTo(Guest, {as: 'Guest', foreignKey: 'GuestId'});

GameHistory.belongsTo(Account, {as: 'Opponent', foreignKey: 'OpponentId'});
GameHistory.belongsTo(Guest, {as: 'OpponentGuest', foreignKey: 'OpponentGuestId'});

LinkCode.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});

PuzzleGameHistory.belongsTo(Puzzle, {as: 'Puzzle', foreignKey: 'PuzzleId'});
PuzzleGameHistory.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});
PuzzleGameHistory.belongsTo(Guest, {as: 'Guest', foreignKey: 'GuestId'});

Message.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});
Message.belongsTo(Account, {as: 'TargetAccount', foreignKey: 'TargetAccountId'});

TreasureHunting.belongsTo(Account, {as: 'Account', foreignKey: 'AccountId'});

// Account.belongsToMany(Account, {
//     as: 'Messages',
//     foreignKey: 'AccountId',
//     through: 'Message'
// });

// Account.belongsToMany(Account, { 
//     as: 'AccountMessages',
//     foreignKey: 'FriendId',
//     through: 'Friend'
// });

// Account.hasMany(PuzzleAccount, {as: 'Account', foreignKey: 'AccountId'});
// Puzzle.hasMany(PuzzleAccount, {as: 'Puzzle', foreignKey: 'PuzzleId'});

// Friend.belongsTo(Account, {
//     foreignKey: 'FriendId'
// });
// Account.hasMany(Friend);


sequelize.authenticate();


// export interface DataContext {
//     Database: Sequelize
//     Accounts: Account
//     Sessions: Session
//     Countries: Country
//     Friends: Friend
//     News: New
//     Tags: Tag
//     NewTags: NewTag
//     GameHistories: GameHistory
//     Guests: Guest
//     Logs: Log

// }

export default {
    Database: sequelize,
    LinkCodes: LinkCode,
    Accounts: Account,
    Sessions: Session,
    Countries: Country,
    Friends: Friend,
    News: New,
    Tags: Tag,
    NewTags: NewTag,
    GameHistories: GameHistory,
    Guests: Guest,
    Logs: Log,
    Puzzles: Puzzle,
    PuzzleGameHistories: PuzzleGameHistory,
    Messages: Message,
    TreasureHuntings: TreasureHunting,
    BaseAppSettings,
    AIGameHistories: AIGameHistory,
    EmailTemplates: EmailTemplate
}

// Check if database connection is valid
// sequelize.authenticate().then(function(errors: any) {
//     connectCallback(errors);
// });

// export default (onConnectCallback: Function) => {
//     connectCallback = onConnectCallback;
//     return {
//         Accounts: Account,
//         Sessions: Session,
//         Countries: Country,
//         Friends: Friend,
//         News: New,
//         Tags: Tag,
//         NewTags: NewTag
//     }
// }