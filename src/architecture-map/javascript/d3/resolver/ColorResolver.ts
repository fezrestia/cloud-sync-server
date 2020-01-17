/**
 * Color parameter container.
 */
export class ColorResolver {
    public readonly bg: string;
    public readonly stroke: string;
    public readonly bgHighlight: string;
    public readonly text: string;

    constructor(bg: string, stroke: string, bgHighlight: string, text?: string) {
        this.bg = bg;
        this.stroke = stroke;
        this.bgHighlight = bgHighlight;

        this.text = (text === undefined ? "black" : text);
    }
}

