import { PlayerType } from './Constants.js';

export function getHexWidth(hexRadius) {
    return 2 * hexRadius;
}

export function getHexHeight(hexRadius) {
    return Math.sqrt(3) * hexRadius;
}

export function getAnotherPlayer(player) {
    return player === PlayerType.GREEN ? PlayerType.GREY : PlayerType.GREEN;
}

export function getMargin(lineWidth) {
    return Math.round(lineWidth / 2) + 1;
}
