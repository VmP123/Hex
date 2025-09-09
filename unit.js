import { 
	HealthStatus,
	UnitProperties
} from './constants.js';

export class Unit {
	constructor(x, y, unitType, player, baseRect) {
		this.x = x;
		this.y = y;
		this.unitType = unitType;
		this.player = player;
		this.baseRect = baseRect; // Still needed for view to clone

		this.selected = false;
		this.moved = false;
		this.attacked = false;
		this.advanced = false;
		this.healthStatus = HealthStatus.FULL;
	}

	isDead() {
		return this.healthStatus === HealthStatus.DEAD;
	}

	isValidMove(gridX, gridY) {
		// This logic is now effectively in the ViewController, which highlights valid hexes.
		// A better implementation would have the GameEngine determine validity directly.
		return window.game.hexGrid.getHex(gridX, gridY).highlighted;
	}
}
