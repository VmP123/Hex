import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { HexGridView } from './grid-view.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus, TurnPhase, PlayerType, SpecialPhaseType } from './constants.js';
import { trigger } from './state.js';
import { ViewController } from './view-controller.js';

import { GameEngine } from './engine.js';

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
        this.hexGridView = null;
        this.viewController = null;
        this.infoArea = null;
        this.gameEngine = null;
    }

    async init() {
        this.svgService = new SvgService();
        await this.svgService.load();

        this.scenarioMap = new ScenarioMap();
        await this.scenarioMap.load("map01.json");

        this.gameState = new GameState();
        this.gameState.status = GameStatus.GAMEON;

        this.hexGrid = new HexGrid(this.scenarioMap.height, this.scenarioMap.width, this.scenarioMap, this.gameState, false);
        this.hexGridView = new HexGridView(this.hexGrid, this.hexRadius, this.lineWidth, this.gameState, false, this.svgService);
        await this.hexGridView.drawHexGrid();

        this.animationService = new AnimationService(this.gameState, this.hexGridView);
        this.hexGridView.animationService = this.animationService;

        this.gameEngine = new GameEngine(this.gameState, this.hexGrid);

        this.svg.appendChild(this.hexGridView.svg);

        const mapWidth = parseFloat(this.hexGridView.svg.getAttribute('width'));
        const mapHeight = parseFloat(this.hexGridView.svg.getAttribute('height'));
        this.viewController = new ViewController(this.svg, mapWidth, mapHeight, this.gameState);
        this.gameEngine.viewController = this.viewController;
        this.viewController.hexGridView = this.hexGridView;
        this.hexGridView.viewController = this.viewController;

        this.hexGridView.hexViews.forEach(hexView => {
            hexView.svg.addEventListener('click', () => {
                if (this.viewController.panned) {
                    return;
                }
                this.gameEngine.handleHexClick(hexView.hex);
            });
        });

        this.hexGridView.unitViews.forEach(unitView => {
            unitView.addClickHandler();
        });

        this.infoArea = new InfoArea(this.gameState, this.hexGridView, this.viewController.zoom.bind(this.viewController));
        this.infoArea.draw();
        this.infoAreaSvg.appendChild(this.infoArea.svg);

        this.viewController.setViewBox(0, 0, 1024, 880);

        this.setupResizeListener();
    }

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