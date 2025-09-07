import { Hex } from './hex.js';
import { Unit } from './unit.js';
import { TerrainType, UnitProperties, MaxMovementPointCost, TerrainProperties, SpecialPhaseType, GameStatus, PlayerType } from './constants.js';
import { getHexWidth, getHexHeight, getAnotherPlayer, getMargin, getAdjacentHexes } from './utils.js';

export class HexGrid {
    constructor(rows, cols, scenarioMap, hexRadius, lineWidth, gameState, isEditor = false, svgService, animationService = null) {
        this.hexes = [];
        this.units = [];
        this.svg = null;
        this.rows = rows;
        this.cols = cols;
        this.scenarioMap = scenarioMap;
        this.hexRadius = hexRadius;
        this.lineWidth = lineWidth;
        this.selectedUnits = [];
        this.gameState = gameState;
        this.isEditor = isEditor;
        this.svgService = svgService;
        this.animationService = animationService;
    }

    async drawHexGrid() {
        const { hexGrid, hexLayer, riverLayer, unitLayer } = this._createLayers();
        const mapData = this._preprocessMapData();

        this.svg = hexGrid;

        hexGrid.appendChild(hexLayer);
        hexGrid.appendChild(riverLayer);
        hexGrid.appendChild(unitLayer);

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if ((row === this.rows - 1) && (col % 2 === 1)) {
                    continue;
                }
                
                const hex = this._initializeHex(col, row, mapData);
                const position = this._calculateHexPosition(col, row);

                hex.svg.setAttribute('x', position.x);
                hex.svg.setAttribute('y', position.y);

                this.hexes.push(hex);
                hexLayer.appendChild(hex.svg);
            }
        }

        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const totalWidth = (this.cols * hexWidth * 0.75) + (hexWidth * 0.25) + 5;
        const totalHeight = (this.rows * hexHeight) + (hexHeight * 0.5);

        this.redrawAllRivers();

        hexGrid.setAttribute('width', totalWidth);
        hexGrid.setAttribute('height', totalHeight);
    }

    _createLayers() {
        const hexGrid = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hexGrid.setAttribute('id', 'hexGrid');
        const hexLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hexLayer.setAttribute('id', 'hexLayer');
        const riverLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        riverLayer.setAttribute('id', 'riverLayer');
        const unitLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        unitLayer.setAttribute('id', 'unitLayer');
        return { hexGrid, hexLayer, riverLayer, unitLayer };
    }

    _preprocessMapData() {
        const mapData = new Map();
        if (Array.isArray(this.scenarioMap.mapHexes)) {
            this.scenarioMap.mapHexes.forEach(hex => {
                mapData.set(`${hex.x},${hex.y}`, hex);
            });
        }
        return mapData;
    }

    _calculateHexPosition(col, row) {
        const hexWidth = getHexWidth(this.hexRadius);
        const xOffset = hexWidth * 0.75;
        const x = col * xOffset;
        const hexHeight = getHexHeight(this.hexRadius);
        const yOffset = hexHeight * 0.5;
        const y = row * hexHeight + ((col % 2) * yOffset);
        return { x, y };
    }

    _initializeHex(col, row, mapData) {
        const hex = new Hex(col, row, this.hexRadius, this.lineWidth, this, this.isEditor);
        const mapHexData = mapData.get(`${col},${row}`) || {};

        hex.setTerrain(mapHexData.terrain || TerrainType.CLEAR);
        hex.setFlag(mapHexData.flag, mapHexData.player);
        hex.setRiverEdges(mapHexData.riverEdges || []);

        if (mapHexData.unit) {
            const svgElement = this.svgService.svgElements[mapHexData.unit + ".svg"].cloneNode(true);
            const newUnit = new Unit(col, row, mapHexData.unit, svgElement, mapHexData.player, this.hexRadius, this.lineWidth, this, this.gameState, this.animationService);
            newUnit.createUnit();
            this.addUnit(newUnit);
            hex.setUnit(newUnit);
        }

        return hex;
    }

    _drawRivers(riverLayer, riverEdges, position) {
        const {x, y} =  this.getHexPosition(position);

        riverEdges.forEach(riverEdge => {
            const riverSvg = this._drawRiver(getHexWidth(this.hexRadius) / 2 + x, getHexHeight(this.hexRadius) / 2 + y, riverEdge);
            riverLayer.appendChild(riverSvg);
        });
    }
    
    _drawRiver(x, y, edge) {
        function calculateHexEdgePoints(x, y, radius, startVertex) {
            const startAngle = (Math.PI / 3) * startVertex;
            const endAngle = (Math.PI / 3) * (startVertex + 1);

            return [
                (x + radius * Math.cos(startAngle)),
                (y + radius * Math.sin(startAngle)),
                (x + radius * Math.cos(endAngle)),
                (y + radius * Math.sin(endAngle))
            ]
        }

        const points = calculateHexEdgePoints(x, y, this.hexRadius, edge);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', points[0]);
        line.setAttribute('y1', points[1]);
        line.setAttribute('x2', points[2]);
        line.setAttribute('y2', points[3]);
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#80c0ff');
        line.setAttribute('stroke-width', 10);
        line.setAttribute('pointer-events', 'none');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(line);

        return line;
    }

    isRiverBetween(hexA, hexB) {
        const dx = hexB.x - hexA.x;
        const dy = hexB.y - hexA.y;

        const offsetsOddRow = [
            [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]
        ];

        const offsetsEvenRow = [
            [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];

        const offsets = hexA.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        const edgeIndexA = offsets.findIndex(offset => offset[0] === dx && offset[1] === dy);

        if (edgeIndexA === -1) {
            return false; // Not adjacent
        }

        const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
        const edgeIndexB = oppositeEdgeMap[edgeIndexA];

        const sideAHasRiver = hexA.riverEdges.includes(edgeIndexA);
        const sideBHasRiver = hexB.riverEdges.includes(edgeIndexB);

        return sideAHasRiver || sideBHasRiver;
    }

    isHexInEnemyZoc(hex, player) {
        const adjacentHexes = getAdjacentHexes(hex.x, hex.y, this.rows, this.cols);
        const enemyPlayer = getAnotherPlayer(player);

        for (const adjHex of adjacentHexes) {
            const unit = this.units.find(u => u.x === adjHex.x && u.y === adjHex.y);
            if (unit && unit.player === enemyPlayer) {
                const targetHex = this.getHex(adjHex.x, adjHex.y);
                if (!this.isRiverBetween(hex, targetHex)) {
                    return true;
                }
            }
        }
        return false;
    }

    addUnit(unit) {
        this.units.push(unit);

        const unitLayer = this.svg.querySelector('#unitLayer');
        unitLayer.appendChild(unit.svg);
    }

    isEmpty(x, y) {
        return !this.units.some(unit => unit.x === x && unit.y === y) && this.hexes.some(hex => hex.x === x && hex.y === y && hex.isEmpty);
    }

    clearHighlightedHexes() {
        for(const highlightedHex of this.hexes.filter(hex => hex.highlighted)) {
            highlightedHex.toggleInnerHex(false);
        }
    }

    highlightAdjacentEnemyHexes(selectedUnits) {
        this.clearHighlightedHexes();

        let adjacentEnemyHexes = [];

        selectedUnits.forEach((su, index) => {
            const hexes = getAdjacentHexes(su.x, su.y, this.rows, this.cols)
                .filter(ah => this.units.some(unit => unit.x === ah.x && unit.y === ah.y && unit.player != this.gameState.activePlayer))
                .map(ah => this.hexes.find(h => h.x === ah.x && h.y === ah.y))

                index == 0 ? 
                    adjacentEnemyHexes.push(...hexes) : 
                    adjacentEnemyHexes = adjacentEnemyHexes.filter(value => hexes.includes(value));
        })

        for(const adjacentHex of adjacentEnemyHexes) {
            for(const hex of this.hexes) {
                if (adjacentHex.x == hex.x && adjacentHex.y == hex.y) {
                    hex.toggleInnerHex(true);
                }
            }
        }
    }

    highlightReachableEmptyHexes(x, y, unitType) {
        const { reachableHexes } = this.getReachableHex(x, y, UnitProperties[unitType].movementAllowance); 

        for(const adjacentHex of reachableHexes) {
            for(const hex of this.hexes) {
                if (adjacentHex.x == hex.x && adjacentHex.y == hex.y) {
                    hex.toggleInnerHex();
                }
            }
        }
    }

    getAdjacentEmptyHexesRecursion(x, y, currentDepth, maxDepth) {
        const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols).filter(ah => this.isEmpty(ah.x, ah.y));
        var allAdjacentHexes = [...adjacentHexes];

        if (currentDepth < maxDepth) {
            for(const adjacentHex of adjacentHexes) {
                const adjacentHexesRecursion =
                    this.getAdjacentEmptyHexesRecursion(adjacentHex.x, adjacentHex.y, currentDepth + 1, maxDepth)
                    .filter(ah => !(ah.x == x && ah.y == y));

                allAdjacentHexes.push(...adjacentHexesRecursion);
            }
        }

        if (currentDepth === 1 && maxDepth > 1)
        {
            allAdjacentHexes = Array.from(new Set(allAdjacentHexes.map(JSON.stringify)), JSON.parse);
        }

        return allAdjacentHexes;
    }

    dfs(x, y, movementPoints, visited, reachableHexes, fromX, fromY, cameFrom, gScore) {
        const currentHex = this.getHex(x, y);
        const isCurrentHexInZoc = this.isHexInEnemyZoc(currentHex, this.gameState.activePlayer);

        const existingVisitIndex = visited.findIndex(v => v.x === x && v.y === y);
        const existingVisit = existingVisitIndex !== -1 ? visited[existingVisitIndex] : null;

        if (existingVisit) {
            const isExistingPathInZoc = existingVisit.isCurrentHexInZoc;
            
            if (isExistingPathInZoc && isCurrentHexInZoc && existingVisit.movementPoints >= movementPoints) {
                return;
            }
            else if (!isCurrentHexInZoc && !isExistingPathInZoc && existingVisit.movementPoints >= movementPoints) {
                return;
            }
        }

        let cost = !this.units.some(unit => unit.x === x && unit.y === y)
            ? TerrainProperties[currentHex.terrainType].movementPointCost
            : MaxMovementPointCost;

        const hasPrevHex = fromX !== undefined && fromY !== undefined;
        if (hasPrevHex) {
            const fromHex = this.getHex(fromX, fromY);
            if (this.isRiverBetween(fromHex, currentHex)) {
                cost += 1;
            }
        }

        if (movementPoints < cost) {
            if (!existingVisit) {
                visited.push({ x: x, y: y, movementPoints: movementPoints, isCurrentHexInZoc: isCurrentHexInZoc });
            }
            return;
        }

        const newVisitEntry = { x: x, y: y, movementPoints: movementPoints, isCurrentHexInZoc: isCurrentHexInZoc };
        if (existingVisit) {
            visited[existingVisitIndex] = newVisitEntry;
        } else {
            visited.push(newVisitEntry);
        }

        if (!reachableHexes.some(rh => rh.x === x && rh.y === y)) {
            reachableHexes.push({ x: x, y: y });
        }

        if (hasPrevHex) {
            const prevHex = this.getHex(fromX, fromY);
            cameFrom.set(currentHex, prevHex);
            gScore.set(currentHex, (gScore.get(prevHex) || 0) + cost);
        } else {
            gScore.set(currentHex, 0);
        }

        const remainingPoints = movementPoints - cost;

        if (remainingPoints > 0 && !isCurrentHexInZoc) {
            const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols);
            adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, remainingPoints, visited, reachableHexes, x, y, cameFrom, gScore));
        }
    }

    getReachableHex(x, y, movementPoints) {
        const reachableHexes = [];
        const visited = [];
        const cameFrom = new Map();
        const gScore = new Map();
      
        visited.push({x: x, y: y, movementPoints: movementPoints});
      
        const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols);
        adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, movementPoints, visited, reachableHexes, x, y, cameFrom, gScore));
                
        return { reachableHexes, cameFrom, gScore };
    }

    findPath(start, end, movingUnit) {
        const movementAllowance = UnitProperties[movingUnit.unitType].movementAllowance;
        const { cameFrom, gScore } = this.getReachableHex(start.x, start.y, movementAllowance);

        if (cameFrom.has(end)) {
            return this.reconstructPath(cameFrom, end);
        }

        return null; 
    }

    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            totalPath.unshift(current);
        }
        return totalPath;
    }

    removeUnit(unit) {
        const index = this.units.indexOf(unit);
        if (index > -1) {
            this.units.splice(index, 1);
        }
        const unitLayer = this.svg.querySelector('#unitLayer');
        if (unit.svg && unitLayer.contains(unit.svg)) {
            unitLayer.removeChild(unit.svg);
        }
        const hex = this.getHex(unit.x, unit.y);
        if (hex) {
            hex.removeUnit();
        }
    }

    getHex(x, y) {
        return this.hexes.find(h => h.x === x && h.y === y);
    }

    getUnitPosition(hex) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const xOffset = hexWidth * 0.75;
        const yOffset = hexHeight * 0.5;

        const x = hex.x * xOffset + (hexWidth / 2) - 30 + margin;
        const y = hex.y * hexHeight + ((hex.x % 2) * yOffset) + (hexHeight / 2) - 30 + margin;
        return { x, y };
    }

    getHexPosition(hex) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const xOffset = hexWidth * 0.75;
        const yOffset = hexHeight * 0.5;

        const x = hex.x * xOffset;
        const y = hex.y * hexHeight + ((hex.x % 2) * yOffset);
        return { x, y };
    }

    redrawAllRivers() {
        const riverLayer = this.svg.querySelector('#riverLayer');
        if (!riverLayer) return;

        // Clear existing rivers
        riverLayer.innerHTML = '';

        const margin = getMargin(this.lineWidth);

        // Iterate over all hexes that are responsible for storing river data
        this.hexes.forEach(hex => {
            if (hex.riverEdges && hex.riverEdges.length > 0) {
                const { x, y } = this.getHexPosition(hex);
                const hexCenterX = getHexWidth(this.hexRadius) / 2 + x + margin;
                const hexCenterY = getHexHeight(this.hexRadius) / 2 + y + margin;

                hex.riverEdges.forEach(edgeIndex => {
                    const riverSvg = this._drawRiver(hexCenterX, hexCenterY, edgeIndex);
                    riverLayer.appendChild(riverSvg);
                });
            }
        });
    }

    clearSelections() {
        this.selectedUnits.forEach(su => su.selected = false)
        this.selectedUnits = [];

        this.refreshUnitSelectRects();
    }

    refreshUnitDimmers() {
        this.units.forEach(u => u.refreshDimmer());
    }

    refreshUnitSelectRects() {
        this.units.forEach(u => u.refreshSelectRect());
    }

    clearUnitMovedAttacked() {
        this.units.forEach(u => {
            u.moved = false;
            u.attacked = false;
            u.advanced = false;
            u.refreshDimmer();
        });
    }

    checkWinningConditions() {
        const winner = this.getWinner();

        if (winner != null) {
            this.gameState.status = GameStatus.ENDED;
            this.gameState.setWinner(winner);
        }
    }

    getWinner() {
        for (const player of Object.values(PlayerType)) {
            if (!this.units.some(u => u.player == getAnotherPlayer(player)))
            {
                return player;
            }

            const flagHex = this.hexes.find(h => h.flag != null && h.player == getAnotherPlayer(player));
            if (flagHex && this.units.some(u => u.x === flagHex.x && u.y === flagHex.y && u.player === player)) {
                return player;
            }
        }

        return null;
    }

    removeDeadUnits() {
        [...this.units]
                .filter(u => u.isDead())
                .forEach(u => u.remove());
    }

    startSpecialPhase(specialPhase) {
        if (this.gameState.status === GameStatus.ENDED) {
            return;
        }
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.attackers.every(a => a.isDead())) {
                this.endSpecialPhase();
            }
            else {
                this.clearHighlightedHexes();
                this.gameState.vacatedHex.toggleInnerHex(true);
                this.refreshUnitDimmers();
            }
        }
    }

    endSpecialPhase() {
        if(this.gameState.getCurrentSpecialPhase() === SpecialPhaseType.ADVANCE) {
            this.clearHighlightedHexes();
            this.clearSelections();
        }

        this.gameState.shiftSpecialPhaseQueue();

        this.refreshUnitDimmers();
        this.startSpecialPhase(this.gameState.getCurrentSpecialPhase());
    }
}
