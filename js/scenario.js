import { PlayerType } from './constants.js';

export class ScenarioMap {
    constructor() {
        this.mapHexes = [];
        this.width = 0;
        this.height = 0;
        this.startingPlayer = PlayerType.GREY;
        this.player1SupplyEdges = {};
        this.player2SupplyEdges = {};
        this.supplyCities = [];
    }

    createEmptyMap(rows, cols) {
        this.width = cols;
        this.height = rows;
        this.mapHexes = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const mapHex = new MapHex();
                mapHex.x = x;
                mapHex.y = y;
                this.mapHexes.push(mapHex);
            }
        }
    }

    async load(mapFile){
        try {
            const response = await fetch(mapFile);

            if (!response.ok) {
                throw new Error('Tiedoston lataaminen epäonnistui');
            }

            const jsonData = await response.json();

            this.mapHexes = jsonData.hexList.map((hexData) => {
                const mapHex = new MapHex();
                mapHex.x = hexData.x;
                mapHex.y = hexData.y;
                mapHex.terrain = hexData.terrain;
                mapHex.unit = hexData.unit;
                mapHex.player = hexData.player;
                mapHex.riverEdges = hexData.riverEdges;
                mapHex.flag = hexData.flag;
                mapHex.owner = hexData.owner;
                mapHex.roads = hexData.roads || [false, false, false, false, false, false];
                return mapHex;
            });
            this.width = jsonData.width;
            this.height = jsonData.height;
            this.startingPlayer = jsonData.startingPlayer || PlayerType.GREY;
            this.player1SupplyEdges = jsonData.player1SupplyEdges || {};
            this.player2SupplyEdges = jsonData.player2SupplyEdges || {};
            this.supplyCities = jsonData.supplyCities || [];

            return this;

        } catch (error) {
            console.error('Virhe karttatiedoston lataamisessa:', error.message);
            return null;
        }
    }
}

class MapHex {
    constructor() {
        this.x = null;
        this.y = null;
        this.terrain = null;
        this.unit = null;
        this.player = null;
        this.riverEdges = null;
        this.owner = null;
        this.roads = null;
    }
}
