import { GameStatus, TurnPhase, PlayerType, SpecialPhaseType, HealthStatus, CombatResultsTable, CombatResultTableValueEffect, UnitProperties, TerrainProperties } from './constants.js';
import { trigger } from './state.js';

export class GameEngine {
    constructor(gameState, hexGrid) {
        this.gameState = gameState;
        this.hexGrid = hexGrid;
    }

    handleUnitClick(unit) {
        if (this.gameState.status !== GameStatus.GAMEON || this.gameState.isAnimating) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();
        
        if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && this.gameState.attackers.includes(unit)) {
            this.handleAttackerDamageSelection(unit);
        }

        else if (currentSpecialPhase === SpecialPhaseType.ADVANCE && this.gameState.attackers.includes(unit) && 
            (this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === unit)) {
                this.handleAdvanceSelection(unit);
        }

        else if (this.gameState.currentTurnPhase === TurnPhase.ATTACK && currentSpecialPhase === null) {
            this.handleAttackPhaseSelection(unit);
        }

        else if (this.gameState.currentTurnPhase === TurnPhase.MOVE && currentSpecialPhase === null &&
            (this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === unit) && 
            unit.player == this.gameState.activePlayer && !unit.moved) {
                this.handleMovePhaseSelection(unit);
        }
    }

    handleAttackerDamageSelection(unit) {
        this.applyDamage(unit);
        this.gameState.unassignedDamagePoints--;

        const unitView = this.hexGrid.getViewForUnit(unit);
        if (unitView) {
            unitView.refreshStatusIndicator();
            unitView.refreshStatusText();
        }

        this.hexGrid.removeDeadUnits();

        if (this.gameState.unassignedDamagePoints === 0) {
            this.hexGrid.endSpecialPhase();
        }
    }

    handleAdvanceSelection(unit) {
        this.gameState.selectUnit(unit, false);
    }

    handleAttackPhaseSelection(unit) {
        if (unit.player === this.gameState.activePlayer && !unit.attacked) {
            this.gameState.selectUnit(unit, true);
        }
        else if (this.hexGrid.getHex(unit.x, unit.y).highlighted){
            const attackers = this.gameState.selectedUnits;
            if (attackers && attackers.length > 0) {
                this.attack(attackers, unit);
            }
        }
    }

    handleMovePhaseSelection(unit) {
        this.gameState.selectUnit(unit, false);
    }

    applyDamage(unit) {
        if (unit.healthStatus === HealthStatus.FULL) {
            unit.healthStatus = HealthStatus.REDUCED;
        }
        else if (unit.healthStatus === HealthStatus.REDUCED) {
            unit.healthStatus = HealthStatus.DEAD;
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

    attack(attackers, defender) {
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
        this.gameState.setCombatResult(crtColumn, d6Value);
        
        const crtResult = crtColumn[d6Value];
        const effect = CombatResultTableValueEffect[crtResult];

        const originalAttackerHealth = attackers.map(a => a.healthStatus);
        const originalDefenderHealth = defender.healthStatus;

        if (effect.attacker < 0) {
            const damagePoints = Math.abs(effect.attacker);
            if (attackers.length > 1) {
                this.gameState.attackers = attackers;
                this.gameState.unassignedDamagePoints = damagePoints;
                this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ATTACKER_DAMAGE);
            } else {
                for (let i = 0; i < damagePoints; i++) {
                    this.applyDamage(attackers[0]);
                }
            }
        }

        if (effect.defender === -1) {
            this.applyDamage(defender);
        } else if (effect.defender === -2) {
            this.applyDamage(defender);
            this.applyDamage(defender);
        }

        if (defender.isDead()) {
            this.gameState.vacatedHex = defenderHex;
            this.gameState.attackers = attackers;
            this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ADVANCE);
        }

        trigger('combatResolved', { 
            attackers,
            defender,
            didAttackerTakeDamage: effect.attacker === -1 && attackers.length === 1,
            wasDefenderDestroyed: defender.isDead(),
            originalAttackerHealth,
            originalDefenderHealth
        });

        this.gameState.selectUnit(null, false); // Clear selection
        this.hexGrid.checkWinningConditions();
        this.hexGrid.startSpecialPhase(this.gameState.getCurrentSpecialPhase());
    }

    handleHexClick(hex) {
        if (this.gameState.status !== GameStatus.GAMEON || this.gameState.isAnimating) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (this.gameState.currentTurnPhase == TurnPhase.MOVE || currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.selectedUnits.length > 0 && this.gameState.selectedUnits[0].isValidMove(hex.x, hex.y)) {
                const selectedUnit = this.gameState.selectedUnits[0];
                this.moveUnit(selectedUnit, hex.x, hex.y);
                this.gameState.selectUnit(null, false);

                if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
                    this.hexGrid.endSpecialPhase();
                }

                this.hexGrid.checkWinningConditions();
            }
        }
        else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
            const clickedUnit = hex.unit;
            if (clickedUnit && clickedUnit.player !== this.gameState.activePlayer) {
                if (this.gameState.selectedUnits.length > 0) {
                    this.attack(this.gameState.selectedUnits, clickedUnit);
                }
            }
        }
    }

    endCurrentPhase() {
        if (this.gameState.status !== GameStatus.GAMEON) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            this.hexGrid.endSpecialPhase();
        }
        else if (currentSpecialPhase === null) {
            if (this.gameState.currentTurnPhase == TurnPhase.MOVE) {
                this.gameState.currentTurnPhase = TurnPhase.ATTACK;
            }
            else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
                this.gameState.activePlayer = this.gameState.activePlayer == PlayerType.GREY
                    ? PlayerType.GREEN
                    : PlayerType.GREY;

                this.gameState.currentTurnPhase = TurnPhase.MOVE;
                this.gameState.setCombatResult(null, null);
                this.hexGrid.clearUnitMovedAttacked();
            }

            trigger('phaseChanged');

            this.hexGrid.clearHighlightedHexes();
            this.hexGrid.clearSelections();
            this.hexGrid.refreshUnitDimmers();
        }
    }
}
