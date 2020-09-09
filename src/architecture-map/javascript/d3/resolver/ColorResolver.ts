/**
 * Color parameter container.
 */
export class ColorResolver {
  public readonly bg: string;
  public readonly stroke: string;
  public readonly bgHighlight: string;
  public readonly strokeHighlight: string;
  public readonly text: string;

  constructor(
      bg: string,
      stroke: string,
      bgHighlight: string,
      strokeHighlight: string,
      text?: string) {
    this.bg = bg;
    this.stroke = stroke;
    this.bgHighlight = bgHighlight;
    this.strokeHighlight = strokeHighlight;

    this.text = (text === undefined ? "black" : text);
  }
}

