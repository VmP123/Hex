import { TerrainType, ColorByPlayer, GameStatus, TurnPhase, SpecialPhaseType } from './Constants.js';
import { SvgService } from './SvgService.js';
import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class Hex {
	constructor(x, y, hexRadius, lineWidth, hexGrid) {
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

	clickHandler() {
		if (this.hexGrid.gameState.status !== GameStatus.GAMEON) {
			return;
		}

		const currentSpecialPhase = this.hexGrid.gameState.getCurrentSpecialPhase();

		if ((this.hexGrid.gameState.currentTurnPhase == TurnPhase.MOVE || currentSpecialPhase === SpecialPhaseType.ADVANCE) && 
			this.hexGrid.selectedUnits.length > 0 && 
			this.hexGrid.selectedUnits[0].isValidMove(this.x, this.y)) {
			const selectedUnit = this.hexGrid.selectedUnits[0];
			selectedUnit.select();
			selectedUnit.move(this.x, this.y);

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
		this.terrainType = terrainType;

		if (terrainType == TerrainType.MOUNTAIN) {
			this.isEmpty = false;

			const svgService = new SvgService();
			const mountainSvgElement = svgService.svgElements['mountain.svg'].cloneNode(true);

			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);

			const x = (hexWidth / 2) - 37 + margin;
			const y = (hexHeight / 2) - 35 + margin;

			mountainSvgElement.setAttribute('x', x);
			mountainSvgElement.setAttribute('y', y);

			this.svg.appendChild(mountainSvgElement);
		}

		if (terrainType == TerrainType.FOREST) {
			const svgService = new SvgService();
			const forestSvgElement = svgService.svgElements['forest.svg'].cloneNode(true);

			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);

			const x = (hexWidth / 2) - 40 + margin;
			const y = (hexHeight / 2) - 45 + margin;

			forestSvgElement.setAttribute('x', x);
			forestSvgElement.setAttribute('y', y);
			forestSvgElement.setAttribute('width', 80);
			forestSvgElement.setAttribute('height', 80);

			this.svg.appendChild(forestSvgElement);
		}

		if (terrainType == TerrainType.SWAMP) {
			const svgService = new SvgService();
			const swampSvgElement = svgService.svgElements['swamp.svg'].cloneNode(true);

			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);

			const x = (hexWidth / 2) - 40 + margin;
			const y = (hexHeight / 2) - 45 + margin;

			swampSvgElement.setAttribute('x', x);
			swampSvgElement.setAttribute('y', y);
			swampSvgElement.setAttribute('width', 80);
			swampSvgElement.setAttribute('height', 80);

			this.svg.appendChild(swampSvgElement);
		}

		if (terrainType == TerrainType.WATER) {
			const svgService = new SvgService();
			const waterSvgElement = svgService.svgElements['water.svg'].cloneNode(true);

			const hexWidth = getHexWidth(this.hexRadius);
			const hexHeight = getHexHeight(this.hexRadius);
			const margin = getMargin(this.lineWidth);

			const x = (hexWidth / 2) - 40 + margin;
			const y = (hexHeight / 2) - 45 + margin;

			waterSvgElement.setAttribute('x', x);
			waterSvgElement.setAttribute('y', y);
			waterSvgElement.setAttribute('width', 80);
			waterSvgElement.setAttribute('height', 80);

			this.svg.appendChild(waterSvgElement);
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
}
