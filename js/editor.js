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
  let selectedPlayer = 'grey';
  let startingPlayer = 'grey';
  let p1SupplyEdges = { n: false, e: false, s: false, w: false };
  let p2SupplyEdges = { n: false, e: false, s: false, w: false };

  function createPlayerButtons(containerId, stateUpdater) {
    const container = document.getElementById(containerId);
    const players = ['grey', 'green'];

    players.forEach(player => {
      const button = document.createElement('div');
      button.classList.add('player-button', player);
      if ((stateUpdater === 'player' && selectedPlayer === player) || (stateUpdater === 'startingPlayer' && startingPlayer === player)) {
        button.classList.add('selected');
      }

      button.addEventListener('click', () => {
        if (stateUpdater === 'player') {
          selectedPlayer = player;
        } else if (stateUpdater === 'startingPlayer') {
          startingPlayer = player;
        }

        // Update selected class for this group
        container.querySelectorAll('.player-button').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
      });

      container.appendChild(button);
    });
  }

  createPlayerButtons('player-buttons', 'player');
  createPlayerButtons('starting-player-buttons', 'startingPlayer');

  function createSupplyEdgeButtons(containerId, supplyEdges, playerClass) {
    const container = document.getElementById(containerId);
    const directions = {
      n: '4,12 8,4 12,12',
      e: '4,4 12,8 4,12',
      s: '4,4 8,12 12,4',
      w: '12,4 4,8 12,12'
    };

    for (const dir in directions) {
      const button = document.createElement('div');
      button.classList.add('supply-edge-button', playerClass);
      button.dataset.direction = dir;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', directions[dir]);
      svg.appendChild(polyline);

      button.appendChild(svg);

      if (supplyEdges[dir]) {
        button.classList.add('selected');
      }

      button.addEventListener('click', () => {
        supplyEdges[dir] = !supplyEdges[dir];
        button.classList.toggle('selected');

        if (playerClass === 'grey') {
          hexGrid.scenarioMap.player1SupplyEdges = supplyEdges;
        } else {
          hexGrid.scenarioMap.player2SupplyEdges = supplyEdges;
        }

        updateSupplyIfVisible();
      });

      container.appendChild(button);
    }
  }

  createSupplyEdgeButtons('p1-supply-edges', p1SupplyEdges, 'grey');
  createSupplyEdgeButtons('p2-supply-edges', p2SupplyEdges, 'green');
  
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
    document.querySelectorAll('#terrain-palette button, #unit-palette button, #supply-city-controls button').forEach(button => {
      button.classList.remove('selected');
    });
    selectedButton.classList.add('selected');
  }

  function updateSupplyIfVisible() {
    if (gameState.showSupply) {
      hexGridView.refreshSupplyView();
    }
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
        const supplyCities = hexGrid.scenarioMap.supplyCities;
        const cityCoords = { x: hex.x, y: hex.y };
        const cityIndex = supplyCities.findIndex(c => c.x === cityCoords.x && c.y === cityCoords.y);

        if (cityIndex > -1) {
          supplyCities.splice(cityIndex, 1);
          console.log(`Removed supply city:`, cityCoords);
        } else {
          supplyCities.push(cityCoords);
          console.log(`Added supply city:`, cityCoords);
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
      updateSupplyIfVisible();
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
            const player = selectedPlayer === 'grey' ? PlayerType.GREY : PlayerType.GREEN;
            hex.owner = player;
        } else {
            hex.owner = null;
        }
        hexView.setTerrain(selectedTerrain);
        updateSupplyIfVisible();
    }
    else if (selectedUnit) {
      const existingUnit = hex.unit;
      if (existingUnit) {
          hexGrid.removeUnit(existingUnit);
          hexGridView.removeUnit(existingUnit);
      }

      if (selectedUnit !== 'remove') {
          const player = selectedPlayer === 'grey' ? PlayerType.GREY : PlayerType.GREEN;
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
      updateSupplyIfVisible();
    }
  }
  
  const exportButton = document.getElementById('export-map');
  exportButton.addEventListener('click', () => {
    const mapData = {
      width: hexGrid.cols,
      height: hexGrid.rows,
      startingPlayer: startingPlayer,
      player1SupplyEdges: p1SupplyEdges,
      player2SupplyEdges: p2SupplyEdges,
      supplyCities: hexGrid.scenarioMap.supplyCities,
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
        newScenario.supplyCities = mapData.supplyCities || [];

        document.getElementById('rows').value = mapData.height;
        document.getElementById('cols').value = mapData.width;
        startingPlayer = mapData.startingPlayer || 'grey';
        document.querySelectorAll('#starting-player-buttons .player-button').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.classList.contains(startingPlayer)) {
                btn.classList.add('selected');
            }
        });
        
        if (mapData.player1SupplyEdges) {
            Object.assign(p1SupplyEdges, mapData.player1SupplyEdges);
            document.querySelectorAll('#p1-supply-edges .supply-edge-button').forEach(btn => {
                const dir = btn.dataset.direction;
                if (p1SupplyEdges[dir]) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }
            });
        }
        if (mapData.player2SupplyEdges) {
            Object.assign(p2SupplyEdges, mapData.player2SupplyEdges);
            document.querySelectorAll('#p2-supply-edges .supply-edge-button').forEach(btn => {
                const dir = btn.dataset.direction;
                if (p2SupplyEdges[dir]) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }
            });
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



  document.getElementById('show-supply-button').addEventListener('click', (e) => {
    gameState.showSupply = !gameState.showSupply;
    e.target.classList.toggle('selected');
    
    // Update scenario with current editor settings for visualization
    const scenario = hexGrid.scenarioMap;
    scenario.startingPlayer = startingPlayer;
    scenario.player1SupplyEdges = p1SupplyEdges;
    scenario.player2SupplyEdges = p2SupplyEdges;
    // Supply cities are already updated in the scenario object

    hexGridView.refreshSupplyView();
  });
});
