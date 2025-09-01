export class ScenarioMap {
    constructor() {
        this.mapHexes = [];
    }

    async load(mapFile){
        try {
            const response = await fetch(mapFile);

            if (!response.ok) {
                throw new Error('Tiedoston lataaminen epäonnistui');
            }

            const jsonData = await response.json();

            this.mapHexes = jsonData.map((hexData) => {
                const mapHex = new MapHex();
                mapHex.x = hexData.x;
                mapHex.y = hexData.y;
                mapHex.terrain = hexData.terrain;
                mapHex.unit = hexData.unit;
                mapHex.player = hexData.player;
                mapHex.riverEdges = hexData.riverEdges;
                mapHex.flag = hexData.flag;
                return mapHex;
            });
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
    }
}
