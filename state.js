import { GameStatus, PlayerType, TurnPhase } from './Constants.js';

export class GameState {
    constructor() {
        this.status = GameStatus.GAMEON;
        this.winner = null;
        this.activePlayer = PlayerType.GREY;
        this.currentTurnPhase = TurnPhase.MOVE;
        this.unassignedDamagePoints = 0;
        this.vacatedHex = null;
        this.specialPhaseQueue = [];
        this.crtColumn = null;
        this.d6Value = null;
        this.isAnimating = false;

        this.onCombatResultUpdated = [];
        this.onWinnerUpdated = [];
        this.onCurrentSpecialPhaseUpdated = [];
    }

    setCombatResult(crtColumn, d6Value) {
        this.crtColumn = crtColumn;
        this.d6Value = d6Value;
        this.triggerCombatResultUpdatedEvent();
    }
    
    triggerCombatResultUpdatedEvent() {
        this.onCombatResultUpdated.forEach(f => f());
    }

    setWinner(winner) {
        this.winner = winner;
        this.triggerWinnerUpdatedEvent();
    }

    triggerWinnerUpdatedEvent() {
        this.onWinnerUpdated.forEach(f => f());
    }

    getCurrentSpecialPhase() {
        return this.specialPhaseQueue.length > 0 ? this.specialPhaseQueue[0] : null;
    }

    triggerCurrentSpecialPhaseUpdatedEvent() {
        this.onCurrentSpecialPhaseUpdated.forEach(f => f());
    }

    pushSpecialPhaseQueue(specialPhase) {
        this.specialPhaseQueue.push(specialPhase);

        if (this.specialPhaseQueue.length > 0) {
            this.triggerCurrentSpecialPhaseUpdatedEvent();
        }
    }

    shiftSpecialPhaseQueue() {
        this.specialPhaseQueue.shift();
        this.triggerCurrentSpecialPhaseUpdatedEvent();
    }
}
