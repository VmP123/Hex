
import { TurnPhase, GameStatus, PlayerType, SpecialPhaseType, UnitProperties, TerrainProperties, CombatResultsTable, CombatResultTableValueEffect, HealthStatus } from './constants.js';
import { trigger, state } from './state.js';
import { getAnotherPlayer } from './utils.js';

export class GameEngine {
    constructor(hexGrid) {
        this.hexGrid = hexGrid;
    }

    handleHexClick(x, y) {
        if (state.status !== GameStatus.GAMEON || state.isAnimating) {
            return;
        }

        const currentSpecialPhase = state.getCurrentSpecialPhase();

        if ((state.currentTurnPhase == TurnPhase.MOVE || currentSpecialPhase === SpecialPhaseType.ADVANCE) && 
            state.selectedUnits.length > 0 && 
            state.selectedUnits[0].isValidMove(x, y)) { // isValidMove is still on Unit, will be moved later
            const selectedUnit = state.selectedUnits[0];
            this.moveUnit(selectedUnit, x, y); // Call gameEngine.moveUnit
            state.selectUnit(null, false); // This calls gameEngine.selectUnit

            if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
                this.endSpecialPhase();
            }

            this.checkWinningConditions();
        }
    }

    moveUnit(unit, gridX, gridY) {
        unit.moved = true;

        const startHex = this.hexGrid.getHex(unit.x, unit.y);
        const endHex = this.hexGrid.getHex(gridX, gridY);
        const path = this.hexGrid.findPath(startHex, endHex, unit);

        if (path) {
            trigger('unitMoving', { unit: unit, path: path });
        }
    }

    attackUnit(attackers, defender) {
        attackers.forEach(a => {
            a.attacked = true;
        });

        const defenderHex = this.hexGrid.getHex(defender.x, defender.y);

        const attackStrengthSum = attackers.reduce((total, su) => {
            let strength = (su.healthStatus === HealthStatus.FULL 
                ? UnitProperties[su.unitType].attackStrength 
                : UnitProperties[su.unitType].reducedAttackStrength);
            
            const attackerHex = this.hexGrid.getHex(su.x, su.y);
            const attackerTerrain = attackerHex.terrainType;
            const attackModifier = TerrainProperties[attackerTerrain]?.attackModifier || 1;
            strength = Math.floor(strength * attackModifier);

            if (this.hexGrid.isRiverBetween(attackerHex, defenderHex)) {
                strength = Math.floor(strength * (2/3));
            }
            return total + strength;
        }, 0);

        const defendStrength = defender.healthStatus === HealthStatus.FULL 
            ? UnitProperties[defender.unitType].defendStrength
            : UnitProperties[defender.unitType].reducedDefendStrength;

        let crtColumn = [...CombatResultsTable].reverse().find(crtv => crtv.ratio <= (attackStrengthSum/defendStrength)) || CombatResultsTable[0];

        const defenderTerrain = defenderHex.terrainType;
        const crtShift = TerrainProperties[defenderTerrain]?.defenderCrtShift || 0;

        if (crtShift !== 0) {
            const currentIndex = CombatResultsTable.indexOf(crtColumn);
            const newIndex = currentIndex + crtShift;
            const lastIndex = CombatResultsTable.length - 1;
            crtColumn = newIndex < 0 ? CombatResultsTable[0] : (newIndex > lastIndex ? CombatResultsTable[lastIndex] : CombatResultsTable[newIndex]);
        }

        const d6Value = Math.floor(Math.random() * 6) + 1;
        state.setCombatResult(crtColumn, d6Value);
        
        const crtResult = crtColumn[d6Value];
        const effect = CombatResultTableValueEffect[crtResult];

        const originalAttackerHealth = attackers.map(a => a.healthStatus);
        const originalDefenderHealth = defender.healthStatus;

        if (effect.attacker === -1) {
            if (attackers.length > 1) {
                state.attackers = attackers;
                state.unassignedDamagePoints = 1;
                state.pushSpecialPhaseQueue(SpecialPhaseType.ATTACKER_DAMAGE);
            } else {
                attackers[0].takeDamage();
            }
        }

        if (effect.defender === -1) {
            defender.takeDamage();
        } else if (effect.defender === -2) {
            defender.takeDamage();
            defender.takeDamage(); // Takes two hits
        }

        if (defender.isDead()) {
            state.vacatedHex = defenderHex;
            state.attackers = attackers;
            state.pushSpecialPhaseQueue(SpecialPhaseType.ADVANCE);
        }

        trigger('combatResolved', { 
            attackers,
            defender,
            didAttackerTakeDamage: effect.attacker === -1 && attackers.length === 1,
            wasDefenderDestroyed: defender.isDead(),
            originalAttackerHealth,
            originalDefenderHealth
        });

        state.selectUnit(null, false); // Clear selection
        this.checkWinningConditions();
        this.startSpecialPhase(state.getCurrentSpecialPhase());
    }

    selectUnit(unit, isAttacking) {
        if (state.status !== GameStatus.GAMEON || state.isAnimating) {
            return;
        }

        const currentSpecialPhase = state.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && state.attackers.includes(unit)) {
            // Handle attacker damage selection (logic will be moved here later)
            unit.takeDamage();
            state.unassignedDamagePoints--;
            unit.refreshStatusIndicator();
            unit.refreshStatusText();
            this.hexGrid.removeDeadUnits();

            if (state.unassignedDamagePoints === 0) {
                this.endSpecialPhase();
            }
            trigger('selectionChanged', { selectedUnits: state.selectedUnits });
            return;
        }

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE && state.attackers.includes(unit) &&
            (state.selectedUnits.length === 0 || state.selectedUnits[0] === unit)) {
            // Handle advance selection (logic will be moved here later)
            state.selectedUnits = [unit];
            trigger('selectionChanged', { selectedUnits: state.selectedUnits });
            return;
        }

        if (unit && unit.player === state.activePlayer && !unit.moved) {
            if (state.selectedUnits.length > 0 && state.selectedUnits[0] === unit) {
                // Deselect if already selected
                state.selectedUnits = [];
            } else {
                // Select unit
                state.selectedUnits = [unit];
            }
        } else if (isAttacking && state.selectedUnits.length > 0) {
            // Add to selection for attack
            if (!state.selectedUnits.includes(unit)) {
                state.selectedUnits.push(unit);
            } else {
                state.selectedUnits = state.selectedUnits.filter(u => u !== unit);
            }
        } else {
            // Clear selection if clicking elsewhere or invalid unit
            state.selectedUnits = [];
        }

        trigger('selectionChanged', { selectedUnits: state.selectedUnits });
    }

    endCurrentPhase() {
        if (state.status !== GameStatus.GAMEON) {
            return;
        }

        const currentSpecialPhase = state.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE) {
            // Cannot end phase if damage needs to be assigned
            return;
        }

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            this.endSpecialPhase();
            return;
        }

        if (state.currentTurnPhase === TurnPhase.MOVE) {
            state.currentTurnPhase = TurnPhase.ATTACK;
        } else {
            state.currentTurnPhase = TurnPhase.MOVE;
            state.activePlayer = getAnotherPlayer(state.activePlayer);
            this.hexGrid.clearUnitMovedAttacked();
        }

        state.selectedUnits = [];
        this.hexGrid.clearHighlightedHexes();
        this.hexGrid.refreshUnitSelectRects();
        this.hexGrid.refreshUnitDimmers();
        trigger('phaseChanged');
        this.checkWinningConditions();
    }

    checkWinningConditions() {
        const winner = this.getWinner();

        if (winner != null) {
            state.status = GameStatus.ENDED;
            state.setWinner(winner);
        }
    }

    getWinner() {
        for (const player of Object.values(PlayerType)) {
            if (!this.hexGrid.units.some(u => u.player == getAnotherPlayer(player)))
            {
                return player;
            }

            const flagHex = this.hexGrid.hexes.find(h => h.flag != null && h.player == getAnotherPlayer(player));
            if (flagHex && this.hexGrid.units.some(u => u.x === flagHex.x && u.y === flagHex.y && u.player === player)) {
                return player;
            }
        }

        return null;
    }

    startSpecialPhase(specialPhase) {
        if (state.status === GameStatus.ENDED) {
            return;
        }
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            if (state.attackers.every(a => a.isDead())) {
                this.endSpecialPhase();
            }
            else {
                this.hexGrid.clearHighlightedHexes();
                state.vacatedHex.toggleInnerHex(true);
                this.hexGrid.refreshUnitDimmers();
            }
        }
    }

    endSpecialPhase() {
        const currentPhase = state.getCurrentSpecialPhase();
        state.shiftSpecialPhaseQueue();

        if(currentPhase === SpecialPhaseType.ADVANCE) {
            this.hexGrid.clearHighlightedHexes();
            state.selectedUnits = []; // Clear selection
        }

        this.hexGrid.refreshUnitDimmers();
        this.startSpecialPhase(state.getCurrentSpecialPhase());
    }
}
