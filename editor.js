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
  const lineWidth = 2; // Changed to match main application
  const gameState = new GameState();
  let hexGrid;
  const mainSvg = document.getElementById('main');
  
  let mapWidth;
  let mapHeight;
  
  let isPanning = false;
  let startX, startY;
  let startViewBox;
  let isZoomedOut = false;
  let lastZoomInViewBox = null;
  
  const margin = 100;
  
  function zoom(clientX = null, clientY = null) {
    const svg = mainSvg;
    
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
    console.log(svg.getAttribute('viewBox'));
  }
  
  async function drawMap(scenario) {
    mainSvg.innerHTML = '';
    hexGrid = new HexGrid(scenario.height, scenario.width, scenario, hexRadius, lineWidth, gameState, true);
    await hexGrid.drawHexGrid();
    mainSvg.appendChild(hexGrid.svg);
    
    hexGrid.hexes.forEach(hex => {
      hex.svg.addEventListener('click', (e) => onHexClick(hex, e));
    });
    
    mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
    mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));

    mainSvg.setAttribute('viewBox', `${-margin} ${-margin} ${baseWidth} ${baseHeight}`);
  }
  
  mainSvg.addEventListener('dblclick', (e) => {
    zoom(e.clientX, e.clientY);
  });
  
  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
  
  function endPan() {
    isPanning = false;
    mainSvg.style.cursor = 'pointer';
  }
  
  mainSvg.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click
    const viewBoxString = mainSvg.getAttribute('viewBox');
    if (!viewBoxString) return;
    
    const viewBox = viewBoxString.split(' ').map(parseFloat);
    if (viewBox.length < 4) return;
    
    isPanning = true;
    startViewBox = viewBox;
    startX = e.clientX;
    startY = e.clientY;
    mainSvg.style.cursor = 'grabbing';
  });
  
  mainSvg.addEventListener('mousemove', (e) => {
    if (!isPanning || !startViewBox) return;
    
    const rect = mainSvg.getBoundingClientRect();
    const scaleX = startViewBox[2] / rect.width;
    const scaleY = startViewBox[3] / rect.height;
    
    const dx = (e.clientX - startX) * scaleX;
    const dy = (e.clientY - startY) * scaleY;
    
    const newX = startViewBox[0] - dx;
    const newY = startViewBox[1] - dy;
    
    // Clamp panning to map boundaries (with some margin)
    const mapWidth = parseFloat(hexGrid.svg.getAttribute('width'));
    const mapHeight = parseFloat(hexGrid.svg.getAttribute('height'));
    const margin = 100; // Adjust as needed
    
    const minX = -margin;
    const minY = -margin;
    const maxX = mapWidth - startViewBox[2] + margin;
    const maxY = mapHeight - startViewBox[3] + margin;
    
    const clampedX = clamp(newX, minX, maxX);
    const clampedY = clamp(newY, minY, maxY);
    
    mainSvg.setAttribute('viewBox', `${clampedX} ${clampedY} ${startViewBox[2]} ${startViewBox[3]}`);
  });
  
  window.addEventListener('mouseup', endPan);
  mainSvg.addEventListener('mouseleave', endPan);
  
  
  // --- Scaling Logic (similar to game.js) ---
  const editorMapWrapper = document.getElementById('editor-map-wrapper');
  const baseWidth = 1024; // Base width of the map area
  const baseHeight = 880; // Base height of the map area
  const outerMargin = 25; // Margin around the scaled content
  
  function resizeEditor() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Account for the sidebar width
    const sidebarWidth = document.getElementById('editor-controls').offsetWidth;
    const availableWidth = viewportWidth - sidebarWidth - outerMargin * 2;
    const availableHeight = viewportHeight - outerMargin * 2;
    
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;
    
    const scale = Math.min(scaleX, scaleY);
    
    editorMapWrapper.style.transform = `scale(${scale})`;
  }
  
  window.addEventListener('resize', resizeEditor);
  resizeEditor(); // Initial resize
  
  const initialScenario = new ScenarioMap();
  initialScenario.createEmptyMap(15, 15);
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
      // If riverMode is true, only allow edge clicks to be handled by edge listeners
      if (event.target.getAttribute('data-edge-index')) {
        return; // Handled by edge click listener
      }
      return; // Otherwise, do nothing in riverMode
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
  
  const zoomButton = document.getElementById('zoom');
  zoomButton.addEventListener('click', () => {
    zoom();
  });
});
