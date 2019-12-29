/**
 * Utilities for D3 package.
 */
export namespace Util {
    /**
     * Get element uniq ID.
     * @param element DOM element name.
     * @param label Element uniq label.
     * @return ID.
     */
    export function getElementId(element: string, label: string): string {
        return (element + "_" + label)
    }

}

/**
 * Point.
 */
export class Point {
    /**
     * CONSTRUCTOR.
     * @param x
     * @param y
     */
    constructor(public readonly x: number, public readonly y: number) {
        // NOP.
    }

    /**
     * Get log string.
     * @return
     */
    public toString(): string {
        return `${this.x}x${this.y}`;
    }
}

/**
 * Size.
 */
export class Size {
    /**
     * CONSTRUCTOR.
     * @param w
     * @param h
     */
    constructor(public readonly w: number, public readonly h: number) {
        // NOP.
    }

    /**
     * Get log string.
     * @return
     */
    public toString(): string {
        return `${this.w}x${this.h}`;
    }
}

