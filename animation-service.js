import { on } from './state.js';

export class AnimationService {
    constructor(gameState) {
        this.gameState = gameState;
        if (!AnimationService.instance) {
            AnimationService.instance = this;
            on('unitMoving', (data) => this.handleUnitMove(data));
        }
        return AnimationService.instance;
    }

    async handleUnitMove(data) {
        const { unit, path } = data;
        this.gameState.isAnimating = true;

        await this.animateUnit(unit, path);

        const finalHex = path[path.length - 1];
        unit.x = finalHex.x;
        unit.y = finalHex.y;
        unit.updatePosition(unit.x, unit.y);

        if (this.gameState.getCurrentSpecialPhase() === 'ADVANCE') {
            unit.advanced = true;
        }

        this.gameState.isAnimating = false;
        unit.hexGrid.refreshUnitDimmers();
    }

    animateUnit(unit, path) {
        return new Promise(resolve => {
            const speed = 6; // pixels per frame
            let pathIndex = 1;

            const step = () => {
                if (pathIndex >= path.length) {
                    resolve();
                    return;
                }

                const targetHex = path[pathIndex];
                const targetPosition = unit.hexGrid.getUnitPosition(targetHex);
                
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
