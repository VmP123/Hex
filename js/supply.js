import { TerrainProperties, MaxMovementPointCost, PlayerType } from './constants.js';
import { getAdjacentHexes } from './utils.js';

export class Supply {
    constructor(hexGrid) {
        this.hexGrid = hexGrid;
    }

    /**
     * Determines all hexes that are in supply for a given player.
     * @param {string} player - The player (e.g., PlayerType.GREY).
     * @param {Object} scenario - The scenario object containing map details.
     * @returns {Set<Hex>} A set of all hex objects that are supplied.
     */
    getSuppliedHexes(player, scenario) {
        const suppliedHexes = new Set();
        const queue = [];
        const visited = new Set();

        // 1. Find all supply sources
        const sources = this._getSupplySources(player, scenario);

        // 2. Initialize queue and visited set with sources
        for (const sourceHex of sources) {
            if (sourceHex && !visited.has(sourceHex)) {
                queue.push(sourceHex);
                visited.add(sourceHex);
            }
        }

        // 3. Perform BFS
        while (queue.length > 0) {
            const currentHex = queue.shift();
            suppliedHexes.add(currentHex);

            const neighbors = getAdjacentHexes(currentHex.x, currentHex.y, this.hexGrid.rows, this.hexGrid.cols)
                .map(coord => this.hexGrid.getHex(coord.x, coord.y))
                .filter(Boolean); // Filter out null hexes

            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) {
                    continue;
                }

                if (this._isSupplyPathBlocked(neighbor, player)) {
                    continue;
                }

                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        return suppliedHexes;
    }

    /**
     * Checks if a supply line can pass through a given hex.
     * @param {Hex} hex - The hex to check.
     * @param {string} player - The player for whom supply is being calculated.
     * @returns {boolean} - True if the path is blocked, false otherwise.
     * @private
     */
    _isSupplyPathBlocked(hex, player) {
        // 1. Impassable terrain always blocks.
        if (TerrainProperties[hex.terrainType].movementPointCost >= MaxMovementPointCost) {
            return true;
        }

        const isZocFromGrey = this.hexGrid.isHexInEnemyZoc(hex, PlayerType.GREEN);
        const isZocFromGreen = this.hexGrid.isHexInEnemyZoc(hex, PlayerType.GREY);

        // 2. Handle empty hexes
        if (hex.unit === null) {
            // New rule: Empty hex in dual ZoC blocks for everyone.
            if (isZocFromGrey && isZocFromGreen) {
                return true;
            }
            // Standard rule: Empty hex in a single enemy ZoC blocks for that enemy.
            if (player === PlayerType.GREY && isZocFromGreen) {
                return true;
            }
            if (player === PlayerType.GREEN && isZocFromGrey) {
                return true;
            }
            // If empty and not in a blocking ZoC, it's clear.
            return false;
        }
        
        // 3. Handle occupied hexes
        else {
            // Supply can't path through an enemy unit.
            if (hex.unit.player !== player) {
                return true;
            }
            // It's a friendly unit. The original rule states a friendly unit negates enemy ZoC for supply.
            // So, if the hex is occupied by a friendly unit, the path is NEVER blocked by ZoC.
            return false;
        }
    }

    /**
     * Gets all supply source hexes for a given player.
     * @param {string} player - The player.
     * @param {Object} scenario - The scenario object.
     * @returns {Hex[]} An array of hexes that are supply sources.
     * @private
     */
    _getSupplySources(player, scenario) {
        const sources = [];
        const { width, supplyCities } = scenario;
    
        // 1. Player's home edge
        const homeEdgeX = (player === PlayerType.GREY) ? 0 : width - 1;
        for (let y = 0; y < this.hexGrid.rows; y++) {
            const edgeHex = this.hexGrid.getHex(homeEdgeX, y);
            if (edgeHex && !this._isSupplyPathBlocked(edgeHex, player)) {
                sources.push(edgeHex);
            }
        }
    
        // 2. Map-specific supply cities
        if (supplyCities && supplyCities[player]) {
            for (const cityCoord of supplyCities[player]) {
                const cityHex = this.hexGrid.getHex(cityCoord.x, cityCoord.y);
                if (cityHex && cityHex.owner === player) {
                    sources.push(cityHex);
                }
            }
        }
        
        return sources;
    }
}