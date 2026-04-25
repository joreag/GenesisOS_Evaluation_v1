/**
 * MICT FRAMEWORK v2 (Client-Side Edition)
 * Universal State Machine for Logic and AI
 */
export class MICT {  // <--- CHANGED: export class
    constructor(config) {
        if (!config || typeof config !== 'object') {
            throw new TypeError("MICT constructor requires a configuration object.");
        }
        if (!Array.isArray(config.stages) || config.stages.length === 0) {
            throw new TypeError("MICT configuration must include a 'stages' array.");
        }

        this.stages = config.stages;
        this.currentState = { ...config.initialState }; 
        this.previousState = null;
        this.currentStageIndex = 0;
        
        // Optional UI/Logging callback
        this.updateUI = config.updateUI || (() => {});
        this.stageFunctions = config.stageFunctions || {};
        this.config = config; 
    }

    getCurrentStage() {
        return this.stages[this.currentStageIndex];
    }

    async nextStage() {
        const currentStage = this.getCurrentStage();

        if (this.stageFunctions[currentStage]) {
            try {
                const newState = await this.stageFunctions[currentStage](this.currentState);
                this.previousState = { ...this.currentState };
                if (newState !== undefined) {
                    this.currentState = newState;
                }
            } catch (error) {
                console.error(`Error in stage '${currentStage}':`, error);
                this.currentState = { ...this.currentState, error: error.message };
                return false; 
            }
        }

        if (this.currentState.error) {
            return false;
        }

        this.currentStageIndex = (this.currentStageIndex + 1) % this.stages.length;
        this.updateUI(this.currentState, this.getCurrentStage());
        return true;
    }

    async run() {
        for (let i = 0; i < this.stages.length; i++) {
            const success = await this.nextStage();
            if (!success) break;
        }
        return this.currentState;
    }

    reset() {
        this.currentStageIndex = 0;
        this.previousState = null;
        this.currentState = { ...this.config.initialState }; 
        this.updateUI(this.currentState, this.getCurrentStage());
    }
}
// Removed module.exports line