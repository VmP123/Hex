import { TerrainType, ColorByPlayer, GameStatus, TurnPhase, SpecialPhaseType } from './Constants.js';
import { SvgService } from './svg-service.js';
import { getHexWidth, getHexHeight, getMargin, getAdjacentHexes } from './utils.js';

export class Hex {
	constructor(x, y, hexRadius, lineWidth, hexGrid, isEditor = false) {
		this.x = x;
		this.y = y;
		this.hexRadius = hexRadius;
		this.lineWidth = lineWidth;
		this.hexGrid = hexGrid;
		this.highlighted = false;
		this.terrainType = null;
		this.isEmpty = true;
		this.riverEdges = [];
		this.flag = null;
		this.isEditor = isEditor;
		this.svg = this.draxHexSvg();
	}

	// TODO: Siirretään tämä erilliseen SvgServiceen
	draxHexSvg() {
			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);
			const hexCenterX = (hexWidth * 0.5) + margin;
			const hexCenterY = (hexHeight * 0.5) + margin;

			const baseHex = this.createBaseHex(hexCenterX, hexCenterY, this.hexRadius);
			const innerHex = this.createInnerHex(hexCenterX, hexCenterY, this.hexRadius - 5);

			const hexSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			hexSvg.appendChild(baseHex);
			hexSvg.appendChild(innerHex);

			return hexSvg;
	}

	createBaseHex(x, y, radius) {
			const baseHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
			baseHex.setAttribute('class', 'hex baseHex');
			baseHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
			baseHex.setAttribute('fill', '#ffffff'); // #698B4F
			baseHex.setAttribute('stroke', 'black');
			baseHex.setAttribute('stroke-width', this.lineWidth);
			return baseHex;
	}

	createInnerHex(x, y, radius) {
			const innerHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
			innerHex.setAttribute('class', 'hex innerHex');
			innerHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
			innerHex.setAttribute('fill', 'none');
			innerHex.setAttribute('stroke', 'black');
			innerHex.setAttribute('stroke-width', this.lineWidth);
			innerHex.setAttribute('stroke-dasharray', '12 5');
			innerHex.setAttribute('display', 'none');
			return innerHex;
	}

	calculateHexPoints(x, y, radius) {
			const points = [];
			for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
					points.push((x + radius * Math.cos(angle)) + "," + (y + radius * Math.sin(angle)));
			}
			return points.join(" ");
	}

	async clickHandler() {
		if (this.hexGrid.gameState.status !== GameStatus.GAMEON || this.hexGrid.gameState.isAnimating) {
			return;
		}

		const currentSpecialPhase = this.hexGrid.gameState.getCurrentSpecialPhase();

		if ((this.hexGrid.gameState.currentTurnPhase == TurnPhase.MOVE || currentSpecialPhase === SpecialPhaseType.ADVANCE) && 
			this.hexGrid.selectedUnits.length > 0 && 
			this.hexGrid.selectedUnits[0].isValidMove(this.x, this.y)) {
			const selectedUnit = this.hexGrid.selectedUnits[0];
			selectedUnit.select();
			await selectedUnit.move(this.x, this.y);

			if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
				this.hexGrid.endSpecialPhase();
			}

			this.hexGrid.checkWinningConditions();
		}
	}

	toggleInnerHex(value) {
		const innerHex = this.svg.querySelector('.innerHex');
		if (value === undefined || value === null) {
			this.highlighted = !this.highlighted;
		}
		else {
			this.highlighted = value;
		}

		innerHex.setAttribute('display', this.highlighted ? 'block' : 'none');
	}

	setTerrain(terrainType) {
		// Remove existing terrain
		const existingTerrain = this.svg.querySelector('[data-terrain]');
		if (existingTerrain) {
			this.svg.removeChild(existingTerrain);
		}

		this.terrainType = terrainType;
		this.isEmpty = true;

		if (terrainType === TerrainType.MOUNTAIN || terrainType === TerrainType.FOREST || terrainType === TerrainType.SWAMP || terrainType === TerrainType.WATER) {
			this.isEmpty = false;
			const svgService = new SvgService();
			const terrainSvgElement = svgService.svgElements[terrainType + '.svg'].cloneNode(true);
			terrainSvgElement.setAttribute('data-terrain', terrainType); // Add data attribute for easy selection

			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);

			let x, y, width, height;

			switch (terrainType) {
				case TerrainType.MOUNTAIN:
					x = (hexWidth / 2) - 37 + margin;
					y = (hexHeight / 2) - 35 + margin;
					break;
				case TerrainType.FOREST:
				case TerrainType.SWAMP:
				case TerrainType.WATER:
					x = (hexWidth / 2) - 40 + margin;
					y = (hexHeight / 2) - 45 + margin;
					width = 80;
					height = 80;
					break;
			}

			terrainSvgElement.setAttribute('x', x);
			terrainSvgElement.setAttribute('y', y);
			if (width && height) {
				terrainSvgElement.setAttribute('width', width);
				terrainSvgElement.setAttribute('height', height);
			}

			this.svg.appendChild(terrainSvgElement);
		}
	}

	setFlag(value, player) {
		if (value === undefined || value === null || player === undefined || player === null)
			return;

		this.isEmpty = true;
		this.flag = value;
		this.player = player;

		const svgService = new SvgService();
		const flagSvgElement = svgService.svgElements['flag.svg'].cloneNode(true);

		const flagColor = flagSvgElement.querySelector('.flagColor');
		flagColor.setAttribute('fill', ColorByPlayer[player]);

		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);
		const margin = getMargin(this.lineWidth);

		const x = (hexWidth / 2) - 37 + margin - 10;
		const y = (hexHeight / 2) - 35 + margin;

		flagSvgElement.setAttribute('x', x);
		flagSvgElement.setAttribute('y', y);

		this.svg.appendChild(flagSvgElement);
	}

	setRiverEdges(riverEdges) {
		this.riverEdges = riverEdges;
	}

	setUnit(unit) {
		this.unit = unit;
		this.isEmpty = false;
	}

	removeUnit() {
		this.unit = null;
		this.isEmpty = true;
	}

	createEdge(x, y, radius, edgeIndex) {
		const edge = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		const points = this.calculateHexPoints(x, y, radius);
		const p1 = points.split(' ')[edgeIndex];
		const p2 = points.split(' ')[(edgeIndex + 1) % 6];
		const p_center = `${x},${y}`;

		edge.setAttribute('points', `${p1} ${p2} ${p_center}`);
		edge.setAttribute('fill', 'transparent');
		edge.setAttribute('stroke', 'none');
		edge.setAttribute('data-edge-index', edgeIndex);
		return edge;
	}

	toggleRiver(edgeIndex) {
		// Get the correct offsets for the current hex's x-coordinate
		const offsets = this.x % 2 === 0 ? [
			[0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1] // Even row offsets
		] : [
			[0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0] // Odd row offsets
		];

		// Calculate the coordinates of the adjacent hex based on the edgeIndex
		const [dx, dy] = offsets[edgeIndex];
		const adjacentX = this.x + dx;
		const adjacentY = this.y + dy;

		// Check if the adjacent hex is within bounds
		const isWithinGridBounds = (x, y) =>
			x >= 0 &&
			x < this.hexGrid.cols &&
			y >= 0 &&
			y < this.hexGrid.rows &&
			!((y === this.hexGrid.rows - 1) && (x % 2 === 1)); // This condition is for the last row odd columns

		if (!isWithinGridBounds(adjacentX, adjacentY)) {
			return; // No adjacent hex on this edge (at map boundary)
		}

		const adjacentHex = this.hexGrid.getHex(adjacentX, adjacentY);
		if (!adjacentHex) {
			return; // Should not happen if getAdjacentHexes is correct and hexGrid.getHex works
		}

		const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
		const oppositeEdge = oppositeEdgeMap[edgeIndex];

		// Rule: the hex with the smaller x, or smaller y if x is equal, stores the river
		const thisHexShouldStore = this.x < adjacentHex.x || (this.x === adjacentHex.x && this.y < adjacentHex.y);

		if (thisHexShouldStore) {
			// This hex stores the river
			const index = this.riverEdges.indexOf(edgeIndex);
			if (index > -1) {
				// River exists, remove it
				this.riverEdges.splice(index, 1);
				// Also remove from adjacent hex if it somehow got there (defensive)
				const otherIndex = adjacentHex.riverEdges.indexOf(oppositeEdge);
				if (otherIndex > -1) {
					adjacentHex.riverEdges.splice(otherIndex, 1);
					adjacentHex.drawRivers();
				}
			} else {
				// River does not exist, add it
				this.riverEdges.push(edgeIndex);
				// Remove from adjacent hex if it exists there (to ensure single storage)
				const otherIndex = adjacentHex.riverEdges.indexOf(oppositeEdge);
				if (otherIndex > -1) {
					adjacentHex.riverEdges.splice(otherIndex, 1);
					adjacentHex.drawRivers();
				}
			}
		} else {
			// Adjacent hex stores the river
			const index = adjacentHex.riverEdges.indexOf(oppositeEdge);
			if (index > -1) {
				// River exists, remove it
				adjacentHex.riverEdges.splice(index, 1);
				// Also remove from this hex if it somehow got there (defensive)
				const thisIndex = this.riverEdges.indexOf(edgeIndex);
				if (thisIndex > -1) {
					this.riverEdges.splice(thisIndex, 1);
				}
			} else {
				// River does not exist, add it
				adjacentHex.riverEdges.push(oppositeEdge);
				// Remove from this hex if it exists there (to ensure single storage)
				const thisIndex = this.riverEdges.indexOf(edgeIndex);
				if (thisIndex > -1) {
					this.riverEdges.splice(thisIndex, 1);
				}
			}
			adjacentHex.drawRivers(); // Redraw adjacent hex
		}

		this.drawRivers(); // Redraw this hex
	}

	handleEdgeClick = (e) => {
		e.stopPropagation();
		const edgeIndex = parseInt(e.target.getAttribute('data-edge-index'), 10);
		this.toggleRiver(edgeIndex);
	}

	addRiverEdgeEventListeners() {
		this.svg.querySelectorAll('[data-edge-index]').forEach(edge => {
			edge.addEventListener('click', this.handleEdgeClick);
		});
	}

	removeRiverEdgeEventListeners() {
		this.svg.querySelectorAll('[data-edge-index]').forEach(edge => {
			edge.removeEventListener('click', this.handleEdgeClick);
		});
	}

	drawRivers() {
		// remove existing rivers
		this.svg.querySelectorAll('[data-river]').forEach(r => this.svg.removeChild(r));

		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);
		const margin = getMargin(this.lineWidth);
		const x = (hexWidth / 2) + margin;
		const y = (hexHeight / 2) + margin;

		this.riverEdges.forEach(edgeIndex => {
			const riverSvg = this.hexGrid.drawRiver(x, y, edgeIndex);
			riverSvg.setAttribute('data-river', true);
			this.svg.appendChild(riverSvg);
		});
	}
}
