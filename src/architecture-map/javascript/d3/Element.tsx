import { Def } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";

/**
 * Serialized JSON object interface.
 */
export interface ElementJson {
  [Def.KEY_CLASS]: string,
}

/**
 * Interactive mode options for Element.
 */
export enum ElementItxMode {
  RIGID,
  SELECTABLE,
  EDITABLE,
}

/**
 * Abstract element bassis class.
 */
export abstract class Element {
  abstract readonly TAG: string;

  abstract set itxMode(mode: ElementItxMode);
  abstract get itxMode(): ElementItxMode;

  /**
   * CONSTRUCTOR.
   *
   * @param html HTML root view. Used for non-svg contents like as pop-up window.
   * @param svg SVG root object.
   */
  constructor(protected html: JQueryNode, protected svg: D3Node.SVG) {
    // NOP.
  }

  /**
   * Serialize Element object to ElementJson Object.
   *
   * @return ElementJson based object.
   */
  abstract serialize(): ElementJson;

  /**
   * Reset state to idle.
   */
  abstract resetState(): void;

  /**
   * Render.
   */
  abstract render(): void;

  /**
   * Select this Element as single selection.
   */
  abstract selectSingleNoCallback(): void;

  /**
   * Select this Element as multi selection.
   */
  abstract selectMultiNoCallback(): void;

  /**
   * Deselected by other UI. Callback is NOT invoked.
   */
  abstract deselectNoCallback(): void;

  /**
   * Reset state to idle with NO callback invocation.
   */
  abstract resetStateNoCallback(): void;

  /**
   * Move this Element with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  abstract move(plusX: number, plusY: number): void;

  /**
   * Delete this instance.
   */
  abstract delete(): void;
}

