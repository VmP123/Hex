import { GameStatus, PlayerType, TurnPhase } from './constants.js';

const listeners = {};

export function on(eventName, callback) {
  if (!listeners[eventName]) {
    listeners[eventName] = [];
  }
  listeners[eventName].push(callback);
}

export function trigger(eventName, data) {
  if (listeners[eventName]) {
    listeners[eventName].forEach(callback => callback(data));
  }
}

export class GameState {
    constructor() {
        this.status = GameStatus.EDITOR;
        this.winner = null;
        this.activePlayer = PlayerType.GREY;
        this.currentTurnPhase = TurnPhase.MOVE;
        this.unassignedDamagePoints = 0;
        this.vacatedHex = null;
        this.specialPhaseQueue = [];
        this.crtColumn = null;
        this.d6Value = null;
        this.isAnimating = false;
        this.selectedUnits = [];
    }

    setCombatResult(crtColumn, d6Value) {
        this.crtColumn = crtColumn;
        this.d6Value = d6Value;
        trigger('combatResultUpdated', this);
    }

    setWinner(winner) {
        this.winner = winner;
        trigger('winnerUpdated', this);
    }

    getCurrentSpecialPhase() {
        return this.specialPhaseQueue.length > 0 ? this.specialPhaseQueue[0] : null;
    }

    pushSpecialPhaseQueue(specialPhase) {
        this.specialPhaseQueue.push(specialPhase);

        if (this.specialPhaseQueue.length > 0) {
            trigger('currentSpecialPhaseUpdated', this);
        }
    }

    shiftSpecialPhaseQueue() {
        this.specialPhaseQueue.shift();
        trigger('currentSpecialPhaseUpdated', this);
    }

    
}