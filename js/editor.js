import { HexGrid } from './grid.js';
import { HexGridView } from './grid-view.js';
import { GameState } from './state.js';
import { TerrainType, UnitType, PlayerType } from './constants.js';
import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { Unit } from './unit.js';
import { Supply } from './supply.js';
import { UnitView } from './unit-view.js';
import { ViewController } from './view-controller.js';

document.addEventListener('DOMContentLoaded', async () => {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  const svgService = new SvgService();
  await svgService.load();
  
  const hexRadius = 50;
  const lineWidth = 2;
  const gameState = new GameState();
  let hexGrid;
  let hexGridView;
  const mainSvg = document.getElementById('main');
  
  let mapWidth;
  let mapHeight;
  
  let viewController;

  async function drawMap(scenario) {
    mainSvg.innerHTML = '';
    hexGrid = new HexGrid(scenario.height, scenario.width, scenario, gameState, true);
    const supply = new Supply(hexGrid);
    hexGridView = new HexGridView(hexGrid, hexRadius, lineWidth, gameState, true, svgService, supply);
    await hexGridView.drawHexGrid();
    mainSvg.appendChild(hexGridView.svg);
    
    mapWidth = parseFloat(hexGridView.svg.getAttribute('width'));
    mapHeight = parseFloat(hexGridView.svg.getAttribute('height'));

    if (!viewController) {
      viewController = new ViewController(mainSvg, mapWidth, mapHeight);
      hexGridView.viewController = viewController;
    }
    else {
      viewController.updateMapDimensions(mapWidth, mapHeight);
    }

    hexGridView.hexViews.forEach(hexView => {
      hexView.svg.addEventListener('click', (e) => {
        if (viewController.panned) {
            return;
        }
        onHexClick(hexView, e)
      });
    });
    
    viewController.setViewBox(-100, -100, baseWidth, baseHeight);
  }
  
  const editorMapWrapper = document.getElementById('editor-map-wrapper');
  const baseWidth = 1024;
  const baseHeight = 880;
  const outerMargin = 25;
  
  function resizeEditor() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const sidebarWidth = document.getElementById('editor-controls').offsetWidth;
    const availableWidth = viewportWidth - sidebarWidth - outerMargin * 2;
    const availableHeight = viewportHeight - outerMargin * 2;
    
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;
    
    const scale = Math.min(scaleX, scaleY);
    
    editorMapWrapper.style.transform = `scale(${scale})`;
  }
  
  window.addEventListener('resize', resizeEditor);
  resizeEditor();
  
  const initialScenario = new ScenarioMap();
  initialScenario.createEmptyMap(10, 10);
  await drawMap(initialScenario);
  
  let selectedTerrain = null;
  let selectedUnit = null;
  let riverMode = false;
  let roadMode = false;
  let firstHex = null;
  let supplyCityMode = false;
  
  const terrainPalette = document.getElementById('terrain-palette');
  for (const terrain in TerrainType) {
    const button = document.createElement('button');
    button.textContent = capitalize(terrain);
    button.addEventListener('click', (e) => {
      selectedTerrain = TerrainType[terrain];
      selectedUnit = null;
      riverMode = false;
      roadMode = false;
      supplyCityMode = false;
      if (firstHex) {
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
      }
      updateSelectedPalette(e.target);
    });
    terrainPalette.appendChild(button);
  }
  
  const unitPalette = document.getElementById('unit-palette');
  for (const unit in UnitType) {
    const button = document.createElement('button');
    button.textContent = capitalize(unit);
    button.addEventListener('click', (e) => {
      selectedUnit = UnitType[unit];
      selectedTerrain = null;
      riverMode = false;
      roadMode = false;
      supplyCityMode = false;
      if (firstHex) {
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
      }
      updateSelectedPalette(e.target);
    });
    unitPalette.appendChild(button);
  }
  const removeUnitButton = document.createElement('button');
  removeUnitButton.textContent = capitalize("remove unit");
  removeUnitButton.addEventListener('click', (e) => {
    selectedUnit = 'remove';
    selectedTerrain = null;
    riverMode = false;
    roadMode = false;
    supplyCityMode = false;
    if (firstHex) {
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
    }
    updateSelectedPalette(e.target);
  });
  unitPalette.appendChild(removeUnitButton);
  
  const riverButton = document.createElement('button');
  riverButton.textContent = capitalize("river");
  riverButton.addEventListener('click', (e) => {
    riverMode = !riverMode;
    roadMode = false;
    selectedTerrain = null;
    selectedUnit = null;
    supplyCityMode = false;
    if (firstHex) {
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
    }
    updateSelectedPalette(e.target);
  });
  terrainPalette.appendChild(riverButton);

  const roadButton = document.createElement('button');
  roadButton.textContent = capitalize("road");
  roadButton.addEventListener('click', (e) => {
    roadMode = !roadMode;
    riverMode = false;
    selectedTerrain = null;
    selectedUnit = null;
    supplyCityMode = false;
    if (!roadMode && firstHex) { // If turning off road mode and a hex was selected
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
    }
    updateSelectedPalette(e.target);
  });
  terrainPalette.appendChild(roadButton);

  const setSupplyCitiesButton = document.getElementById('set-supply-cities');
  setSupplyCitiesButton.addEventListener('click', (e) => {
    supplyCityMode = !supplyCityMode;
    roadMode = false;
    riverMode = false;
    selectedTerrain = null;
    selectedUnit = null;
    if (firstHex) {
        hexGridView.getViewForHex(firstHex)?.toggleInnerHex(false);
        firstHex = null;
    }
    updateSelectedPalette(e.target);
  });
  
  function updateSelectedPalette(selectedButton) {
    document.querySelectorAll('#terrain-palette button, #unit-palette button, #supply-settings button').forEach(button => {
      button.classList.remove('selected');
    });
    selectedButton.classList.add('selected');
  }
  
  function onHexClick(hexView, event) {
    const hex = hexView.hex;
    const mainSvg = document.getElementById('main');
    const screenPoint = new DOMPoint(event.clientX, event.clientY);
    const inverseMatrix = mainSvg.getScreenCTM().inverse();
    const svgPoint = screenPoint.matrixTransform(inverseMatrix);

    const svgX = svgPoint.x;
    const svgY = svgPoint.y;

    const hexX = parseFloat(hexView.svg.getAttribute('x'));
    const hexY = parseFloat(hexView.svg.getAttribute('y'));

    const clickXInHex = svgX - hexX;
    const clickYInHex = svgY - hexY;

    if (supplyCityMode) {
      if (hex.terrainType === TerrainType.CITY) {
        const player = document.getElementById('player-select').value === 'grey' ? PlayerType.GREY : PlayerType.GREEN;
        const supplyCities = player === PlayerType.GREY ? hexGrid.scenarioMap.player1SupplyCities : hexGrid.scenarioMap.player2SupplyCities;
        const cityCoords = { x: hex.x, y: hex.y };
        const cityIndex = supplyCities.findIndex(c => c.x === cityCoords.x && c.y === cityCoords.y);

        if (cityIndex > -1) {
          supplyCities.splice(cityIndex, 1);
          console.log(`Removed supply city for player ${player}:`, cityCoords);
        } else {
          supplyCities.push(cityCoords);
          console.log(`Added supply city for player ${player}:`, cityCoords);
        }
        if (gameState.showSupply) {
            hexGridView.refreshSupplyView();
        }
      }
    }
    else if (riverMode) {
      const edgeIndex = hexView.getClosestSide(clickXInHex, clickYInHex);
      hex.toggleRiver(edgeIndex);
      hexGridView.redrawAllRivers();
    }
    else if (roadMode) {
      if (!firstHex) {
        firstHex = hex;
        hexView.toggleInnerHex(true); // Highlight first hex
      } else {
        const secondHex = hex;
        const firstHexView = hexGridView.getViewForHex(firstHex);
        if (firstHexView) {
          firstHexView.toggleInnerHex(false); // Unhighlight first hex
        }

        const neighborIndex = hexGrid.getNeighborIndex(firstHex, secondHex);
        if (neighborIndex !== -1) {
          const oppositeIndex = (neighborIndex + 3) % 6;
          firstHex.roads[neighborIndex] = !firstHex.roads[neighborIndex];
          secondHex.roads[oppositeIndex] = !secondHex.roads[oppositeIndex];
          hexGridView.redrawAllRoads();
        }
        firstHex = null;
      }
    }
    else if (selectedTerrain) {
        hex.setTerrain(selectedTerrain);
        if (selectedTerrain === TerrainType.CITY || selectedTerrain === TerrainType.FLAG) {
            const player = document.getElementById('player-select').value === 'grey' ? PlayerType.GREY : PlayerType.GREEN;
            hex.owner = player;
        } else {
            hex.owner = null;
        }
        hexView.setTerrain(selectedTerrain);
    }
    else if (selectedUnit) {
      const existingUnit = hex.unit;
      if (existingUnit) {
          hexGrid.removeUnit(existingUnit);
          hexGridView.removeUnit(existingUnit);
      }

      if (selectedUnit !== 'remove') {
          const player = document.getElementById('player-select').value === 'grey' ? PlayerType.GREY : PlayerType.GREEN;
          const newUnit = new Unit(hex.x, hex.y, selectedUnit, player);
          hexGrid.addUnit(newUnit);
          hex.setUnit(newUnit);
          
          const baseRect = svgService.svgElements[newUnit.unitType + ".svg"].cloneNode(true);
          const newUnitView = new UnitView(newUnit, hexGridView, gameState);
          newUnitView.createUnit(baseRect);
          newUnitView.setBackgroundColor();
          newUnitView.refreshStatusText();
          hexGridView.addUnitView(newUnitView);
      }
    }
  }
  
  const exportButton = document.getElementById('export-map');
  exportButton.addEventListener('click', () => {
    const mapData = {
      width: hexGrid.cols,
      height: hexGrid.rows,
      startingPlayer: document.getElementById('starting-player-select').value,
      player1SupplyEdges: {
        n: document.getElementById('p1-supply-edge-n').checked,
        e: document.getElementById('p1-supply-edge-e').checked,
        s: document.getElementById('p1-supply-edge-s').checked,
        w: document.getElementById('p1-supply-edge-w').checked,
      },
      player2SupplyEdges: {
        n: document.getElementById('p2-supply-edge-n').checked,
        e: document.getElementById('p2-supply-edge-e').checked,
        s: document.getElementById('p2-supply-edge-s').checked,
        w: document.getElementById('p2-supply-edge-w').checked,
      },
      player1SupplyCities: hexGrid.scenarioMap.player1SupplyCities,
      player2SupplyCities: hexGrid.scenarioMap.player2SupplyCities,
      hexList: hexGrid.hexes.map(hex => ({
        x: hex.x,
        y: hex.y,
        terrain: hex.terrainType,
        unit: hex.unit ? { unitType: hex.unit.unitType, player: hex.unit.player } : null,
        owner: hex.owner,
        riverEdges: hex.riverEdges,
        roads: hex.roads
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
        newScenario.startingPlayer = mapData.startingPlayer;
        newScenario.player1SupplyEdges = mapData.player1SupplyEdges;
        newScenario.player2SupplyEdges = mapData.player2SupplyEdges;
        newScenario.player1SupplyCities = mapData.player1SupplyCities || [];
        newScenario.player2SupplyCities = mapData.player2SupplyCities || [];

        document.getElementById('rows').value = mapData.height;
        document.getElementById('cols').value = mapData.width;
        document.getElementById('starting-player-select').value = mapData.startingPlayer || 'grey';
        
        if (mapData.player1SupplyEdges) {
            document.getElementById('p1-supply-edge-n').checked = mapData.player1SupplyEdges.n;
            document.getElementById('p1-supply-edge-e').checked = mapData.player1SupplyEdges.e;
            document.getElementById('p1-supply-edge-s').checked = mapData.player1SupplyEdges.s;
            document.getElementById('p1-supply-edge-w').checked = mapData.player1SupplyEdges.w;
        }
        if (mapData.player2SupplyEdges) {
            document.getElementById('p2-supply-edge-n').checked = mapData.player2SupplyEdges.n;
            document.getElementById('p2-supply-edge-e').checked = mapData.player2SupplyEdges.e;
            document.getElementById('p2-supply-edge-s').checked = mapData.player2SupplyEdges.s;
            document.getElementById('p2-supply-edge-w').checked = mapData.player2SupplyEdges.w;
        }

        await drawMap(newScenario);
      };
      reader.readAsText(file);
    }
    event.target.value = null;
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
    viewController.zoom();
  });



  document.getElementById('toggle-supply-button').addEventListener('click', () => {
    gameState.showSupply = !gameState.showSupply;
    
    // Update scenario with current editor settings for visualization
    const scenario = hexGrid.scenarioMap;
    scenario.startingPlayer = document.getElementById('starting-player-select').value;
    scenario.player1SupplyEdges = {
        n: document.getElementById('p1-supply-edge-n').checked,
        e: document.getElementById('p1-supply-edge-e').checked,
        s: document.getElementById('p1-supply-edge-s').checked,
        w: document.getElementById('p1-supply-edge-w').checked,
    };
    scenario.player2SupplyEdges = {
        n: document.getElementById('p2-supply-edge-n').checked,
        e: document.getElementById('p2-supply-edge-e').checked,
        s: document.getElementById('p2-supply-edge-s').checked,
        w: document.getElementById('p2-supply-edge-w').checked,
    };
    // Supply cities are already updated in the scenario object

    hexGridView.refreshSupplyView();
  });
});
