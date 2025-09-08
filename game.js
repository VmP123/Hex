import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus, TurnPhase, PlayerType, SpecialPhaseType } from './constants.js';
import { trigger } from './state.js';
import { ViewController } from './view-controller.js';

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

        this.hexGrid.hexes.forEach(hex => {
            hex.svg.addEventListener('click', () => {
                if (this.viewController.panned) {
                    return;
                }
                hex.clickHandler()
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

    endCurrentPhase() {
        if (this.gameState.status !== GameStatus.GAMEON) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            this.hexGrid.endSpecialPhase();
        }
        else if (currentSpecialPhase === null) {
            if (this.gameState.currentTurnPhase == TurnPhase.MOVE) {
                this.gameState.currentTurnPhase = TurnPhase.ATTACK;
            }
            else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
                this.gameState.activePlayer = this.gameState.activePlayer == PlayerType.GREY
                    ? PlayerType.GREEN
                    : PlayerType.GREY;

                this.gameState.currentTurnPhase = TurnPhase.MOVE;
                this.gameState.setCombatResult(null, null);
                this.hexGrid.clearUnitMovedAttacked();
            }

            trigger('phaseChanged');

            this.hexGrid.clearHighlightedHexes();
            this.hexGrid.clearSelections();
            this.hexGrid.refreshUnitDimmers();
        }
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