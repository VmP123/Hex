import { HexGrid } from './grid.js';
import { GameState } from './state.js';
import { TerrainType, UnitType, PlayerType } from './constants.js';
import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { Unit } from './unit.js';

document.addEventListener('DOMContentLoaded', async () => {
    const svgService = new SvgService();
    await svgService.load();

    const hexRadius = 50;
    const lineWidth = 1;
    const gameState = new GameState();
    let hexGrid;
    const mainSvg = document.getElementById('main');

    async function drawMap(scenario) {
        mainSvg.innerHTML = '';
        hexGrid = new HexGrid(scenario.height, scenario.width, scenario, hexRadius, lineWidth, gameState, true);
        await hexGrid.drawHexGrid();
        mainSvg.appendChild(hexGrid.svg);

        hexGrid.hexes.forEach(hex => {
            hex.svg.addEventListener('click', (e) => onHexClick(hex, e));
        });

        const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
        const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));
        mainSvg.setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
    }

    const initialScenario = new ScenarioMap();
    initialScenario.createEmptyMap(10, 10);
    await drawMap(initialScenario);

    let selectedTerrain = null;
    let selectedUnit = null;
    let riverMode = false;

    const terrainPalette = document.getElementById('terrain-palette');
    for (const terrain in TerrainType) {
        const button = document.createElement('button');
        button.textContent = TerrainType[terrain];
        button.addEventListener('click', (e) => {
            selectedTerrain = TerrainType[terrain];
            selectedUnit = null;
            riverMode = false;
            updateSelectedPalette(e.target);
        });
        terrainPalette.appendChild(button);
    }

    const removeTerrainButton = document.createElement('button');
    removeTerrainButton.textContent = "Remove Terrain";
    removeTerrainButton.addEventListener('click', (e) => {
        selectedTerrain = TerrainType.CLEAR;
        selectedUnit = null;
        riverMode = false;
        updateSelectedPalette(e.target);
    });
    terrainPalette.appendChild(removeTerrainButton);

    const unitPalette = document.getElementById('unit-palette');
    for (const unit in UnitType) {
        const button = document.createElement('button');
        button.textContent = UnitType[unit];
        button.addEventListener('click', (e) => {
            selectedUnit = UnitType[unit];
            selectedTerrain = null;
            riverMode = false;
            updateSelectedPalette(e.target);
        });
        unitPalette.appendChild(button);
    }
    const removeUnitButton = document.createElement('button');
    removeUnitButton.textContent = "Remove Unit";
    removeUnitButton.addEventListener('click', (e) => {
        selectedUnit = 'remove';
        selectedTerrain = null;
        riverMode = false;
        updateSelectedPalette(e.target);
    });
    unitPalette.appendChild(removeUnitButton);

    const riverButton = document.createElement('button');
    riverButton.textContent = "Edit Rivers";
    riverButton.addEventListener('click', (e) => {
        riverMode = !riverMode;
        selectedTerrain = null;
        selectedUnit = null;
        updateSelectedPalette(e.target);

        if (riverMode) {
            hexGrid.hexes.forEach(hex => hex.addRiverEdgeEventListeners());
        } else {
            hexGrid.hexes.forEach(hex => hex.removeRiverEdgeEventListeners());
        }
    });
    terrainPalette.appendChild(riverButton);


    function updateSelectedPalette(selectedButton) {
        document.querySelectorAll('#terrain-palette button, #unit-palette button').forEach(button => {
            button.classList.remove('selected');
        });
        selectedButton.classList.add('selected');
    }

    function onHexClick(hex, event) {
        if (riverMode) {
            return; // handled by edge click
        }
        const player = document.getElementById('player-select').value === '0' ? PlayerType.GREY : PlayerType.GREEN;
        if (selectedTerrain) {
            hex.setTerrain(selectedTerrain);
        } else if (selectedUnit) {
            if (selectedUnit === 'remove') {
                if (hex.unit) {
                    hexGrid.removeUnit(hex.unit);
                }
            } else {
                if (hex.unit) {
                    hexGrid.removeUnit(hex.unit);
                }
                const svgElement = svgService.svgElements[selectedUnit + ".svg"].cloneNode(true);
                const newUnit = new Unit(hex.x, hex.y, selectedUnit, svgElement, player, hexRadius, lineWidth, hexGrid, gameState, null);
                newUnit.createUnit();
                hexGrid.addUnit(newUnit);
            }
        }
    }

    const exportButton = document.getElementById('export-map');
    exportButton.addEventListener('click', () => {
        const mapData = {
            width: hexGrid.cols,
            height: hexGrid.rows,
            hexList: hexGrid.hexes.map(hex => ({
                x: hex.x,
                y: hex.y,
                terrain: hex.terrainType,
                unit: hex.unit ? hex.unit.unitType : null,
                player: hex.unit ? hex.unit.player : null,
                riverEdges: hex.riverEdges,
                flag: hex.flag
            }))
        };
        const json = JSON.stringify(mapData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    const importInput = document.getElementById('import-map');
    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const mapData = JSON.parse(e.target.result);
                const newScenario = new ScenarioMap();
                newScenario.width = mapData.width;
                newScenario.height = mapData.height;
                newScenario.mapHexes = mapData.hexList;
                document.getElementById('rows').value = mapData.height;
                document.getElementById('cols').value = mapData.width;
                await drawMap(newScenario);
            };
            reader.readAsText(file);
        }
    });

    const setSizeButton = document.getElementById('set-size');
    setSizeButton.addEventListener('click', async () => {
        const rows = parseInt(document.getElementById('rows').value, 10);
        const cols = parseInt(document.getElementById('cols').value, 10);
        if (rows > 0 && cols > 0) {
            const newScenario = new ScenarioMap();
            newScenario.createEmptyMap(rows, cols);
            await drawMap(newScenario);
        }
    });

    // --- Panning and Zooming Logic ---
    let isPanning = false;
    let startX, startY;
    let startViewBox;
    const svg = mainSvg;

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
        if (!viewBoxString) return;

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

        const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
        const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));
        const margin = 100;

        const minX = -margin;
        const minY = -margin;
        const maxX = mapWidth - startViewBox[2] + margin;
        const maxY = mapHeight - startViewBox[3] + margin;

        const clampedX = clamp(newX, minX, maxX);
        const clampedY = clamp(newY, minY, maxY);

        svg.setAttribute('viewBox', `${clampedX} ${clampedY} ${startViewBox[2]} ${startViewBox[3]}`);
    });

    svg.addEventListener('dblclick', (e) => {
        const oldViewBoxString = svg.getAttribute('viewBox');
        if (!oldViewBoxString) return;
        const oldViewBox = oldViewBoxString.split(' ').map(parseFloat);
        if (oldViewBox.length < 4) return;

        const [oldX, oldY, oldWidth, oldHeight] = oldViewBox;

        const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
        const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));

        let newWidth, newHeight;

        if (oldWidth < mapWidth) { // If currently zoomed in, zoom out
            newWidth = mapWidth;
            newHeight = mapHeight;
        } else { // If currently zoomed out, zoom in
            newWidth = mapWidth / 2;
            newHeight = mapHeight / 2;
        }

        const rect = svg.getBoundingClientRect();
        const scaleX = oldWidth / rect.width;
        const scaleY = oldHeight / rect.height;

        const svgX = oldX + (e.clientX - rect.left) * scaleX;
        const svgY = oldY + (e.clientY - rect.top) * scaleY;

        const newX = svgX - newWidth / 2;
        const newY = svgY - newHeight / 2;

        const margin = 100;
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
});