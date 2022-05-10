
export interface PlayObjectResponse {
    level?: number
    status: PlayEnum
}

export enum PlayEnum {
    OK,
    OKGameFinished,
    AttemptsExceeded,
    PlaceAlreadyClicked
}