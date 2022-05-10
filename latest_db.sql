use brainiacchess

select * from Friend


alter table Friend add ResponseDate bigint
alter table Friend add IsRemoved bit not null default 0

select * from GameHistory

create table Puzzle (
	Id int not null auto_increment primary key,
    Name varchar(64) not null unique,
    Data TEXT not null,
    CreationDate bigint not null,
    BaseTime int null,
    IncrementTime int null,
    Type tinyint not null,
    SurviveTurns int null,
    Status tinyint not null default 0
)

create table PuzzleAccount (
	Id int not null auto_increment primary key,
    AccountId int not null,
    PuzzleId int not null    
)


alter table PuzzleAccount add constraint FK_AccountId foreign key (AccountId) references Account(Id)
alter table PuzzleAccount add constraint FK_PuzzleId foreign key (PuzzleId) references Puzzle(Id)
alter table PuzzleAccount add constraint UC_Account_Puzzle unique key (AccountId, PuzzleId)

select * from GameHistory

create table Message (
	Id bigint not null auto_increment primary key,
    Message text not null,
    AccountId int not null,
    TargetAccountId int not null,
    RoomIdentifier varchar(32) null,
    IsRead bit not null default 0,
    Date bigint not null
)

alter table Message add constraint FK_Account foreign key (AccountId) references Account(Id)
alter table Message add constraint FK_TargetAccount foreign key (TargetAccountId) references Account(Id)

select * from Message
-- insert into Message (Message, AccountId, TargetAccountId, IsRead, Date) values ('teste', 10, 3, 0, 1211231232312)
-- insert into Message (Message, AccountId, TargetAccountId, IsRead, Date) values ('teste 2', 3, 10, 0, 1211231232312)

select * from Log order by Id desc

---------------------------------------------------------------------------------------------------

select * from Friend
use brainiacchess

alter table Friend drop foreign key FK_Friend_Friend
alter table Friend drop constraint FK_Friend_Account
alter table Friend drop constraint IX_Friend_AccountFriend
alter table Friend add constraint FK_Friend_Friend foreign key (FriendId) references Account(Id)
alter table Friend add constraint FK_Friend_Account foreign key (AccountId) references Account(Id)

select * from Account
alter table Account add Avatar TEXT null
alter table Account add Settings TEXT null
alter table Account add WalletAddress TEXT null


// leaderboard - most actives
select Id, count(0) from
(
	select AccountId as Id
	from GameHistory
	where RoomType = 2 and AccountId is not null
    union all
    select OpponentGuestId as Id
	from GameHistory
	where RoomType = 2 and OpponentId is not null and C
) a
group by Id
order by Id
limit 3

create table TreasureHunting (
	Id bigint not null auto_increment primary key,
    AccountId int not null,
    TreasurePlaces text not null,
    Attempts text not null,
    GameStartDate bigint not null,
    GameEndDate bigint not null,
    TreasuresFound tinyint not null default 0
)

-- drop table TreasureHunting
-- alter table TreasureHunting drop constraint FK_TreasureHunting_Account

alter table TreasureHunting add constraint FK_TreasureHunting_Account foreign key (AccountId) references Account(Id)


alter table PuzzleAccount drop constraint FK_AccountId
alter table PuzzleAccount drop constraint FK_PuzzleId

alter table PuzzleAccount add constraint FK_PuzzleAccount_AccountId foreign key (AccountId) references Account(Id)
alter table PuzzleAccount add constraint FK_PuzzleAccount_PuzzleId foreign key (PuzzleId) references Puzzle(Id)


alter table Message drop constraint FK_Account
alter table Message drop constraint FK_TargetAccount

alter table Message add constraint FK_Message_Account foreign key (AccountId) references Account(Id)
alter table Message add constraint FK_Message_TargetAccount foreign key (TargetAccountId) references Account(Id)

create table BaseAppSettings (
	Id tinyint not null auto_increment primary key,
    MaintenanceMode tinyint not null default 0,
    MaintenanceTime int null,
    MaintenanceDuration int null,
    Level1TreasureValue int not null,
    Level2TreasureValue int not null,
    Level3TreasureValue int not null,
    TreasureQuestAttempts tinyint not null,
    TreasureQuestGamesPerDay tinyint not null,
    BoardOddSquaresColor varchar(7) not null,
    BoardEvenSquaresColor varchar(7) not null,
    BoardLastPlaySquaresColor varchar(7) not null,
    BoardPossibleMovesColor varchar(7) not null,
    BoardPossibleCapturesColor varchar(7) not null,
    BoardCheckSquaresColor varchar(7) not null,
    TreasureQuestSound bit not null default(1)
)

-- drop table BaseAppSettings

insert into BaseAppSettings values (null, 0, null, null, 1000, 2000, 5000, 6, 5, '#cca66a', '#674428', '#e0ca40', '#fffc00', '#ff0c00', '#ff0c00', 1)

alter table Puzzle add IsWhite bit null
update Puzzle set IsWhite = 1
alter table Puzzle modify IsWhite bit not null

select * from GameHistory

create table AIGameHistory (
	Id bigint not null auto_increment primary key,
    Level tinyint not null,
	GuestId int null,
	AccountId int null,
    Result tinyint not null,
    PieceSide tinyint not null,
    BoardMoves longtext not null,
    GameStartDate bigint not null,
    GameEndDate bigint not null    
)

alter table AIGameHistory add constraint FK_AIGameHistory_Guest foreign key (GuestId) references Guest(Id)
alter table AIGameHistory add constraint FK_AIGameHistory_Account foreign key (AccountId) references Account(Id)
alter table AIGameHistory add constraint CK_AIGameHistory check (
																	(GuestId is not null and AccountId is null) or
                                                                    (GuestId is null and AccountId is not null)
																)
                                                                
select * from Guest

select * from TreasureHunting
select * from Log order by Id desc

create table EmailTemplate (
	Id int not null auto_increment primary key,
    Subject varchar(32) not null,
    Body mediumtext not null,
    IsActive bit not null default(0),
    Type tinyint not null,
    CreationDate bigint not null,
    TemplateData mediumtext not null
)

alter table BaseAppSettings add TreasureQuestSound bit not null default(1)
alter table EmailTemplate add TemplateData mediumtext not null

SELECT `AccountId`, count(DISTINCT(`AccountId`)) AS `count` FROM `GameHistory` AS `GameHistory` WHERE `GameHistory`.`RoomType` = 2 AND `GameHistory`.`GameStartDate` > 0 AND `GameHistory`.`GameEndDate` < 128192891821 AND `GameHistory`.`AccountId` IS NOT NULL;

select * from Message

update Message set IsRead = 0 where Id = 2
update Message set AccountId = 2 where Id = 2


select * from EmailTemplate order by Id desc limit 4

select * from Account where Email = 'davidserodio@hotmail.com'

create table LinkCode (
	Id bigint not null auto_increment primary key,
    Identifier char(32) not null,
    Status tinyint not null,
    Type tinyint not null,
    AccountId int not null,
    Date bigint not null
)

alter table LinkCode add constraint FK_LinkCode_Account foreign key (AccountId) references Account(Id)

-----------------------------------------------------------------

select *
from (select Date, Message, (case when AccountId = 10 then TargetAccountId else AccountId end) as OtherAccountId
	  from Message
	  where AccountId = 10 or TargetAccountId = 10
      order by Id desc) a
group by OtherAccountId
limit 5
offset 0

select a.Date, a.Message, (case when a.AccountId = 10 then a.TargetAccountId else a.AccountId end) as OtherAccountId
from Message a
left join Message b on ((a.AccountId = b.AccountId and a.TargetAccountId = b.TargetAccountId) or (a.AccountId = b.TargetAccountId and a.TargetAccountId = b.AccountId)) and b.Id > a.Id
where (a.AccountId = 10 or a.TargetAccountId = 10) and b.Id is null
limit 5
offset 0

select * from puzzle

select * from Message order by Rand() limit 1

drop table PuzzleAccount

create table PuzzleGameHistory (
	Id bigint not null auto_increment primary key,
	GuestId int null,
	AccountId int null,
    PuzzleId int not null,
    Result tinyint not null,
    BoardMoves longtext not null,
    GameStartDate bigint not null,
    GameEndDate bigint not null
)

alter table PuzzleGameHistory add constraint FK_PuzzleGameHistory_Guest foreign key (GuestId) references Guest(Id)
alter table PuzzleGameHistory add constraint FK_PuzzleGameHistory_Account foreign key (AccountId) references Account(Id)
alter table PuzzleGameHistory add constraint FK_PuzzleGameHistory_Puzzle foreign key (PuzzleId) references Puzzle(Id)
alter table PuzzleGameHistory add constraint CK_PuzzleGameHistory check (
	(GuestId is not null and AccountId is null) or
    (GuestId is null and AccountId is not null)
)

create table Tournament (
	Id bigint not null auto_increment primary key,
    AccountId int null,
    BeginDate bigint not null,
    EndDate bigint not null,
)