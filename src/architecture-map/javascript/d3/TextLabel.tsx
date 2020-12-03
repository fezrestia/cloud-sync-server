import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { Point } from "./Util.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { Util } from "./Util.ts";
import { TextLabelContextMenu } from "../components/TextLabelContextMenu.tsx";
import { TextLabelContextMenuCallback } from "../components/TextLabelContextMenu.tsx";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";
import { Element } from "./Element";
import { ElementItxMode } from "./Element";

/**
 * Callback interface for TextLabel.
 */
export interface TextLabelCallback {
  onSelected(selected: TextLabel, isMulti: boolean): void;
  onDeselected(deselected: TextLabel): void;

  onEditing(editing: TextLabel, isMulti: boolean): void;
  onEdited(edited: TextLabel): void;

  onDragStart(moved: TextLabel): void;
  onDrag(moved: TextLabel, pulsX: number, plusY: number): void;
  onDragEnd(moved: TextLabel): void;

  onRaised(raised: TextLabel): void;
  onLowered(lowered: TextLabel): void;

  onLabelChanged(textLabel: TextLabel, oldLabel: string, newLabel: string): void;

  onHistoricalChanged(textLabel: TextLabel): void;

}

/**
 * TextLabel serialized JSON interface.
 */
export interface TextLabelJson {
  [Def.KEY_UID]: number,
  [Def.KEY_CLASS]: string,
  [Def.KEY_LABEL]: string,
  [Def.KEY_DIMENS]: {
      [Def.KEY_X]: number,
      [Def.KEY_Y]: number,
      [Def.KEY_WIDTH]: number,
      [Def.KEY_HEIGHT]: number,
      [Def.KEY_LABEL_ROT_DEG]: number,
      [Def.KEY_LABEL_ALIGN]: string,
  },
  [Def.KEY_COLOR_SET]: string,
}

/**
 * Base state class for TextLabel state machine.
 */
class TextLabelState {
  protected target: TextLabel;
  constructor(target: TextLabel) {
    this.target = target;
  }

  enter() {
  }

  exit() {
  }

  onLeftClicked(clickX: number, clickY: number, withCtrl: boolean = false) {
  }

  onRightClicked(clickX: number, clickY: number) {
  }

  onCanceled() {
  }

  reset() {
  }

  isMovable(): boolean {
    return false;
  }
}

/**
 * TextLabel class.
 */
export class TextLabel extends Element {
  public static readonly TAG = "TextLabel";
  public readonly TAG = TextLabel.TAG;

  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;
  private readonly LABEL_ALIGN_MARGIN = 16;

  private readonly GRIP_ID_LEFT_TOP = "grip_left_top";
  private readonly GRIP_ID_RIGHT_TOP = "grip_right_top";
  private readonly GRIP_ID_LEFT_BOTTOM = "grip_left_bottom";
  private readonly GRIP_ID_RIGHT_BOTTOM = "grip_right_bottom";

  private static IdleState = class extends TextLabelState {
    enter() {
      this.target.setHighlight(false);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      switch (this.target.itxMode) {
        case ElementItxMode.SELECTABLE:
          this.target.currentState = new TextLabel.SelectedState(this.target, withCtrl);
          break;

        case ElementItxMode.EDITABLE:
          this.target.currentState = new TextLabel.EditingState(this.target, withCtrl);
          break;
      }
    }
  }

  private static SelectedState = class extends TextLabelState {
    private isMulti: boolean;
    constructor(target: TextLabel, isMulti: boolean) {
      super(target);
      this.isMulti = isMulti;
    }

    enter() {
      this.target.setHighlight(true);
      if (this.target.callback != null) this.target.callback.onSelected(this.target, this.isMulti);
    }

    exit() {
      this.target.setHighlight(false);
      if (this.target.callback != null) this.target.callback.onDeselected(this.target);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      this.onCanceled();
    }

    onCanceled() {
      this.target.currentState = new TextLabel.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }
  }

  private static EditingState = class extends TextLabelState {
    private isMulti: boolean;
    constructor(target: TextLabel, isMulti: boolean) {
      super(target);
      this.isMulti = isMulti;
    }

    enter() {
      this.target.setHighlight(true);
      this.target.enableEditMode();
      if (this.target.callback != null) this.target.callback.onEditing(this.target, this.isMulti);
    }

    exit() {
      this.target.closeContextMenu();
      this.target.setHighlight(false);
      this.target.disableEditMode();
      if (this.target.callback != null) this.target.callback.onEdited(this.target);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      this.onCanceled();
    }

    onRightClicked(clickX: number, clickY: number) {
      this.target.openContextMenu(clickX, clickY);
    }

    onCanceled() {
      this.target.currentState = new TextLabel.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }

    isMovable(): boolean {
      return true;
    }
  }

  /**
   * CONSTRUCTOR.
   *
   * @param uid Element unique ID.
   * @param html HTML root view. Used for non-svg contents like as pop-up window.
   * @param svg SVG root object.
   * @param label Module ID.
   */
  constructor(uid: number, html: JQueryNode, svg: D3Node.SVG, label: string) {
    super(uid, html, svg);

    this._label = label;
    this.colorSet = this.colorSet; // Load defaut

    this._currentState = new TextLabel.IdleState(this);
  }

  private _currentState: TextLabelState;
      private get currentState(): TextLabelState {
        return this._currentState;
      }
      private set currentState(newState: TextLabelState) {
        this._currentState.exit();
        this._currentState = newState;
        this._currentState.enter();
      }

  private _label: string;
      public get label(): string {
        return this._label;
      }

  private _itxMode: ElementItxMode = ElementItxMode.RIGID;
      public get itxMode(): ElementItxMode {
        return this._itxMode;
      }
      public set itxMode(mode: ElementItxMode) {
        this._itxMode = mode;
      }

  /**
   * Serialize TextLabel object to TextLabelJson Object.
   *
   * @return string TextLabelJson Object.
   */
  public serialize(): TextLabelJson {
    const jsonObj = {
        [Def.KEY_UID]: this.uid,
        [Def.KEY_CLASS]: TextLabel.TAG,
        [Def.KEY_LABEL]: this.label,
        [Def.KEY_DIMENS]: {
            [Def.KEY_X]: this.x,
            [Def.KEY_Y]: this.y,
            [Def.KEY_WIDTH]: this.width,
            [Def.KEY_HEIGHT]: this.height,
            [Def.KEY_LABEL_ROT_DEG]: this.labelRotDeg,
            [Def.KEY_LABEL_ALIGN]: this.labelAlign,
        },
        [Def.KEY_COLOR_SET]: this.colorSet,
    };
    return jsonObj;
  }

  /**
   * Deserlialize TextLabel object from JSON object.
   *
   * @param uid Element unique ID.
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return TextLabel.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: TextLabelJson): TextLabel {
    const textLabel = new TextLabel(
        json[Def.KEY_UID],
        html,
        svg,
        json[Def.KEY_LABEL]);
    textLabel.setDimens(
        json[Def.KEY_DIMENS][Def.KEY_X],
        json[Def.KEY_DIMENS][Def.KEY_Y],
        json[Def.KEY_DIMENS][Def.KEY_WIDTH],
        json[Def.KEY_DIMENS][Def.KEY_HEIGHT],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_ROT_DEG],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_ALIGN]);
    textLabel.colorSet = ColorSet.valueOf(json[Def.KEY_COLOR_SET]);
    return textLabel;
  }

  // Elements.
  private root!: D3Node.G;
  private polygon!: D3Node.Polygon;
  private text!: D3Node.Text;
  private editor: D3Node.G|null = null;

  // Position/Size.
  private x: number = 0;
  private y: number = 0;
  private width: number = 0;
  private height: number = 0;
  private labelRotDeg: number = 0;
  private labelAlign: string = "middle";

  // Font.
  private fontSize: number = 12;

  // Color resolver functions.
  private _colorSet: ColorSet = ColorSet.WHITE;
      public get colorSet(): ColorSet {
        return this._colorSet;
      }
      public set colorSet(colorSet: ColorSet) {
        this._colorSet = colorSet;
        this.colorResolver = ColorSet.resolve(colorSet);
      }

  private colorResolver!: ColorResolver;

  // Callback.
  private callback: TextLabelCallback|null = null;

  private runNoCallback(proc: () => void) {
    const cb = this.callback;
    this.callback = null;
    proc();
    this.callback = cb;
  }

  /**
   * Set module position and size.
   * @param x Pixels
   * @param y Pixels
   * @param width Pixels
   * @param height Pixels
   */
  public setXYWH(x: number, y: number, width: number, height: number) {
    this.setDimens(x, y, width, height, null, null);
  }

  /**
   * Get module position and size.
   * @return {x, y, width, height}
   */
  public getXYWH(): {x: number, y: number, width: number, height:number} {
    return {x: this.x, y: this.y, width: this.width, height: this.height};
  }

  /**
   * Update total dimension values.
   * @param x
   * @param y
   * @param width
   * @param height
   * @param labelRotDeg
   * @param labelAlign
   */
  public setDimens(
      x: number|null,
      y: number|null,
      width: number|null,
      height: number|null,
      labelRotDeg: number|null,
      labelAlign: string|null) {
    if (x != null) this.x = x;
    if (y != null) this.y = y;
    if (width != null) this.width = width;
    if (height != null) this.height = height;
    if (labelRotDeg != null) this.labelRotDeg = labelRotDeg;
    if (labelAlign != null) this.labelAlign = labelAlign;
  }

  /**
   * Set font related.
   * @param size Font size.
   */
  public setFonts(size: number) {
    this.fontSize = size;
  }

  /**
   * Set callback object.
   * @param callback Callback object.
   */
  public setCallback(callback: TextLabelCallback) {
    this.callback = callback;
  }

  /**
   * Render.
   */
  public render() {
    this.root = this.svg.append("g")
        .datum(this);

    // Polygon, normally Rect.
    this.polygon = this.root.append("polygon")
        .attr("stroke-width", 2);

    // Text.
    this.text = this.root.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", this.fontSize)
        .attr("pointer-events", "none");

    this.relabel();
    this.relayout();
    this.recolor();

    // Callbacks.
    this.registerCallbacks();
  }

  private setHighlight(isHighlight: boolean) {
    if (isHighlight) {
      this.polygon.attr("fill", this.colorResolver.bgHighlight);
    } else {
      this.polygon.attr("fill", this.colorResolver.bg);
    }
  }

  // @Override
  public select() {
    this.runNoCallback( () => {
      this.currentState.onLeftClicked(0, 0);
    } );
  }

  // @Override
  public deselect() {
    this.runNoCallback( () => {
      this.currentState.onCanceled();
    } );
  }

  // @Override
  public resetState() {
    this.runNoCallback( () => {
      this.currentState.reset();
    } );
  }

  /**
   * Move this TextLabel with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  public move(plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `move() : ID=${this.label}, plusX=${plusX}, plusY=${plusY}`);
    this.x += plusX;
    this.y += plusY;

    this.checkLayoutLimit();
    this.relayout();
  }

  private checkLayoutLimit() {
    // Top-Left edge limit check. Bottom-Right edge is movable, so skip check.
    if (this.x < 0) {
      this.x = 0;
    }
    if (this.y < 0) {
      this.y = 0;
    }
  }

  private registerCallbacks() {
    this.polygon.on("click", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "on:click");

        if (event.ctrlKey) {
          this.currentState.onLeftClicked(event.x, event.y, true);
        } else {
          this.currentState.onLeftClicked(event.x, event.y, false);
        }

        event.stopPropagation();
        event.preventDefault();
    });

    this.polygon.on("contextmenu", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "on:contextmenu");

        // NOTICE: Click offset X-Y is based on viewport of polygon. (same as svg)
        this.currentState.onRightClicked(event.offsetX, event.offsetY);

        event.stopPropagation();
        event.preventDefault();
    });

    this.root.call(
      d3.drag<SVGGElement, any, any>()
          .on("start", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "on:drag:start");
              if (this.currentState.isMovable()) {
                const target = event.target as any;

                target.origX = this.x;
                target.origY = this.y;
                target.startX = event.x;
                target.startY = event.y;

                if (this.callback != null) this.callback.onDragStart(this);
              }
          } )
          .on("drag", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "on:drag:drag");
              if (this.currentState.isMovable()) {
                const isSnapDragEnabled = event.altKey;
                const target = event.target as any;

                const dx = event.x - target.startX;
                const dy = event.y - target.startY;

                const oldX = this.x;
                const oldY = this.y;

                this.x = target.origX + dx;
                this.y = target.origY + dy;

                // Position snapping.
                if (isSnapDragEnabled) {
                  const snapX = this.x % Def.SNAP_STEP_PIX;
                  this.x -= snapX;
                  const snapY = this.y % Def.SNAP_STEP_PIX;
                  this.y -= snapY;
                }

                this.checkLayoutLimit();
                this.relayout();

                const plusX = this.x - oldX;
                const plusY = this.y - oldY;
                if (this.callback != null) this.callback.onDrag(this, plusX, plusY);
              }
          } )
          .on("end", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "on:drag:end");
              if (this.currentState.isMovable()) {
                const target = event.target as any;

                target.origX = 0;
                target.origY = 0;
                target.startX = 0;
                target.startY = 0;

                if (this.callback != null) this.callback.onDragEnd(this);

                if (this.callback != null) this.callback.onHistoricalChanged(this);
              }
          } )
      );
  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "enableEditMode()");
    if (this.editor != null) return;

    this.editor = this.root.append("g")
        .attr("id", "editor_plane");

    this.addEditGrip(this.GRIP_ID_LEFT_TOP,       this.x,                 this.y);
    this.addEditGrip(this.GRIP_ID_RIGHT_TOP,      this.x + this.width,    this.y);
    this.addEditGrip(this.GRIP_ID_LEFT_BOTTOM,    this.x,                 this.y + this.height);
    this.addEditGrip(this.GRIP_ID_RIGHT_BOTTOM,   this.x + this.width,    this.y + this.height);
  }

  private addEditGrip(id: string, cx: number, cy: number): any {
    if (this.editor == null) return;

    const TAG = "EditGrip";

    const circle = this.editor.append("circle")
        .attr("id", id)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("fill", this.colorResolver.stroke)
        .attr("r", this.EDIT_GRIP_RADIUS_PIX);

    circle.on("click", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
        event.stopPropagation();
    });

    circle.call(
      d3.drag<SVGCircleElement, any, any>()
          .on("start", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");

              const target = event.target as any;

              target.origX = this.x;
              target.origY = this.y;
              target.origWidth = this.width;
              target.origHeight = this.height;

              target.startX = event.x;
              target.startY = event.y;

          } )
          .on("drag", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              const isSnapDragEnabled = event.altKey;
              const target = event.target as any;

              const origX = target.origX;
              const origY = target.origY;
              const origWidth = target.origWidth;
              const origHeight = target.origHeight;

              let dx = event.x - target.startX;
              let dy = event.y - target.startY;

              switch (id) {
                case this.GRIP_ID_LEFT_TOP: {
                  if (origWidth - dx < this.MIN_SIZE_PIX) dx = origWidth - this.MIN_SIZE_PIX;
                  if (origHeight - dy < this.MIN_SIZE_PIX) dy = origHeight - this.MIN_SIZE_PIX;

                  // Edge position.
                  this.x = origX + dx;
                  this.width = origWidth - dx;
                  this.y = origY + dy;
                  this.height = origHeight - dy;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    const snapX = this.x % Def.SNAP_STEP_PIX;
                    this.x -= snapX;
                    this.width += snapX;
                    const snapY = this.y % Def.SNAP_STEP_PIX;
                    this.y -= snapY;
                    this.height += snapY;
                  }
                }
                break;

                case this.GRIP_ID_RIGHT_TOP: {
                  if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                  if (origHeight - dy < this.MIN_SIZE_PIX) dy = origHeight - this.MIN_SIZE_PIX;

                  // Edge position.
                  this.width = origWidth + dx;
                  this.y = origY + dy;
                  this.height = origHeight - dy;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    const snapX = (this.x + this.width) % Def.SNAP_STEP_PIX;
                    this.width -= snapX;
                    const snapY = this.y % Def.SNAP_STEP_PIX;
                    this.y -= snapY;
                    this.height += snapY;
                  }
                }
                break;

                case this.GRIP_ID_LEFT_BOTTOM: {
                  if (origWidth - dx < this.MIN_SIZE_PIX) dx = origWidth - this.MIN_SIZE_PIX;
                  if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                  // Edge position.
                  this.x = origX + dx;
                  this.width = origWidth - dx;
                  this.height = origHeight + dy;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    const snapX = this.x % Def.SNAP_STEP_PIX;
                    this.x -= snapX;
                    this.width += snapX;
                    const snapY = (this.y + this.height) % Def.SNAP_STEP_PIX;
                    this.height -= snapY;
                  }
                }
                break;

                case this.GRIP_ID_RIGHT_BOTTOM: {
                  if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                  if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                  // Edge position.
                  this.width = origWidth + dx;
                  this.height = origHeight + dy;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    const snapX = (this.x + this.width) % Def.SNAP_STEP_PIX;
                    this.width -= snapX;
                    const snapY = (this.y + this.height) % Def.SNAP_STEP_PIX;
                    this.height -= snapY;
                  }
                }
                break;
              }

              this.relayout();
          } )
          .on("end", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              const target = event.target as any;

              target.origX = 0;
              target.origY = 0;
              target.origWidth = 0;
              target.origHeight = 0;

              target.startX = 0;
              target.startY = 0;

              if (this.callback != null) this.callback.onHistoricalChanged(this);
          } )
    );
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "disableEditMode()");
    if (this.editor == null) return;

    this.editor.remove();
    this.editor = null;
  }

  private relayout() {
    // Common dimens.
    const left = this.x;
    const top = this.y;
    const right = this.x + this.width;
    const bottom = this.y + this.height;
    const centerX = left + this.width / 2;
    const centerY = top + this.height / 2;

    // Rect or polygon shape.
    const points: number[][] = [
        [left,  top   ],
        [right, top   ],
        [right, bottom],
        [left,  bottom],
        [left,  top   ],
    ];

    const polygonPoints: string = points
        .map( (point: number[]): string => { return point.join(",") } )
        .join(" ");
    this.polygon.attr("points", polygonPoints);

    // Text label.
    let labelX: number = 0;
    let labelY: number = 0;
    switch (this.labelRotDeg) {
      case Def.DEG_HORIZONTAL:
        switch (this.labelAlign) {
          case "top":
            labelX = centerX;
            labelY = top + this.LABEL_ALIGN_MARGIN;
            break;
          case "bottom":
            labelX = centerX;
            labelY = bottom - this.LABEL_ALIGN_MARGIN;
            break;
          case "middle":
            // Fall-through.
          default:
            labelX = centerX;
            labelY = centerY;
            break;
        }
        break;

      case Def.DEG_VERTICAL:
        switch (this.labelAlign) {
          case "top":
            labelX = left + this.LABEL_ALIGN_MARGIN;
            labelY = centerY;
            break;
          case "bottom":
            labelX = right - this.LABEL_ALIGN_MARGIN;
            labelY = centerY;
            break;
          case "middle":
            // Fall-through.
          default:
            labelX = centerX;
            labelY = centerY;
            break;
        }
        break;
    }
    this.text.attr("x", labelX);
    this.text.attr("y", labelY);
    this.text.attr("transform", `rotate(${this.labelRotDeg},${labelX},${labelY})`);

    this.updateLabelLayout();

    // Grips.
    if (this.editor != null) {
      const ltGrip = this.editor.select(`#${this.GRIP_ID_LEFT_TOP}`);
      ltGrip.attr("cx", this.x);
      ltGrip.attr("cy", this.y);

      const rtGrip = this.editor.select(`#${this.GRIP_ID_RIGHT_TOP}`);
      rtGrip.attr("cx", this.x + this.width);
      rtGrip.attr("cy", this.y);

      const lbGrip = this.editor.select(`#${this.GRIP_ID_LEFT_BOTTOM}`);
      lbGrip.attr("cx", this.x);
      lbGrip.attr("cy", this.y + this.height);

      const rbGrip = this.editor.select(`#${this.GRIP_ID_RIGHT_BOTTOM}`);
      rbGrip.attr("cx", this.x + this.width);
      rbGrip.attr("cy", this.y + this.height);
    }
  }

  private recolor() {
    // TextLabel stroke is invisible.
    this.polygon.attr("stroke", null);
    this.polygon.attr("fill", this.colorResolver.bg)

    this.text.attr("fill", this.colorResolver.text);

  }

  private relabel() {
    this.root
        .attr("id", Util.getElementId("textlabel", this.label));
    this.polygon
        .attr("id", Util.getElementId("polygon", this.label));
    this.text
        .attr("id", Util.getElementId("text", this.label));

    this.updateLabelLayout();

  }

  private updateLabelLayout() {
    this.text.text(null);

    const labelX = this.text.attr("x");
    const labelY = this.text.attr("y");

    const lines: string[] = this.label.split("\n");

    let startDY: number;
    switch (this.labelAlign) {
      case "top":
        startDY = 0;
        break;
      case "bottom":
        startDY = -1 * (lines.length - 1);
        break;
      case "middle":
        // Fall-through.
      default:
        startDY = -1 * (lines.length - 1) / 2;
        break;
    }

    lines.forEach( (line: string, i: number) => {
      let dy = (startDY + i) * 1.2;
      dy = Math.round(dy * 10);
      dy = dy / 10;

      this.text.append("tspan")
          .attr("x", labelX)
          .attr("y", labelY)
          .attr("dy", `${dy}em`)
          .attr("text-anchor", "middle")
          .text(line);
    } );

  }

  private ContextMenuCallbackImpl = class implements TextLabelContextMenuCallback {
    private target: TextLabel;

    constructor(target: TextLabel) {
      this.target = target;
    }

    close() {
      this.target.closeContextMenu();

      if (this.target.callback != null) this.target.callback.onHistoricalChanged(this.target);
    }

    changeLabelRotDeg(rotDeg: number) {
      this.target.rotateLabel(rotDeg);
    }

    changeLabelAlign(align: string) {
      this.target.alignLabel(align);
    }

    changeColorSet(colorSet: ColorSet) {
      this.target.colorSet = colorSet;

      // Re-construction and re-color.
      this.target.disableEditMode();
      this.target.enableEditMode();
      this.target.recolor();
    }

    moveToFrontEnd() {
      this.target.moveToFrontEnd();
    }

    moveToBackEnd() {
      this.target.moveToBackEnd();
    }

    onLabelChanged(oldLabel: string, newLabel: string) {
      this.target.onLabelChanged(oldLabel, newLabel);
    }

  }

  private openContextMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "openContextMenu()");

    this.html.css("display", "block");

    ReactDOM.render(
        <TextLabelContextMenu
            label={this.label}
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={clickX}
            topPix={clickY}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, "closeContextMenu()");

    const container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private rotateLabel(rotDeg: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `rotateLabel() : rotDeg=${rotDeg}`);
    this.labelRotDeg = rotDeg;
    this.relayout();
  }

  private alignLabel(align: string) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `alignLabel() : align=${align}`);
    this.labelAlign = align;
    this.relayout();
  }

  private moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `moveToFrontEnd()`);
    this.root.raise();
    if (this.callback != null) this.callback.onRaised(this);
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `moveToBackEnd()`);
    this.root.lower();
    if (this.callback != null) this.callback.onLowered(this);
  }

  /**
   * Delete this instance.
   */
  public delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TextLabel.TAG, `moveToBackEnd()`);
    this.resetState();
    this.root.remove();
  }

  private onLabelChanged(oldLabel: string, newLabel: string) {
    this._label = newLabel;
    this.relabel();

    if (this.callback != null) this.callback.onLabelChanged(this, oldLabel, newLabel);
  }

}

