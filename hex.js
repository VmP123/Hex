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
			const svgWidth = hexWidth + margin * 2;
			const svgHeight = hexHeight + margin * 2;
			hexSvg.setAttribute('width', svgWidth);
			hexSvg.setAttribute('height', svgHeight);
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
			this.hexGrid.gameState.selectedUnits.length > 0 && 
			this.hexGrid.gameState.selectedUnits[0].isValidMove(this.x, this.y)) {
			const selectedUnit = this.hexGrid.gameState.selectedUnits[0];
			await selectedUnit.move(this.x, this.y);
			this.hexGrid.gameState.selectUnit(null, false);

			if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
				this.hexGrid.endSpecialPhase();
			}

			this.hexGrid.checkWinningConditions();
		}
	}

		getClosestSide(clickX, clickY) {
		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);
		const margin = getMargin(this.lineWidth);
		const hexCenterX = (hexWidth * 0.5) + margin;
		const hexCenterY = (hexHeight * 0.5) + margin;

		const vertices = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i;
			vertices.push({
				x: hexCenterX + this.hexRadius * Math.cos(angle),
				y: hexCenterY + this.hexRadius * Math.sin(angle)
			});
		}

		let minDistanceSq = Infinity;
		let closestSideIndex = -1;

		for (let i = 0; i < 6; i++) {
			const p1 = vertices[i];
			const p2 = vertices[(i + 1) % 6];
			
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			
			const distSq = Math.pow(clickX - midX, 2) + Math.pow(clickY - midY, 2);
			
			if (distSq < minDistanceSq) {
				minDistanceSq = distSq;
				closestSideIndex = i;
			}
		}
		
		// closestSideIndex is the internal side index (0=top-right, 1=top, etc.)
		// This is the value toggleRiver expects.
		return closestSideIndex;
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

		if (terrainType === TerrainType.MOUNTAIN || terrainType === TerrainType.FOREST || terrainType === TerrainType.SWAMP || terrainType === TerrainType.WATER || terrainType === TerrainType.CITY) {
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
				case TerrainType.CITY:
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
		// Remove existing flag
		const existingFlag = this.svg.querySelector('[data-flag]');
		if (existingFlag) {
			this.svg.removeChild(existingFlag);
		}

		if (value === undefined || value === null || player === undefined || player === null || value === false) {
            this.flag = null;
            this.player = null;
			return;
        }

		this.isEmpty = true;
		this.flag = value;
		this.player = player;

		const svgService = new SvgService();
		const flagSvgElement = svgService.svgElements['flag.svg'].cloneNode(true);
		flagSvgElement.setAttribute('data-flag', 'true'); // for easy selection

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

    const offsetsOddRow = [
        [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]
    ];

    const offsetsEvenRow = [
        [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    const offsets = this.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

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
			} else {
				// River does not exist, add it
				this.riverEdges.push(edgeIndex);
				// Ensure opposite edge is not stored on other hex
				const otherIndex = adjacentHex.riverEdges.indexOf(oppositeEdge);
				if (otherIndex > -1) {
					adjacentHex.riverEdges.splice(otherIndex, 1);
				}
			}
		} else {
			// Adjacent hex stores the river
			const index = adjacentHex.riverEdges.indexOf(oppositeEdge);
			if (index > -1) {
				// River exists, remove it
				adjacentHex.riverEdges.splice(index, 1);
			} else {
				// River does not exist, add it
				adjacentHex.riverEdges.push(oppositeEdge);
				// Ensure opposite edge is not stored on this hex
				const thisIndex = this.riverEdges.indexOf(edgeIndex);
				if (thisIndex > -1) {
					this.riverEdges.splice(thisIndex, 1);
				}
			}
		}

		this.hexGrid.redrawAllRivers();
	}
}
