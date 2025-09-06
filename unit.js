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
			(this.hexGrid.selectedUnits.length === 0 || this.hexGrid.selectedUnits[0] === this)) {
				this.handleAdvanceSelection();
		}

		else if (this.gameState.currentTurnPhase === TurnPhase.ATTACK && currentSpecialPhase === null) {
			this.handleAttackPhaseSelection();
		}

		else if (this.gameState.currentTurnPhase === TurnPhase.MOVE && currentSpecialPhase === null &&
			(this.hexGrid.selectedUnits.length === 0 || this.hexGrid.selectedUnits[0] === this) && 
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
		if (!this.hexGrid.selectedUnits.includes(this)) {
			this.hexGrid.selectedUnits.push(this);
		}
		else {
			this.hexGrid.selectedUnits = this.hexGrid.selectedUnits.filter(u => u !== this);
		}

		this.selected = !this.selected;
		this.refreshSelectRect();
	}

	handleAttackPhaseSelection() {
		if (this.player === this.gameState.activePlayer && !this.attacked) {
			if (!this.hexGrid.selectedUnits.includes(this)) {
				this.hexGrid.selectedUnits.push(this);
			}
			else {
				this.hexGrid.selectedUnits = this.hexGrid.selectedUnits.filter(u => u !== this);
			}

			this.selected = !this.selected;
			this.refreshSelectRect();

			this.hexGrid.highlightAdjacentEnemyHexes(this.hexGrid.selectedUnits);
		}
		else if (this.hexGrid.getHex(this.x, this.y).highlighted){
			const attackers = this.hexGrid.selectedUnits;
			this.attack(attackers);
		}
	}

	handleMovePhaseSelection() {
		this.selected = !this.selected;
		this.hexGrid.selectedUnits = this.selected ? [this] : [];
		this.refreshSelectRect();

		this.hexGrid.highlightReachableEmptyHexes(this.x, this.y, this.unitType);
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

	async move(gridX, gridY) {
      this.gameState.isAnimating = true;

      const startHex = this.hexGrid.getHex(this.x, this.y);
      const endHex = this.hexGrid.getHex(gridX, gridY);
      const path = this.hexGrid.findPath(startHex, endHex, this);

      if (path) {
          await this.animationService.animateUnit(this, path, this.hexGrid);
      }

      this.x = gridX;
      this.y = gridY;
      this.updatePosition(this.x, this.y);
		
      if (this.gameState.currentTurnPhase === TurnPhase.MOVE) {
        this.moved = true;
      }
      else if (this.gameState.currentSpecialPhase === SpecialPhaseType.ADVANCE) {
        this.advanced = true;
      }
      
      this.refreshDimmer();
          this.gameState.isAnimating = false;
	}

	attack(attackers) {
		attackers.forEach(a => {
			a.attacked = true;
		});

		const defenderHex = this.hexGrid.getHex(this.x, this.y);

		const attackStrengthSum = attackers.reduce(
			(total, su) => {
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
			}, 0
		);

		const defendStrength = this.healthStatus === HealthStatus.FULL 
			? UnitProperties[this.unitType].defendStrength
			: UnitProperties[this.unitType].reducedDefendStrength;

		let crtColumn = [...CombatResultsTable].reverse().find(crtv => crtv.ratio <= (attackStrengthSum/defendStrength)) || CombatResultsTable[0];

		const defenderTerrain = defenderHex.terrainType;
		const crtShift = TerrainProperties[defenderTerrain]?.defenderCrtShift || 0;

		if (crtShift !== 0) {
			const currentIndex = CombatResultsTable.indexOf(crtColumn);
			const newIndex = currentIndex + crtShift;

			if (newIndex >= 0 && newIndex < CombatResultsTable.length) {
				crtColumn = CombatResultsTable[newIndex];
			} else if (newIndex < 0) {
				crtColumn = CombatResultsTable[0];
			} else {
				crtColumn = CombatResultsTable[CombatResultsTable.length - 1];
			}
		}

		const d6Value = Math.floor(Math.random() * 6) + 1;
					
		this.gameState.setCombatResult(crtColumn, d6Value);
		
		const crtResult = crtColumn[d6Value];
		const effect = CombatResultTableValueEffect[crtResult];

		if (effect.attacker === -1) {
			if (attackers.length > 1) {
				this.gameState.attackers = attackers;
				this.gameState.unassignedDamagePoints = 1;
				this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ATTACKER_DAMAGE);
			}
			else {
				const attacker = attackers[0];

				if (attacker.healthStatus === HealthStatus.FULL) {
					attacker.healthStatus = HealthStatus.REDUCED;
				}
				else if (attacker.healthStatus === HealthStatus.REDUCED) {
					attacker.healthStatus = HealthStatus.DEAD;
				}	

				attacker.refreshStatusIndicator();
				attacker.refreshStatusText();
			}
		}

		if (effect.defender === -1) {
			if (this.healthStatus === HealthStatus.FULL) {
				this.healthStatus = HealthStatus.REDUCED;
			}
			else if (this.healthStatus === HealthStatus.REDUCED) {
				this.healthStatus = HealthStatus.DEAD;
			}
		}
		else if (effect.defender === -2) {
			this.healthStatus = HealthStatus.DEAD;
		}

		if (this.healthStatus === HealthStatus.DEAD) {
			this.gameState.vacatedHex = this.hexGrid.getHex(this.x, this.y);
			this.gameState.attackers = attackers;
			this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ADVANCE);
		}

		this.refreshStatusIndicator();
		this.refreshStatusText();

		this.hexGrid.selectedUnits.forEach(su => su.selected = false);
		this.hexGrid.selectedUnits = [];

		this.hexGrid.clearHighlightedHexes();
		this.hexGrid.removeDeadUnits();
		this.hexGrid.checkWinningConditions();
		this.hexGrid.refreshUnitSelectRects();
		this.hexGrid.refreshUnitDimmers();

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
