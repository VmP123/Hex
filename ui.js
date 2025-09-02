import { GameStatus, PlayerType, SpecialPhaseType, TurnPhase, CombatResultsTable } from './Constants.js';

export class InfoArea {
    constructor(gameState, hexGrid) {
        this.gameState = gameState;
        this.hexGrid = hexGrid;
        this.svg = null;

        this.gameState.onCombatResultUpdated.push(this.refreshCombatResultText.bind(this));
        this.gameState.onWinnerUpdated.push(this.refreshStatusText.bind(this));
        this.gameState.onCurrentSpecialPhaseUpdated.push(this.updatePhaseText.bind(this));
        this.gameState.onCurrentSpecialPhaseUpdated.push(this.refreshStatusText.bind(this));
        this.gameState.onCurrentSpecialPhaseUpdated.push(this.refreshEndPhaseButton.bind(this));
    }

    updatePhaseText() {			
        let currentPhase = null;

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            currentPhase = currentSpecialPhase.toUpperCase();
        }
        else if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE) {
            currentPhase = "assign".toUpperCase();
        }
        else {
            currentPhase = this.gameState.currentTurnPhase.toUpperCase();
        }

        this.svg.querySelector('.phase').textContent = "PHASE: " + currentPhase;
    }

    updatePlayerText() {
        this.svg.querySelector('.turn').textContent = "PLAYER: " + this.gameState.activePlayer.toUpperCase();
    }

    refreshCombatResultText() {
        const value = this.gameState.crtColumn != null && this.gameState.d6Value != null 
            ? this.gameState.crtColumn.ratioText + ", " + 
              this.gameState.d6Value + ", " + 
              this.gameState.crtColumn[this.gameState.d6Value]
            : '-';

        this.svg.querySelector('.combatResult').textContent = "COMBAT: " + value;
    }

    refreshStatusText() {
        const statusText = this.svg.querySelector('.statusText');

        if (this.gameState.winner !== null) {
            statusText.textContent = this.gameState.winner.toUpperCase() + " PLAYER WON";
        }
        else if (this.gameState.getCurrentSpecialPhase() === SpecialPhaseType.ATTACKER_DAMAGE) {
            statusText.textContent = `Assign damage to attacker, ${this.gameState.unassignedDamagePoints} left`;
        }
        else if (this.gameState.getCurrentSpecialPhase() === SpecialPhaseType.ADVANCE) {
            statusText.textContent = `Advance to vacated hex?`;
        }
        else {
            statusText.textContent = "";
        }
    }

    refreshEndPhaseButton() {
        const endPhaseButtonText = this.svg.querySelector('.endPhaseButton .buttonText');

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();
        const color = currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE ? "grey" : "black";
        endPhaseButtonText.setAttribute('fill', color);
    }

    endPhase() {
        if (this.hexGrid.gameState.status !== GameStatus.GAMEON) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            this.hexGrid.endSpecialPhase();
        }
        else if (currentSpecialPhase === null) {
            if (this.gameState.currentTurnPhase == TurnPhase.MOVE) {
                this.gameState.currentTurnPhase = TurnPhase.ATTACK;
                this.updatePhaseText();
            }
            else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
                this.gameState.activePlayer = this.gameState.activePlayer == PlayerType.GREY
                    ? this.gameState.activePlayer = PlayerType.GREEN
                    : this.gameState.activePlayer = PlayerType.GREY;

                this.gameState.currentTurnPhase = TurnPhase.MOVE;

                this.gameState.setCombatResult(null, null);
                this.updatePhaseText();
                this.updatePlayerText();
                this.hexGrid.clearUnitMovedAttacked();
            }

            this.hexGrid.clearHighlightedHexes();
            this.hexGrid.clearSelections();
            this.hexGrid.refreshUnitDimmers();
        }
    }

    draw() {
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('fill', 'black');
        text.setAttribute('font-family', "Arial, sans-serif");
        text.setAttribute('font-size', '22px');
        text.style.userSelect = 'none';
    
        const x = 50;
        const y = 50;

        const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan1.textContent = "PLAYER: " + this.gameState.activePlayer.toUpperCase();
        tspan1.setAttribute('x', x);
        tspan1.setAttribute('dy', '1.2em');
        tspan1.setAttribute('class', 'turn');

        const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan2.textContent = "PHASE: " + this.gameState.currentTurnPhase.toUpperCase();
        tspan2.setAttribute('class', 'phase');	
        tspan2.setAttribute('x', x);
        tspan2.setAttribute('dy', '1.2em');

        const tspan3 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan3.textContent = "COMBAT: -";
        tspan3.setAttribute('class', 'combatResult');	
        tspan3.setAttribute('x', x);
        tspan3.setAttribute('dy', '1.2em');

        text.appendChild(tspan1);
        text.appendChild(tspan2);
        text.appendChild(tspan3);

        text.setAttribute('y', y);

        this.svg.appendChild(text);
        
        const buttonSVG = this.createButtonSVG(100, 30, "End phase");
        buttonSVG.setAttribute('class', 'endPhaseButton');	
        buttonSVG.setAttribute('x', x);
        buttonSVG.setAttribute('y', y + 100);

        this.svg.appendChild(buttonSVG);

        buttonSVG.addEventListener('click', () => this.endPhase());

        const statusText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        statusText.setAttribute('fill', 'black');
        statusText.setAttribute('font-family', "Arial, sans-serif");
        statusText.setAttribute('font-size', '22px');
        statusText.style.userSelect = 'none';
        statusText.textContent = ""
        statusText.setAttribute('class', 'statusText');	
        statusText.setAttribute('x', x);
        statusText.setAttribute('y', y + 170);

        this.svg.appendChild(statusText);

        const crt = this.drawCrt(x, y + 250);
        this.svg.appendChild(crt);
    }

    drawCrt(x, y) {
        const crtGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        crtGroup.style.userSelect = 'none';
        crtGroup.setAttribute('class', 'crt-table');

        const header = ['Ratio', '1', '2', '3', '4', '5', '6'];
        const colWidth = 35;
        const rowHeight = 20;
        const fontSize = '16px';
        const firstColWidth = 50;

        // Draw header
        header.forEach((text, i) => {
            const headerCell = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            headerCell.setAttribute('x', x + (i === 0 ? 0 : firstColWidth + (i - 1) * colWidth));
            headerCell.setAttribute('y', y);
            headerCell.setAttribute('font-size', fontSize);
            headerCell.setAttribute('font-weight', 'bold');
            headerCell.textContent = text;
            crtGroup.appendChild(headerCell);
        });

        // Draw rows
        CombatResultsTable.forEach((row, rowIndex) => {
            const yPos = y + (rowIndex + 1) * rowHeight;
            
            // Ratio
            const ratioCell = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            ratioCell.setAttribute('x', x);
            ratioCell.setAttribute('y', yPos);
            ratioCell.setAttribute('font-size', fontSize);
            ratioCell.textContent = row.ratioText;
            crtGroup.appendChild(ratioCell);

            // Results
            for (let i = 1; i <= 6; i++) {
                const resultCell = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                resultCell.setAttribute('x', x + firstColWidth + (i - 1) * colWidth);
                resultCell.setAttribute('y', yPos);
                resultCell.setAttribute('font-size', fontSize);
                resultCell.textContent = row[i.toString()];
                crtGroup.appendChild(resultCell);
            }
        });

        return crtGroup;
    }

    createButtonSVG(width, height, text) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        
        svg.setAttribute("width", width + 4);
        svg.setAttribute("height", height + 4);

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", 2);
        rect.setAttribute("y", 2);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", "#ebf2fa");
        rect.setAttribute("rx", 5);
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', 2);

        const buttonText = document.createElementNS(svgNS, "text");
        buttonText.setAttribute("x", width / 2 + 2);
        buttonText.setAttribute("y", height / 2 + 2);
        buttonText.setAttribute("class", "buttonText");
        buttonText.setAttribute("dominant-baseline", "middle");
        buttonText.setAttribute("text-anchor", "middle");
        buttonText.setAttribute("font-family", "Arial");
        buttonText.setAttribute("font-size", "16px");
        buttonText.style.userSelect = 'none';
        buttonText.textContent = text;

        svg.appendChild(rect);
        svg.appendChild(buttonText);
        svg.setAttribute("x", 10);
        svg.setAttribute("y", 10);

        return svg;
    }
}