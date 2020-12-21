import { Def } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";

/**
 * Serialized JSON object interface.
 */
export interface ElementJson {
  [Def.KEY_UID]: number,
  [Def.KEY_CLASS]: string,
  [Def.KEY_DIMENS]: {
      [Def.KEY_Z_ORDER]: number,
  },
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

  abstract get label(): string;

  private _zOrder: number = Def.INVALID_Z_ORDER;
      public get zOrder(): number {
        return this._zOrder;
      }
      public set zOrder(zOrder: number) {
        this._zOrder = zOrder;
      }

  /**
   * CONSTRUCTOR.
   *
   * @param uid Element unique ID to identify Element in whole ArchitectureMap.
   * @param html HTML root view. Used for non-svg contents like as pop-up window.
   * @param svg SVG root object.
   */
  constructor(public readonly uid: number, protected html: JQueryNode, protected svg: D3Node.SVG) {
    // NOP.
  }

  /**
   * Serialize Element object to ElementJson Object.
   *
   * @return ElementJson based object.
   */
  abstract serialize(): ElementJson;

  /**
   * Render.
   */
  abstract render(): void;

  /**
   * Select this Element with NO callback.
   */
  abstract select(): void;

  /**
   * Deselected this Element with NO callback.
   */
  abstract deselect(): void;

  /**
   * Reset state to idle with NO callback.
   */
  abstract resetState(): void;

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

