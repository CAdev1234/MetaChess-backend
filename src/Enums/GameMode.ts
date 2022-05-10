export enum GameMode {
    Casual = 1,
    Rated
}

export enum GameType {
    Classical = 1,
    Blitz,
    Rapid,
    Bullet
}

export function GetGameType(time: number) : GameType {
    if (time <= 2) return GameType.Bullet;
    else if (time > 2 && time <= 5) return GameType.Blitz;
    else if (time > 5 && time <= 10) return GameType.Rapid;
    else return GameType.Classical;
}

export function GetRandomBaseTime(type: GameType) : any {
    if (type == GameType.Bullet) return { base: 1.5, increment: 0};
    else if (type == GameType.Blitz) return { base: 3.5, increment: 0};
    else if (type == GameType.Rapid) return { base: 7.5, increment: 0};
    else return { base: 13, increment: 0};
}