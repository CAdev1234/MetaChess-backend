-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.4.24-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             11.3.0.6295
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table brainiacchess.account
CREATE TABLE IF NOT EXISTS `account` (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `Fullname` char(64) DEFAULT NULL,
  `Username` char(64) NOT NULL,
  `Role` int(11) NOT NULL DEFAULT 0,
  `Type` int(11) NOT NULL,
  `CountryId` int(11) DEFAULT NULL,
  `Email` char(64) NOT NULL,
  `SaltPassword` char(128) NOT NULL,
  `ClassicalElo` int(11) NOT NULL DEFAULT 1500,
  `BlitzElo` int(11) NOT NULL DEFAULT 1500,
  `RapidElo` int(11) NOT NULL DEFAULT 1500,
  `BulletElo` int(11) NOT NULL DEFAULT 1500,
  `GuestId` int(11) DEFAULT NULL,
  `CreationDate` bigint(20) NOT NULL,
  `FailedPasswordAttempts` smallint(6) NOT NULL,
  `ClassicalEloSubsequentlyOver2400` bit(1) NOT NULL DEFAULT b'0',
  `BlitzEloSubsequentlyOver2400` bit(1) NOT NULL DEFAULT b'0',
  `RapidEloSubsequentlyOver2400` bit(1) NOT NULL DEFAULT b'0',
  `BulletEloSubsequentlyOver2400` bit(1) NOT NULL DEFAULT b'0',
  `IsBanned` bit(1) NOT NULL DEFAULT b'0',
  `Privileges` int(11) NOT NULL,
  `IsVerified` bit(1) NOT NULL DEFAULT b'0',
  `Avatar` text DEFAULT NULL,
  `Settings` text DEFAULT NULL,
  `WalletAddress` text DEFAULT NULL,
  `CoinBalance` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `IX_Account_Username` (`Username`),
  UNIQUE KEY `IX_Account_Email` (`Email`),
  KEY `FK_Account_Country` (`CountryId`),
  KEY `FK_Account_Guest` (`GuestId`),
  CONSTRAINT `FK_Account_Country` FOREIGN KEY (`CountryId`) REFERENCES `country` (`Id`),
  CONSTRAINT `FK_Account_Guest` FOREIGN KEY (`GuestId`) REFERENCES `guest` (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

-- Dumping structure for table brainiacchess.cointransaction
CREATE TABLE IF NOT EXISTS `cointransaction` (
  `Id` bigint(20) NOT NULL AUTO_INCREMENT,
  `AccountId` int(11) NOT NULL,
  `Amount` int(11) NOT NULL,
  `Type` smallint(6) NOT NULL,
  `TxHash` varchar(256) DEFAULT NULL,
  `Description` varchar(256) DEFAULT NULL,
  `CreationDate` bigint(20) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `FK_CoinTransaction_Account` (`AccountId`),
  CONSTRAINT `FK_CoinTransaction_Account` FOREIGN KEY (`AccountId`) REFERENCES `account` (`Id`),
  CONSTRAINT `CK_CoinTransaction` CHECK (((`Type` = 1 or `Type` = 2) and `TxHash` is not null or `Type` <> 1 and `Type` <> 2 and `TxHash` is null) and ((`Type` = 2 or `Type` = 3) and `Amount` < 0 or `Type` <> 2 and `Type` <> 3 and `Amount` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4;

-- Data exporting was unselected.

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
