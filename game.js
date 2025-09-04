import { Unit } from './unit.js';
import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus } from './constants.js';

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

        const hexGrid = new HexGrid(scenarioMap.height, scenarioMap.width, scenarioMap, hexRadius, lineWidth, gameState);
    await hexGrid.drawHexGrid();

    svg.appendChild(hexGrid.svg);

    scenarioMap.mapHexes.filter(mh => mh.unit !== null && mh.unit !== undefined).forEach(mh => {
        const svgElement = svgService.svgElements[mh.unit + ".svg"];
        const unit = new Unit(mh.x , mh.y, mh.unit, svgElement.cloneNode(true), mh.player, hexRadius, lineWidth, hexGrid, gameState, animationService);
        unit.createUnit();
        hexGrid.addUnit(unit);
    });

    const infoArea = new InfoArea(gameState, hexGrid, zoom);
    infoArea.draw();
    infoAreaSvg.appendChild(infoArea.svg);

    const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
    const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));
    svg.setAttribute('viewBox', `0 0 1024 880`);

    // --- Panning and Zooming Logic ---

    let isPanning = false;
    let startX, startY;
    let startViewBox;
    let isZoomedOut = false;
    let lastZoomInViewBox = null;

    const margin = 100;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }

    function endPan() {
        isPanning = false;
        svg.style.cursor = 'pointer';
    }

    svg.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const viewBoxString = svg.getAttribute('viewBox');

        const viewBox = viewBoxString.split(' ').map(parseFloat);
        if (viewBox.length < 4) return;

        isPanning = true;
        startViewBox = viewBox;
        startX = e.clientX;
        startY = e.clientY;
        svg.style.cursor = 'grabbing';
    });

    svg.addEventListener('mousemove', (e) => {
        if (!isPanning || !startViewBox) return;

        const rect = svg.getBoundingClientRect();
        const scaleX = startViewBox[2] / rect.width;
        const scaleY = startViewBox[3] / rect.height;

        const dx = (e.clientX - startX) * scaleX;
        const dy = (e.clientY - startY) * scaleY;

        const newX = startViewBox[0] - dx;
        const newY = startViewBox[1] - dy;
        
        const minX = -margin;
        const minY = -margin;
        const maxX = mapWidth - startViewBox[2] + margin;
        const maxY = mapHeight - startViewBox[3] + margin;

        const clampedX = clamp(newX, minX, maxX);
        const clampedY = clamp(newY, minY, maxY);

        svg.setAttribute('viewBox', `${clampedX} ${clampedY} ${startViewBox[2]} ${startViewBox[3]}`);
    });

    function zoom(clientX = null, clientY = null) {
        const oldViewBoxString = svg.getAttribute('viewBox');
        const oldViewBox = oldViewBoxString.split(' ').map(parseFloat);
        if (oldViewBox.length < 4) return;

        const [oldX, oldY, oldWidth, oldHeight] = oldViewBox;

        let newWidth, newHeight;
        let newX, newY;

        if (!isZoomedOut) { // If currently zoomed in (isZoomedOut is false), zoom out
            isZoomedOut = true;
            lastZoomInViewBox = oldViewBox; // Save current viewBox before zooming out
            newWidth = mapWidth + margin * 2;
            newHeight = mapHeight + margin * 2;
            newX = oldX + oldWidth / 2 - newWidth / 2; // Center on current view
            newY = oldY + oldHeight / 2 - newHeight / 2; // Center on current view
        } else { // If currently zoomed out (isZoomedOut is true), zoom in
            isZoomedOut = false;
            newWidth = 1024; // Default zoom-in width
            newHeight = 880; // Default zoom-in height

            if (clientX !== null && clientY !== null) { // Double-click zoom to point
                const rect = svg.getBoundingClientRect();
                const scaleX = oldWidth / rect.width;
                const scaleY = oldHeight / rect.height;

                const svgX = oldX + (clientX - rect.left) * scaleX;
                const svgY = oldY + (clientY - rect.top) * scaleY;

                newX = svgX - newWidth / 2;
                newY = svgY - newHeight / 2;
            } else if (lastZoomInViewBox) { // Button zoom to last saved location
                [newX, newY, newWidth, newHeight] = lastZoomInViewBox;
            } else { // Default zoom-in, center on current view
                newX = oldX + oldWidth / 2 - newWidth / 2;
                newY = oldY + oldHeight / 2 - newHeight / 2;
            }
        }

        const minX = -margin;
        const minY = -margin;
        const maxX = mapWidth - newWidth + margin;
        const maxY = mapHeight - newHeight + margin;

        const clampedX = clamp(newX, minX, maxX);
        const clampedY = clamp(newY, minY, maxY);

        svg.setAttribute('viewBox', `${clampedX} ${clampedY} ${newWidth} ${newHeight}`);
    }

    svg.addEventListener('dblclick', (e) => {
        zoom(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', endPan);
    svg.addEventListener('mouseleave', endPan);

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
