export class SvgService {
  constructor() {
    if (!SvgService.instance) {
      SvgService.instance = this;
      this.svgElements = {};
      this.parser = new DOMParser();
    }
    return SvgService.instance;
  }

  async load() {
    if (this.loaded) 
      return;

    await this.loadSvgFromFile('infantry.svg');
    await this.loadSvgFromFile('tank.svg');
    await this.loadSvgFromFile('forest.svg');
    await this.loadSvgFromFile('mountain.svg');
    await this.loadSvgFromFile('flag.svg');
    await this.loadSvgFromFile('triangle-flag.svg');
    await this.loadSvgFromFile('swamp.svg');
    await this.loadSvgFromFile('water.svg');

    this.loaded = true;
  }

  async loadSvgFromFile(filename) {
    const svgResource = await fetch(filename);
    const svgData = await svgResource.text();
    const svgElement = this.parser.parseFromString(svgData, 'image/svg+xml').documentElement;

    this.svgElements[filename]= svgElement;
  }

  addSvgElement(name, svgElement) {
    this.svgElements[name]= svgElement;
  }
}
