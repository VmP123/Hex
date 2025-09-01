import { Unit } from './Unit.js';
import { SvgService } from './SvgService.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';

async function initGame() {
    const svg = document.getElementById('main');
    const hexRadius = 50;
    const numCols = 13;
    const numRows = 9;
    const lineWidth = 2;

    const svgService = new SvgService();
    await svgService.load();

    const scenarioMap = new ScenarioMap();
    await scenarioMap.load("map01.json");

    const gameState = new GameState();

    const hexGrid = new HexGrid(numRows, numCols, scenarioMap, hexRadius, lineWidth, gameState);
    await hexGrid.drawHexGrid();

    svg.appendChild(hexGrid.svg);

    scenarioMap.mapHexes.filter(mh => mh.unit !== null && mh.unit !== undefined).forEach(mh => {
        const svgElement = svgService.svgElements[mh.unit + ".svg"];
        const unit = new Unit(mh.x , mh.y, mh.unit, svgElement.cloneNode(true), mh.player, hexRadius, lineWidth, hexGrid, gameState);
        unit.createUnit();
        hexGrid.addUnit(unit);
    })

    const infoArea = new InfoArea(gameState, hexGrid);
    infoArea.draw();
    svg.appendChild(infoArea.svg);
}

window.onload = initGame;
