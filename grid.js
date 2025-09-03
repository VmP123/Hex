import { Hex } from './Hex.js';
import { TerrainType, UnitProperties, MaxMovementPointCost, TerrainProperties, SpecialPhaseType, GameStatus, PlayerType } from './Constants.js';
import { getHexWidth, getHexHeight, getAnotherPlayer, getMargin } from './utils.js';

export class HexGrid {
    constructor(rows, cols, scenarioMap, hexRadius, lineWidth, gameState) {
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
    }

    async drawHexGrid() {
        const { hexGrid, hexLayer, riverLayer, unitLayer } = this._createLayers();
        const mapData = this._preprocessMapData();

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

                const mapHexData = mapData.get(`${col},${row}`) || {};
                if (mapHexData.riverEdges && mapHexData.riverEdges.length > 0) {
                    this._drawRivers(riverLayer, mapHexData.riverEdges, position);
                }
            }
        }

        hexGrid.appendChild(hexLayer);
        hexGrid.appendChild(riverLayer);
        hexGrid.appendChild(unitLayer);

        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const totalWidth = (this.cols * hexWidth * 0.75) + (hexWidth * 0.25) + 5;
        const totalHeight = (this.rows * hexHeight) + (hexHeight * 0.5);

        hexGrid.setAttribute('width', totalWidth);
        hexGrid.setAttribute('height', totalHeight);

        this.svg = hexGrid;
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
        this.scenarioMap.mapHexes.forEach(hex => {
            mapData.set(`${hex.x},${hex.y}`, hex);
        });
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
        const hex = new Hex(col, row, this.hexRadius, this.lineWidth, this);
        const mapHexData = mapData.get(`${col},${row}`) || {};

        hex.setTerrain(mapHexData.terrain || TerrainType.CLEAR);
        hex.setFlag(mapHexData.flag, mapHexData.player);
        hex.setRiverEdges(mapHexData.riverEdges || []);

        hex.svg.addEventListener('click', () => hex.clickHandler());
        return hex;
    }

    _drawRivers(riverLayer, riverEdges, position) {
        riverEdges.forEach(riverEdge => {
            const riverSvg = this.drawRiver(getHexWidth(this.hexRadius) / 2 + 3.5, getHexHeight(this.hexRadius) / 2 + 3.5, riverEdge);
            riverSvg.setAttribute('x', position.x - 2);
            riverSvg.setAttribute('y', position.y - 2);
            riverLayer.appendChild(riverSvg);
        });
    }
    
    drawRiver(x, y, edge) {
        function calculateHexEdgePoints(x, y, radius, startVertex) {
            const startAngle = (Math.PI / 3) * startVertex;
            const endAngle = (Math.PI / 3) * (startVertex + 1);

            return [
                (x + radius * Math.cos(startAngle)) + "," + (y + radius * Math.sin(startAngle)),
                (x + radius * Math.cos(endAngle)) + "," + (y + radius * Math.sin(endAngle))
            ]
        }

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', calculateHexEdgePoints(x, y, 50, edge));
        polygon.setAttribute('fill', 'none');
        polygon.setAttribute('stroke', '#80c0ff');
        polygon.setAttribute('stroke-width', 7);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(polygon);

        return svg;
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
            const hexes = this.getAdjacentHexes(su.x, su.y)
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
        //const adjacentHexes = this.getAdjacentEmptyHexesRecursion(x, y, 1, UnitProperties[unitType].movementAllowance); // old
        const { reachableHexes } = this.getReachableHex(x, y, UnitProperties[unitType].movementAllowance); // new

        for(const adjacentHex of reachableHexes) {
            for(const hex of this.hexes) {
                if (adjacentHex.x == hex.x && adjacentHex.y == hex.y) {
                    hex.toggleInnerHex();
                }
            }
        }
    }

    getAdjacentEmptyHexesRecursion(x, y, currentDepth, maxDepth) {
        const adjacentHexes = this.getAdjacentHexes(x, y).filter(ah => this.isEmpty(ah.x, ah.y));
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
        if (visited.find(v => v.x === x && v.y === y && v.movementPoints >= movementPoints) != null) {
            return;
        }

        let cost = !this.units.some(unit => unit.x === x && unit.y === y)
            ? TerrainProperties[this.getHex(x, y).terrainType].movementPointCost
            : MaxMovementPointCost;

        if (fromX !== undefined && fromY !== undefined) {
            const fromHex = this.getHex(fromX, fromY);
            const currentHex = this.getHex(x, y);
            if (this.isRiverBetween(fromHex, currentHex)) {
                cost += 1;
            }
        }

        if (movementPoints < cost) {
            visited.push({ x: x, y: y, movementPoints: movementPoints });
            return;
        }

        visited.push({ x: x, y: y, movementPoints: movementPoints });

        if (!reachableHexes.some(rh => rh.x === x && rh.y === y)) {
            reachableHexes.push({ x: x, y: y });
        }

        // Store cameFrom and gScore for path reconstruction
        if (fromX !== undefined && fromY !== undefined) {
            const currentHex = this.getHex(x, y);
            const prevHex = this.getHex(fromX, fromY);
            cameFrom.set(currentHex, prevHex);
            gScore.set(currentHex, (gScore.get(prevHex) || 0) + cost);
        } else {
            // For the starting hex of the DFS
            const currentHex = this.getHex(x, y);
            gScore.set(currentHex, 0);
        }

        const remainingPoints = movementPoints - cost;
        const adjacentHexes = this.getAdjacentHexes(x, y);
        adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, remainingPoints, visited, reachableHexes, x, y, cameFrom, gScore));
    }

    getReachableHex(x, y, movementPoints) {
        const reachableHexes = [];
        const visited = [];
        const cameFrom = new Map();
        const gScore = new Map();
      
        visited.push({x: x, y: y, movementPoints: movementPoints});
      
        const adjacentHexes = this.getAdjacentHexes(x, y);
        adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, movementPoints, visited, reachableHexes, x, y, cameFrom, gScore));
                
        return { reachableHexes, cameFrom, gScore };
    }

    findPath(start, end, movingUnit) {
        // Get the movement allowance from the unit properties
        const movementAllowance = UnitProperties[movingUnit.unitType].movementAllowance;

        // Use getReachableHex to get the cameFrom map and gScore map
        const { cameFrom, gScore } = this.getReachableHex(start.x, start.y, movementAllowance);

        // Check if the end hex is reachable
        if (cameFrom.has(end)) {
            return this.reconstructPath(cameFrom, end);
        }

        return null; // No path found
    }

    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            totalPath.unshift(current);
        }
        return totalPath;
    }

    getAdjacentHexes(x, y) {
        const adjacentHexes = [];

        const isWithinGridBounds = (x, y) => 
            x >= 0 &&
            x < this.cols &&
            y >= 0 &&
            y < this.rows &&
            !((y == this.rows - 1) && (x % 2 == 1));

        const offsetsOddRow = [
            [0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]
        ];

        const offsetsEvenRow = [
            [0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1]
        ];

        const offsets = x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;
        const result = offsets.filter(([dx, dy]) => {
            return isWithinGridBounds(x + dx, y + dy);
        }).map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
        return result;
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
            if (this.units.some(u => u.x === flagHex.x && u.y === flagHex.y && u.player === player)) {
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
