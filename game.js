import { Unit } from './unit.js';
import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus } from './constants.js';

import { ViewController } from './view-controller.js';

async function initGame() {
    const svg = document.getElementById('main');
    const infoAreaSvg = document.getElementById('info-area');
    const hexRadius = 50;
    const lineWidth = 2;

    const svgService = new SvgService();
    await svgService.load();

    const scenarioMap = new ScenarioMap();
    await scenarioMap.load("map01.json");

    const gameState = new GameState();
    gameState.status = GameStatus.GAMEON;
    const animationService = new AnimationService();

    const hexGrid = new HexGrid(scenarioMap.height, scenarioMap.width, scenarioMap, hexRadius, lineWidth, gameState, false, svgService, animationService);
    await hexGrid.drawHexGrid();

    svg.appendChild(hexGrid.svg);

    hexGrid.hexes.forEach(hex => {
        hex.svg.addEventListener('click', () => {
            if (hexGrid.viewController.panned) {
                return;
            }
            hex.clickHandler()
        });
    });

    const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
    const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));
    const viewController = new ViewController(svg, mapWidth, mapHeight, gameState);
    hexGrid.viewController = viewController;
    hexGrid.viewController.hexGrid = hexGrid;

    const infoArea = new InfoArea(gameState, hexGrid, hexGrid.viewController.zoom.bind(hexGrid.viewController));
    infoArea.draw();
    infoAreaSvg.appendChild(infoArea.svg);

    hexGrid.viewController.setViewBox(0, 0, 1024, 880);

    // --- Scaling Logic ---

    const gameWrapper = document.getElementById('game-wrapper');
    const baseWidth = 1424;
    const baseHeight = 880;
    const outerMargin = 25;

    function resizeGame() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const availableWidth = viewportWidth - outerMargin * 2;
        const availableHeight = viewportHeight - outerMargin * 2;

        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;

        const scale = Math.min(scaleX, scaleY);

        gameWrapper.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', resizeGame);
    resizeGame(); // Initial resize
}

window.onload = initGame;
