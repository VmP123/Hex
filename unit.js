import { 
	HealthStatus,
	ColorByPlayer, 
	GameStatus, 
	UnitProperties, 
	TurnPhase, 
	SpecialPhaseType, 
	CombatResultsTable, 
	CombatResultTableValueEffect,
	TerrainType,
	TerrainProperties
} from './constants.js';
import { trigger } from './state.js';
import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class Unit {
	constructor(x, y, unitType, baseRect, player, hexRadius, lineWidth, hexGrid, gameState, animationService) {
		this.j = null;
		this.x = x;
		this.y = y;
		this.unitType = unitType
		this.hexRadius = hexRadius;
		this.lineWidth = lineWidth;
		this.hexGrid = hexGrid;
		this.gameState = gameState;
    this.animationService = animationService;
		this.selected = false;
		this.baseRect = baseRect;
		this.player = player;

		this.moved = false;
		this.attacked = false;
		this.advanced = false;

		this.svg = null;
		this.healthStatus = HealthStatus.FULL;
		this.refreshStatusText();
		this.setBackgroundColor();
	}

	setBackgroundColor() {
		const color = ColorByPlayer[this.player];
		const backgroundElement = this.baseRect.querySelector('.background');

		backgroundElement.setAttribute('fill', color);
	}

	createUnit() {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

		const margin = getMargin(this.lineWidth);
		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);

		const dimmerRect = document.createElementNS('http://www.w3.org/2000/svg', "rect");
		dimmerRect.setAttribute("x", 3);
		dimmerRect.setAttribute("y", 3);
		dimmerRect.setAttribute("width", 54);
		dimmerRect.setAttribute("height", 54);
		dimmerRect.setAttribute("fill", "#ffffff");
		dimmerRect.setAttribute("opacity", "65%");
		dimmerRect.setAttribute("class", "dimmer");
		dimmerRect.setAttribute("rx", 6);
		dimmerRect.setAttribute('stroke-width', 2);
		dimmerRect.setAttribute('display', 'none');

		const selectRect = document.createElementNS('http://www.w3.org/2000/svg', "rect");	
		selectRect.setAttribute("alignment-baseline", "middle");
		selectRect.setAttribute("x", 2);
		selectRect.setAttribute("y", 2);
		selectRect.setAttribute("width", 56);
		selectRect.setAttribute("height", 56);
		selectRect.setAttribute("fill", "none");
		selectRect.setAttribute("rx", 6);
		selectRect.setAttribute('stroke-width', 6);
		selectRect.setAttribute('stroke', 'black');
		selectRect.setAttribute("class", "selectRect");
		selectRect.setAttribute('display', 'none');

		svg.appendChild(this.baseRect);
		svg.appendChild(dimmerRect);
		svg.appendChild(selectRect);
		
		this.svg = svg;

		if (this.hexGrid.isEditor) {
			this.svg.style.pointerEvents = 'none';
		}

		if (this.hexGrid.isEditor) {
			this.svg.style.pointerEvents = 'none';
		}

		this.updatePosition(this.x, this.y);

		const handleClick = () => {
			if (this.hexGrid.viewController.panned) {
				return;
			}
			this.select();
		};

		if (!this.hexGrid.isEditor) {
			this.svg.addEventListener('click', handleClick);
		}
	}

	select() {
		if (this.gameState.status !== GameStatus.GAMEON || this.gameState.isAnimating) {
			return;
		}

		const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();
		
		if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && this.gameState.attackers.includes(this)) {
			this.handleAttackerDamageSelection();
		}

		else if (currentSpecialPhase === SpecialPhaseType.ADVANCE && this.gameState.attackers.includes(this) && 
			(this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === this)) {
				this.handleAdvanceSelection();
		}

		else if (this.gameState.currentTurnPhase === TurnPhase.ATTACK && currentSpecialPhase === null) {
			this.handleAttackPhaseSelection();
		}

		else if (this.gameState.currentTurnPhase === TurnPhase.MOVE && currentSpecialPhase === null &&
			(this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === this) && 
			this.player == this.gameState.activePlayer && !this.moved) {
				this.handleMovePhaseSelection()
		}
	}

	handleAttackerDamageSelection() {
		this.takeDamage();
		this.gameState.unassignedDamagePoints--;
		this.refreshStatusIndicator();
		this.refreshStatusText();
		this.hexGrid.removeDeadUnits();

		if (this.gameState.unassignedDamagePoints === 0) {
			this.hexGrid.endSpecialPhase();
		}
	}

	handleAdvanceSelection() {
		this.gameState.selectUnit(this, false);
	}

	handleAttackPhaseSelection() {
		if (this.player === this.gameState.activePlayer && !this.attacked) {
            this.gameState.selectUnit(this, true);
		}
		else if (this.hexGrid.getHex(this.x, this.y).highlighted){
			const attackers = this.gameState.selectedUnits;
			if (attackers && attackers.length > 0) {
				this.attack(attackers);
			}
		}
	}

	handleMovePhaseSelection() {
		this.gameState.selectUnit(this, false);
	}

	refreshSelectRect() {
		const selectRect = this.svg.querySelector('.selectRect');
		selectRect.setAttribute('display', this.selected ? 'block' : 'none');
	}

	refreshDimmer() {
		var dimm = false;

		const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

		if (currentSpecialPhase === null) {
			dimm = 
				(this.gameState.currentTurnPhase === TurnPhase.ATTACK && this.attacked) ||
				(this.gameState.currentTurnPhase === TurnPhase.MOVE && this.moved);

		}
		else {
			dimm = (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && !this.gameState.attackers.includes(this)) ||
					 (currentSpecialPhase === SpecialPhaseType.ADVANCE && !this.gameState.attackers.includes(this));
		}

		if (this.gameState.isAnimating) {
			dimm = false;
		}

		const dimmerRect = this.svg.querySelector('.dimmer');
		dimmerRect.setAttribute('display', dimm ? 'block' : 'none');
	}

	updatePosition(gridX, gridY) {
		this.x = gridX;
		this.y = gridY;

		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);
		const margin = getMargin(this.lineWidth);

		const xOffset = hexWidth * 0.75;
		const yOffset = hexHeight * 0.5;
		const x = this.x * xOffset + (hexWidth / 2) - 30 + margin;
		const y = this.y * hexHeight + ((this.x % 2) * yOffset) + (hexHeight / 2) - 30 + margin;

		this.svg.setAttribute('x', x);
		this.svg.setAttribute('y', y);
	}

	move(gridX, gridY) {
      this.moved = true;

      const startHex = this.hexGrid.getHex(this.x, this.y);
      const endHex = this.hexGrid.getHex(gridX, gridY);
      const path = this.hexGrid.findPath(startHex, endHex, this);

      if (path) {
          trigger('unitMoving', { unit: this, path: path });
      }
	}

	attack(attackers) {
		attackers.forEach(a => {
			a.attacked = true;
		});

		const defender = this;
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

		if (effect.attacker === -1) {
			if (attackers.length > 1) {
				this.gameState.attackers = attackers;
				this.gameState.unassignedDamagePoints = 1;
				this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ATTACKER_DAMAGE);
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

	takeDamage() {
		if (this.healthStatus === HealthStatus.FULL) {
			this.healthStatus = HealthStatus.REDUCED;
		}
		else if (this.healthStatus === HealthStatus.REDUCED) {
			this.healthStatus = HealthStatus.DEAD;
		}			
	}

	isDead() {
		return this.healthStatus === HealthStatus.DEAD;
	}

	refreshStatusIndicator() {
		const reducedRect = this.baseRect.querySelector('.reduced');
		reducedRect.setAttribute('display', this.healthStatus === HealthStatus.FULL ? 'none' : "block");
	}

	refreshStatusText() {
		const attack = this.healthStatus === HealthStatus.FULL 
			? UnitProperties[this.unitType].attackStrength
			: UnitProperties[this.unitType].reducedAttackStrength

		const defend = this.healthStatus === HealthStatus.FULL 
			? UnitProperties[this.unitType].defendStrength
			: UnitProperties[this.unitType].reducedDefendStrength

		this.baseRect.querySelector('.health').textContent = 
			attack + "-" +
			defend + "-" +
			UnitProperties[this.unitType].movementAllowance;
	}

	isValidMove(gridX, gridY) {
		return this.hexGrid.getHex(gridX, gridY).highlighted;
	}

	remove() {
		const unitLayer = this.hexGrid.svg.querySelector('#unitLayer');
		unitLayer.removeChild(this.svg);
		this.hexGrid.units = this.hexGrid.units.filter(u => u !== this);
	}
}
