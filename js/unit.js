import { 
	HealthStatus,
	UnitProperties,
  UnitType
} from './constants.js';

export class Unit {
	constructor(x, y, unitType, player) {
		this.x = x;
		this.y = y;
		this.unitType = unitType;
		this.player = player;

		this.selected = false;
		this.moved = false;
		this.attacked = false;
		this.advanced = false;
		this.healthStatus = HealthStatus.FULL;
		this.isSupplied = true;
	}

	getEffectiveMovement() {
		const baseMovement = this.getBaseMovement();
		if (this.isSupplied || this.unitType === UnitType.INFANTRY) {
			return baseMovement;
		}
		return Math.max(1, Math.floor(baseMovement * 2 / 3));
	}

	getBaseMovement() {
		return UnitProperties[this.unitType].movementAllowance;
	}

	getEffectiveAttack() {
		let baseAttack = this.getBaseAttack();

		if (!this.isSupplied) {
			baseAttack = Math.max(1, Math.floor(baseAttack * 2 / 3));
		}
		return baseAttack;
	}

	getBaseAttack() {
		return (this.healthStatus === HealthStatus.FULL)
			? UnitProperties[this.unitType].attackStrength
			: UnitProperties[this.unitType].reducedAttackStrength;
	}

	getEffectiveDefense() {
		let baseDefense = this.getBaseDefense();

		if (!this.isSupplied) {
			baseDefense = Math.max(1, Math.floor(baseDefense * 2 / 3));
		}
		return baseDefense;
	}

	getBaseDefense() {
		return (this.healthStatus === HealthStatus.FULL)
			? UnitProperties[this.unitType].defendStrength
			: UnitProperties[this.unitType].reducedDefendStrength;
	}

	isDead() {
		return this.healthStatus === HealthStatus.DEAD;
	}

	isValidMove(gridX, gridY, hexGrid) {
        const { reachableHexes } = hexGrid.getReachableHex(this.x, this.y, this.getEffectiveMovement());
        return reachableHexes.some(h => h.x === gridX && h.y === gridY);
	}
}