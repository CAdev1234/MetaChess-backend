export enum SpectatorsNotificationType {
    Chat = 1,
    DrawRequest,
    AcceptDraw,
    DeclineDraw,
    BackToGame,
    Leave,
    Resign,
    LeavePromptWin,
    LeavePromptDraw,
    SpectatorMessage,
    Cancelled
}

export interface SpectatorsNotification {
    Type: SpectatorsNotificationType;
    AccountId?: number;
    GuestId?: number;
    Timestamp: number;
    Message?: string;
}