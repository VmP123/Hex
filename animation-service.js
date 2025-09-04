import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class AnimationService {
    constructor() {
        if (!AnimationService.instance) {
            AnimationService.instance = this;
        }
        return AnimationService.instance;
    }

    animateUnit(unit, path, hexGrid) {
        return new Promise(resolve => {
            const speed = 6; // pixels per frame
            let pathIndex = 1;

            const step = () => {
                if (pathIndex >= path.length) {
                    resolve();
                    return;
                }

                const targetHex = path[pathIndex];
                const targetPosition = hexGrid.getUnitPosition(targetHex);
                
                const unitSvg = unit.svg;
                const currentX = parseFloat(unitSvg.getAttribute('x'));
                const currentY = parseFloat(unitSvg.getAttribute('y'));

                const dx = targetPosition.x - currentX;
                const dy = targetPosition.y - currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < speed) {
                    unitSvg.setAttribute('x', targetPosition.x);
                    unitSvg.setAttribute('y', targetPosition.y);
                    pathIndex++;
                    requestAnimationFrame(step);
                    return;
                }

                const angle = Math.atan2(dy, dx);
                const newX = currentX + Math.cos(angle) * speed;
                const newY = currentY + Math.sin(angle) * speed;

                unitSvg.setAttribute('x', newX);
                unitSvg.setAttribute('y', newY);

                requestAnimationFrame(step);
            };

            requestAnimationFrame(step);
        });
    }
}