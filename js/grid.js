import { Hex } from './hex.js';
import { Unit } from './unit.js';
import { TerrainType, UnitProperties, MaxMovementPointCost, TerrainProperties, SpecialPhaseType, GameStatus, PlayerType } from './constants.js';
import { getAnotherPlayer, getAdjacentHexes } from './utils.js';

export class HexGrid {
    constructor(rows, cols, scenarioMap, gameState, isEditor = false) {
        this.hexes = [];
        this.units = [];
        this.rows = rows;
        this.cols = cols;
        this.scenarioMap = scenarioMap;
        this.gameState = gameState;
        this.isEditor = isEditor;
        this.hexMap = new Map();

        this.initialize();
    }

    initialize() {
        const mapData = this._preprocessMapData();

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if ((row === this.rows - 1) && (col % 2 === 1)) {
                    continue;
                }
                
                const hex = this._initializeHex(col, row, mapData);
                this.hexes.push(hex);
            }
        }
        this.hexes.forEach(hex => this.hexMap.set(`${hex.x},${hex.y}`, hex));
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

    _initializeHex(col, row, mapData) {
        const hex = new Hex(col, row, this, this.isEditor);
        const mapHexData = mapData.get(`${col},${row}`) || {};

        hex.setTerrain(mapHexData.terrain || TerrainType.CLEAR);
        hex.owner = mapHexData.owner;

        // Handle old format
        if (mapHexData.flag) {
            hex.setTerrain(TerrainType.FLAG);
            hex.owner = mapHexData.player;
        }

        hex.setRiverEdges(mapHexData.riverEdges || []);
        hex.setRoads(mapHexData.roads || [false, false, false, false, false, false]);

        if (mapHexData.unit) {
            const unitInfo = typeof mapHexData.unit === 'string' ? { unitType: mapHexData.unit, player: mapHexData.player } : mapHexData.unit;
            const newUnit = new Unit(col, row, unitInfo.unitType, unitInfo.player);
            this.addUnit(newUnit);
            hex.setUnit(newUnit);
        }

        return hex;
    }

    isRiverBetween(hexA, hexB) {
        const dx = hexB.x - hexA.x;
        const dy = hexB.y - hexA.y;

        const offsetsOddRow = [ [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0] ];
        const offsetsEvenRow = [ [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1] ];
        const offsets = hexA.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        const edgeIndexA = offsets.findIndex(offset => offset[0] === dx && offset[1] === dy);
        if (edgeIndexA === -1) return false;

        const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
        const edgeIndexB = oppositeEdgeMap[edgeIndexA];

        return hexA.riverEdges.includes(edgeIndexA) || hexB.riverEdges.includes(edgeIndexB);
    }

    isRoadBetween(hexA, hexB) {
        const dx = hexB.x - hexA.x;
        const dy = hexB.y - hexA.y;

        const offsetsOddRow = [ [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0] ];
        const offsetsEvenRow = [ [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1] ];
        const offsets = hexA.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        const edgeIndexA = offsets.findIndex(offset => offset[0] === dx && offset[1] === dy);
        if (edgeIndexA === -1) {
            return false;
        }

        const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
        const edgeIndexB = oppositeEdgeMap[edgeIndexA];

        const result = hexA.roads[edgeIndexA] || hexB.roads[edgeIndexB];
        return result;
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
    }

    isEmpty(x, y) {
        return !this.units.some(unit => unit.x === x && unit.y === y) && this.hexes.some(hex => hex.x === x && hex.y === y && hex.isEmpty);
    }

    getAdjacentEmptyHexesRecursion(x, y, currentDepth, maxDepth) {
        const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols).filter(ah => this.isEmpty(ah.x, ah.y));
        var allAdjacentHexes = [...adjacentHexes];

        if (currentDepth < maxDepth) {
            for(const adjacentHex of adjacentHexes) {
                const adjacentHexesRecursion = this.getAdjacentEmptyHexesRecursion(adjacentHex.x, adjacentHex.y, currentDepth + 1, maxDepth).filter(ah => !(ah.x == x && ah.y == y));
                allAdjacentHexes.push(...adjacentHexesRecursion);
            }
        }

        if (currentDepth === 1 && maxDepth > 1) {
            allAdjacentHexes = Array.from(new Set(allAdjacentHexes.map(JSON.stringify)), JSON.parse);
        }

        return allAdjacentHexes;
    }

    dfs(x, y, movementPoints, visited, reachableHexes, fromX, fromY, cameFrom, gScore, startX, startY) {
        const currentHex = this.getHex(x, y);
        if (!currentHex) {
            return;
        }

        const hasPrevHex = fromX !== undefined && fromY !== undefined;

        let cost;
        if (hasPrevHex) {
            const prevHex = this.getHex(fromX, fromY);
            const isOccupied = this.units.some(unit => unit.x === x && unit.y === y);
            if (isOccupied) {
                cost = MaxMovementPointCost;
            } else {
                const roadCondition = this.isRoadBetween(prevHex, currentHex);
                if (roadCondition) {
                    cost = 0.5;
                } else {
                    cost = TerrainProperties[currentHex.terrainType].movementPointCost;
                    if (this.isRiverBetween(prevHex, currentHex)) {
                        cost += 1;
                    }
                }
            }
        } else {
            cost = 0; // Start node
        }

        if (movementPoints < cost) {
            return;
        }

        const remainingPoints = movementPoints - cost;

        const existingVisit = visited.find(v => v.x === x && v.y === y);
        if (existingVisit && existingVisit.movementPoints >= remainingPoints) {
            return; // Found a worse or same-cost path, prune.
        }

        if (existingVisit) {
            existingVisit.movementPoints = remainingPoints;
        } else {
            visited.push({ x: x, y: y, movementPoints: remainingPoints });
        }

        if (hasPrevHex) {
            cameFrom.set(currentHex, this.getHex(fromX, fromY));
        }

        if (hasPrevHex) {
            gScore.set(currentHex, (gScore.get(this.getHex(fromX, fromY)) || 0) + cost);
        } else {
            gScore.set(currentHex, 0);
        }

        if (x !== startX || y !== startY) {
            if (!reachableHexes.some(rh => rh.x === x && rh.y === y)) {
                reachableHexes.push({ x: x, y: y });
            }
        }

        if (remainingPoints > 0) {
            const isCurrentHexInZoc = this.isHexInEnemyZoc(currentHex, this.gameState.activePlayer);
            if (!hasPrevHex || !isCurrentHexInZoc) {
                const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols);
                adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, remainingPoints, visited, reachableHexes, x, y, cameFrom, gScore, startX, startY));
            }
        }
    }

    getReachableHex(x, y, movementPoints) {
        const reachableHexes = [];
        const visited = [];
        const cameFrom = new Map();
        const gScore = new Map();
      
        this.dfs(x, y, movementPoints, visited, reachableHexes, undefined, undefined, cameFrom, gScore, x, y);
                
        return { reachableHexes, cameFrom, gScore };
    }

    findPath(start, end, movingUnit) {
        const movementAllowance = movingUnit.getEffectiveMovement();
        const { cameFrom, gScore } = this.getReachableHex(start.x, start.y, movementAllowance);

        if (Array.from(cameFrom.keys()).some(key => key.x === end.x && key.y === end.y)) {
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

        const hex = this.getHex(unit.x, unit.y);
        if (hex) {
            hex.removeUnit();
        }
    }

    getHex(x, y) {
        return this.hexMap.get(`${x},${y}`);
    }

    getNeighborIndex(hexA, hexB) {
        const dx = hexB.x - hexA.x;
        const dy = hexB.y - hexA.y;

        const offsetsOddRow = [ [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0] ];
        const offsetsEvenRow = [ [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1] ];
        const offsets = hexA.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        return offsets.findIndex(offset => offset[0] === dx && offset[1] === dy);
    }

    getNeighbor(hex, direction) {
        const offsetsOddRow = [ [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0] ];
        const offsetsEvenRow = [ [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1] ];
        const offsets = hex.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        const [dx, dy] = offsets[direction];
        const neighborX = hex.x + dx;
        const neighborY = hex.y + dy;

        return this.getHex(neighborX, neighborY);
    }

    clearSelections() {
        this.gameState.selectUnit(null);
    }

    clearUnitMovedAttacked() {
        this.units.forEach(u => {
            u.moved = false;
            u.attacked = false;
            u.advanced = false;
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
            if (!this.units.some(u => u.player == getAnotherPlayer(player))) {
                return player;
            }

            const flagHex = this.hexes.find(h => h.terrainType === TerrainType.FLAG && h.owner == getAnotherPlayer(player));
            if (flagHex && this.units.some(u => u.x === flagHex.x && u.y === flagHex.y && u.player === player)) {
                return player;
            }
        }

        return null;
    }

    removeDeadUnits() {
        const deadUnits = this.units.filter(u => u.isDead());
        deadUnits.forEach(u => this.removeUnit(u));
        return deadUnits;
    }

    startSpecialPhase(specialPhase) {
        if (this.gameState.status === GameStatus.ENDED) return;
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.attackers.every(a => a.isDead())) {
                this.endSpecialPhase();
            }
        }
    }

    endSpecialPhase() {
        this.gameState.shiftSpecialPhaseQueue();
        this.startSpecialPhase(this.gameState.getCurrentSpecialPhase());
    }
}