
export enum MaintenanceMode {
    Online = 0,
    GameplayDisabled = 1,
    Offline = 2
}

class GlobalVariables {

    // App Settings
    SettingsChangeHandlers: Array<Function>;
    
    // Timers
    GameLeaveEndGame: number;
    GameLeaveEndGamePrompt: number;
    AskForDrawPrompt: number;
    TreasureHuntingLeaveEndGame: number;
    
    constructor() {
        this.SettingsChangeHandlers = [];

        this.GameLeaveEndGame = 30;
        this.GameLeaveEndGamePrompt = 10;
        this.AskForDrawPrompt = 10;
        this.TreasureHuntingLeaveEndGame = 60 * 10; // 10 minutes
    }

    TriggerAppSettingsChange() {
        this.SettingsChangeHandlers.forEach(callback => callback());
    }

    AddAppSettingsChangeListener(callback: Function) {
        this.SettingsChangeHandlers.push(callback);
    }


}

export const Globals = new GlobalVariables();