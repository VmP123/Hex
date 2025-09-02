import { Unit } from './Unit.js';
import { SvgService } from './SvgService.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { GameState } from './state.js';

async function initGame() {
    const svg = document.getElementById('main');
    const infoAreaSvg = document.getElementById('info-area');
    const hexRadius = 50;
    const numCols = 20;
    const numRows = 20;
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
    });

    const infoArea = new InfoArea(gameState, hexGrid);
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

    svg.addEventListener('dblclick', () => {
        isZoomedOut = !isZoomedOut;
        const oldViewBoxString = svg.getAttribute('viewBox');

        const oldViewBox = oldViewBoxString.split(' ').map(parseFloat);
        if (oldViewBox.length < 4) return;

        const [oldX, oldY, oldWidth, oldHeight] = oldViewBox;

        const centerX = oldX + oldWidth / 2;
        const centerY = oldY + oldHeight / 2;

        let newWidth, newHeight;
        if (isZoomedOut) {
            newWidth = mapWidth + margin * 2;
            newHeight = mapHeight + margin * 2;
        } else {
            newWidth = 1024;
            newHeight = 880;
        }

        const newX = centerX - newWidth / 2;
        const newY = centerY - newHeight / 2;

        const minX = -margin;
        const minY = -margin;
        const maxX = mapWidth - newWidth + margin;
        const maxY = mapHeight - newHeight + margin;

        const clampedX = clamp(newX, minX, maxX);
        const clampedY = clamp(newY, minY, maxY);

        svg.setAttribute('viewBox', `${clampedX} ${clampedY} ${newWidth} ${newHeight}`);
    });

    window.addEventListener('mouseup', endPan);
    svg.addEventListener('mouseleave', endPan);

    // --- Scaling Logic ---

    const gameWrapper = document.getElementById('game-wrapper');
    const baseWidth = 1424;
    const baseHeight = 880;
    const marginHorizontal = 10; // 50px margin on each side
    const marginVertical = 10; // 50px margin on top and bottom

    function resizeGame() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const availableWidth = viewportWidth - marginHorizontal * 2;
        const availableHeight = viewportHeight - marginVertical * 2;

        const scaleX = availableWidth / baseWidth;
        const scaleY = availableHeight / baseHeight;

        const scale = Math.min(scaleX, scaleY);

        gameWrapper.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', resizeGame);
    resizeGame(); // Initial resize
}

window.onload = initGame;
