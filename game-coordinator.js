import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus, TurnPhase, PlayerType, SpecialPhaseType } from './constants.js';
import { trigger } from './state.js';
import { ViewController } from './view-controller.js';
import { GameEngine } from './game-engine.js'; // Import GameEngine

class Game {
    constructor() {
        this.svg = document.getElementById('main');
        this.infoAreaSvg = document.getElementById('info-area');
        this.hexRadius = 50;
        this.lineWidth = 2;

        this.svgService = null;
        this.scenarioMap = null;
        this.gameState = null;
        this.animationService = null;
        this.hexGrid = null;
        this.viewController = null;
        this.infoArea = null;
        this.gameEngine = null; // Add gameEngine property
    }

    async init() {
        this.svgService = new SvgService();
        await this.svgService.load();

        this.scenarioMap = new ScenarioMap();
        await this.scenarioMap.load("map01.json");

        this.gameState = new GameState();
        this.gameState.status = GameStatus.GAMEON;
        this.animationService = new AnimationService(this.gameState);

        this.hexGrid = new HexGrid(this.scenarioMap.height, this.scenarioMap.width, this.scenarioMap, this.hexRadius, this.lineWidth, this.gameState, false, this.svgService, this.animationService);
        await this.hexGrid.drawHexGrid();

        this.svg.appendChild(this.hexGrid.svg);

        // Pass gameEngine to hexes' clickHandler
        this.gameEngine = new GameEngine(this.hexGrid); // Instantiate GameEngine
        this.hexGrid.gameEngine = this.gameEngine; // Provide grid with a reference to gameEngine

        this.hexGrid.hexes.forEach(hex => {
            hex.svg.addEventListener('click', () => {
                if (this.viewController.panned) {
                    return;
                }
                // Hex click handler will now call gameEngine
                // For now, hex.clickHandler() will be modified later to call gameEngine
                hex.clickHandler(); 
            });
        });

        const mapWidth = parseFloat(this.hexGrid.svg.getAttribute('width'));
        const mapHeight = parseFloat(this.hexGrid.svg.getAttribute('height'));
        this.viewController = new ViewController(this.svg, mapWidth, mapHeight, this.gameState);
        this.hexGrid.viewController = this.viewController; // Provide grid with a reference to viewController
        this.viewController.hexGrid = this.hexGrid; // Provide viewController with a reference to grid

        this.infoArea = new InfoArea(this.gameState, this.hexGrid, this.viewController.zoom.bind(this.viewController));
        this.infoArea.draw();
        this.infoAreaSvg.appendChild(this.infoArea.svg);

        this.viewController.setViewBox(0, 0, 1024, 880);

        this.setupResizeListener();
    }

    // endCurrentPhase method will be removed from here and called on gameEngine
    // selectUnit method will be removed from here and called on gameEngine

    setupResizeListener() {
        const gameWrapper = document.getElementById('game-wrapper');
        const baseWidth = 1424;
        const baseHeight = 880;
        const outerMargin = 25;

        const resizeGame = () => {
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
}

window.onload = () => {
    window.game = new Game();
    window.game.init();
};