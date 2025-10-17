import { TerrainType, ColorByPlayer } from './constants.js';
import { SvgService } from './svg-service.js';
import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class HexView {
    constructor(hex, hexRadius, lineWidth, svgService) {
        this.hex = hex;
        this.hexRadius = hexRadius;
        this.lineWidth = lineWidth;
        this.svgService = svgService;
        this.svg = this.draxHexSvg();
        this.setTerrain(hex.terrainType);
    }

    draxHexSvg() {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const hexCenterX = (hexWidth * 0.5) + margin;
        const hexCenterY = (hexHeight * 0.5) + margin;

        const baseHex = this.createBaseHex(hexCenterX, hexCenterY, this.hexRadius);
        const innerHex = this.createInnerHex(hexCenterX, hexCenterY, this.hexRadius - 5);
        const supplySourceHex = this.createSupplySourceHex(hexCenterX, hexCenterY, this.hexRadius - 5);

        const hexSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const svgWidth = hexWidth + margin * 2;
        const svgHeight = hexHeight + margin * 2;
        hexSvg.setAttribute('width', svgWidth);
        hexSvg.setAttribute('height', svgHeight);
        hexSvg.appendChild(baseHex);
        hexSvg.appendChild(innerHex);
        hexSvg.appendChild(supplySourceHex);

        return hexSvg;
    }

    createBaseHex(x, y, radius) {
        const baseHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        baseHex.setAttribute('class', 'hex baseHex');
        baseHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
        baseHex.setAttribute('fill', '#ffffff');
        baseHex.setAttribute('stroke', 'black');
        baseHex.setAttribute('stroke-width', this.lineWidth);
        return baseHex;
    }

    createInnerHex(x, y, radius) {
        const innerHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        innerHex.setAttribute('class', 'hex innerHex');
        innerHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
        innerHex.setAttribute('fill', 'none');
        innerHex.setAttribute('stroke', 'black');
        innerHex.setAttribute('stroke-width', this.lineWidth);
        innerHex.setAttribute('stroke-dasharray', '12 5');
        innerHex.setAttribute('display', 'none');
        return innerHex;
    }

    createSupplySourceHex(x, y, radius) {
        const supplySourceHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        supplySourceHex.setAttribute('class', 'hex supply-source-hex');
        supplySourceHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
        supplySourceHex.setAttribute('fill', 'none');
        supplySourceHex.setAttribute('stroke-width', 3);
        supplySourceHex.setAttribute('display', 'none');
        return supplySourceHex;
    }

    calculateHexPoints(x, y, radius) {
        const points = [];
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
            points.push((x + radius * Math.cos(angle)) + "," + (y + radius * Math.sin(angle)));
        }
        return points.join(" ");
    }

    getClosestSide(clickX, clickY) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const hexCenterX = (hexWidth * 0.5) + margin;
        const hexCenterY = (hexHeight * 0.5) + margin;

        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: hexCenterX + this.hexRadius * Math.cos(angle),
                y: hexCenterY + this.hexRadius * Math.sin(angle)
            });
        }

        let minDistanceSq = Infinity;
        let closestSideIndex = -1;

        for (let i = 0; i < 6; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % 6];
            
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            
            const distSq = Math.pow(clickX - midX, 2) + Math.pow(clickY - midY, 2);
            
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestSideIndex = i;
            }
        }
        
        return closestSideIndex;
    }

    toggleInnerHex() {
        const innerHex = this.svg.querySelector('.innerHex');
        innerHex.setAttribute('display', this.hex.highlighted ? 'block' : 'none');
    }

    drawSupplySourceBorder(player) {
        const supplySourceHex = this.svg.querySelector('.supply-source-hex');
        supplySourceHex.setAttribute('stroke', ColorByPlayer[player]);
        supplySourceHex.setAttribute('display', 'block');
    }

    removeSupplySourceBorder() {
        const supplySourceHex = this.svg.querySelector('.supply-source-hex');
        supplySourceHex.setAttribute('display', 'none');
    }

    setTerrain(terrainType) {
        const existingTerrain = this.svg.querySelector('[data-terrain]');
        if (existingTerrain) {
            this.svg.removeChild(existingTerrain);
        }

        if (terrainType === TerrainType.MOUNTAIN || terrainType === TerrainType.FOREST || terrainType === TerrainType.SWAMP || terrainType === TerrainType.WATER || terrainType === TerrainType.CITY || terrainType === TerrainType.FLAG) {
            const terrainSvgElement = this.svgService.svgElements[terrainType + '.svg'].cloneNode(true);
            terrainSvgElement.setAttribute('data-terrain', terrainType);

            if ((terrainType === TerrainType.CITY || terrainType === TerrainType.FLAG) && this.hex.owner) {
                const color = ColorByPlayer[this.hex.owner];
                const paths = terrainSvgElement.querySelectorAll('rect, .flagColor');
                paths.forEach(p => p.setAttribute('fill', color));
            }

            const hexWidth = getHexWidth(this.hexRadius);
            const hexHeight = getHexHeight(this.hexRadius);
            const margin = getMargin(this.lineWidth);

            let x, y, width, height;

            switch (terrainType) {
                case TerrainType.MOUNTAIN:
                    x = (hexWidth / 2) - 37 + margin;
                    y = (hexHeight / 2) - 35 + margin;
                    break;
                case TerrainType.FOREST:
                case TerrainType.SWAMP:
                case TerrainType.WATER:
                case TerrainType.CITY:
                    x = (hexWidth / 2) - 40 + margin;
                    y = (hexHeight / 2) - 45 + margin;
                    width = 80;
                    height = 80;
                    break;
                case TerrainType.FLAG:
                    x = (hexWidth / 2) - 37 + margin - 10;
                    y = (hexHeight / 2) - 35 + margin;
                    break;
            }

            terrainSvgElement.setAttribute('x', x);
            terrainSvgElement.setAttribute('y', y);
            if (width && height) {
                terrainSvgElement.setAttribute('width', width);
                terrainSvgElement.setAttribute('height', height);
            }

            this.svg.appendChild(terrainSvgElement);
        }
    }
}