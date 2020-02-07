import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { Point } from "./Util.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { DividerLineContextMenu } from "../components/DividerLineContextMenu.tsx";
import { DividerLineContextMenuCallback } from "../components/DividerLineContextMenu.tsx";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";
import { Element } from "./Element";
import { ElementItxMode } from "./Element";

/**
 * Callback interface for DividerLine.
 */
export interface DividerLineCallback {
  onSelected(selected: DividerLine, isMulti: boolean): void;
  onDeselected(deselected: DividerLine): void;

  onEditing(editing: DividerLine, isMulti: boolean): void;
  onEdited(edited: DividerLine): void;

  onDragStart(moved: DividerLine): void;
  onDrag(moved: DividerLine, plusX: number, plusY: number): void;
  onDragEnd(moved: DividerLine): void;

  onRaised(raised: DividerLine): void;
  onLowered(lowered: DividerLine): void;

  onHistoricalChanged(line: DividerLine): void;

}

/**
 * DividerLine serialized JSON interface.
 */
export interface DividerLineJson {
  [Def.KEY_CLASS]: string,
  [Def.KEY_DIMENS]: {
      [Def.KEY_FROM_X]: number,
      [Def.KEY_FROM_Y]: number,
      [Def.KEY_TO_X]: number,
      [Def.KEY_TO_Y]: number,
      [Def.KEY_WIDTH]: number,
  },
  [Def.KEY_COLOR_SET]: string,
}

/**
 * Base state class for DividerLine state machine.
 */
class DividerLineState {
  protected target: DividerLine;
  constructor(target: DividerLine) {
    this.target = target;
  }

  enter() {
  }

  exit() {
  }

  onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
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
 * Divider Line class.
 */
export class DividerLine extends Element {
  public static readonly TAG = "DividerLine";
  public readonly TAG = DividerLine.TAG;

  private static countId: number = 0;

  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;
  private readonly DEFAULT_WIDTH = 4;
  private readonly GRIP_ID_FROM = "from_grip";
  private readonly GRIP_ID_TO = "to_grip";

  private static IdleState = class extends DividerLineState {
    enter() {
      this.target.setHighlight(false);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      switch (this.target.itxMode) {
        case ElementItxMode.SELECTABLE:
          this.target.currentState = new DividerLine.SelectedState(this.target, withCtrl);
          break;

        case ElementItxMode.EDITABLE:
          this.target.currentState = new DividerLine.EditingState(this.target, withCtrl);
          break;
      }
    }
  }

  private static SelectedState = class extends DividerLineState {
    private isMulti: boolean;
    constructor(target: DividerLine, isMulti: boolean) {
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
      this.target.currentState = new DividerLine.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }
  }

  private static EditingState = class extends DividerLineState {
    private isMulti: boolean;
    constructor(target: DividerLine, isMulti: boolean) {
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
      this.target.currentState = new DividerLine.IdleState(this.target);
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
   * @param html HTML root view. Used for non-svg contents like as pop-up window.
   * @param svg SVG root object.
   */
  constructor(html: JQueryNode, svg: D3Node.SVG) {
      super(html, svg);

      this.colorSet = this.colorSet; // Load defaut
      this._currentState = new DividerLine.IdleState(this);
      this.width = this.DEFAULT_WIDTH;

      this._label = String(DividerLine.countId);
      DividerLine.countId++;
  }

  private _label: string;
  public get label(): string {
    return this._label;
  }

  private _currentState: DividerLineState;
      private get currentState(): DividerLineState {
        return this._currentState;
      }
      private set currentState(newState: DividerLineState) {
        this._currentState.exit();
        this._currentState = newState;
        this._currentState.enter();
      }

  private _itxMode: ElementItxMode = ElementItxMode.RIGID;
      public get itxMode(): ElementItxMode {
        return this._itxMode;
      }
      public set itxMode(mode: ElementItxMode) {
        this._itxMode = mode;
      }

  /**
   * Serialize DividerLine object to DividerLineJson Object.
   *
   * @return string DividerLineJson Object.
   */
  public serialize(): DividerLineJson {
    let jsonObj = {
        [Def.KEY_CLASS]: DividerLine.TAG,
        [Def.KEY_DIMENS]: {
            [Def.KEY_FROM_X]: this.fromPoint.x,
            [Def.KEY_FROM_Y]: this.fromPoint.y,
            [Def.KEY_TO_X]: this.toPoint.x,
            [Def.KEY_TO_Y]: this.toPoint.y,
            [Def.KEY_WIDTH]: this.width,
        },
        [Def.KEY_COLOR_SET]: this.colorSet,
    };
    return jsonObj;
  }

  /**
   * Deserlialize DividerLine object from JSON object.
   *
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return DividerLine.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: DividerLineJson): DividerLine {
    let divLine = new DividerLine(html, svg);
    divLine.setDimens(
        new Point(json[Def.KEY_DIMENS][Def.KEY_FROM_X], json[Def.KEY_DIMENS][Def.KEY_FROM_Y]),
        new Point(json[Def.KEY_DIMENS][Def.KEY_TO_X], json[Def.KEY_DIMENS][Def.KEY_TO_Y]),
        json[Def.KEY_DIMENS][Def.KEY_WIDTH]);
    divLine.colorSet = ColorSet.valueOf(json[Def.KEY_COLOR_SET]);
    return divLine;
  }

  // Elements.
  private root!: D3Node.G;
  private path!: D3Node.Path;
  private editor: D3Node.G|null = null;

  // Position/Size.
  private fromPoint: Point = new Point(0, 0);
  private toPoint: Point = new Point(0, 0);
  private width: number;

  // Color resolver functions.
  private _colorSet: ColorSet = ColorSet.GRAY;
      public get colorSet(): ColorSet {
        return this._colorSet;
      }
      public set colorSet(colorSet: ColorSet) {
        this._colorSet = colorSet;
        this.colorResolver = ColorSet.resolve(colorSet);
      }

  private colorResolver!: ColorResolver;

  // Callback.
  private callback: DividerLineCallback|null = null;

  private runNoCallback(proc: () => void) {
    let cb = this.callback;
    this.callback = null;
    proc();
    this.callback = cb;
  }

  /**
   * Set FROM/TO X-Y coordinates.
   *
   * @param fromX
   * @param fromY
   * @param toX
   * @param toY
   */
  public setFromToXY(fromX: number, fromY: number, toX: number, toY: number) {
    this.fromPoint = new Point(fromX, fromY);
    this.toPoint = new Point(toX, toY);
    this.relayout();
  }

  /**
   * Get FROM/TO X-Y coordinates.
   *
   * @return {fromX, fromY, toX, toY}
   */
  public getFromToXY(): {fromX: number, fromY: number, toX: number, toY:number} {
    return {
        fromX: this.fromPoint.x,
        fromY: this.fromPoint.y,
        toX: this.toPoint.x,
        toY: this.toPoint.y,
    };
  }

  /**
   * Update total dimension values.
   *
   * @param fromPoint FROM anchor point.
   * @param toPoint TO anchor point.
   * @param width
   */
  public setDimens(
      fromPoint: Point|null,
      toPoint: Point|null,
      width: number|null) {
    if (fromPoint != null) this.fromPoint = fromPoint;
    if (toPoint != null) this.toPoint = toPoint;
    if (width != null) this.width = width;
  }

  /**
   * Set callback object.
   *
   * @param callback Callback object.
   */
  public setCallback(callback: DividerLineCallback) {
    this.callback = callback;
  }

  /**
   * Reset state to idle.
   */
  public resetState() {
    this.currentState.reset();
  }

  /**
   * Render.
   */
  public render() {
    this.root = this.svg.append("g")
        .attr("id", `dividerline_${this._label}`)
        .datum(this);

    // Line path.
    this.path = this.root.append("path")
        .attr("id", "path")
        .attr("fill", "none");

    this.relayout();
    this.recolor();

    // Callbacks.
    this.registerCallbacks();
  }

  private setHighlight(isHighlight: boolean) {
    if (isHighlight) {
      this.path.attr("stroke", this.colorResolver.bgHighlight);
    } else {
      this.path.attr("stroke", this.colorResolver.bg);
    }
  }

  /**
   * Select this DividerLine as single selection.
   */
  public selectSingleNoCallback() {
    this.selectNoCallback(false);
  }

  /**
   * Select this DividerLine as multi selection.
   */
  public selectMultiNoCallback() {
    this.selectNoCallback(true);
  }

  private selectNoCallback(isMulti: boolean) {
    this.runNoCallback( () => {
      this.currentState.onLeftClicked(0, 0, isMulti);
    } );
  }

  /**
   * Deselected by other UI. Callback is NOT invoked.
   */
  public deselectNoCallback() {
    this.runNoCallback( () => {
      this.currentState.onCanceled();
    } );
  }

  /**
   * Reset state without callback invocation.
   */
  public resetStateNoCallback() {
    this.runNoCallback( () => {
      this.currentState.reset();
    } );
  }

  /**
   * Move this DividerLine with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  public move(plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, `move() : plusX=${plusX}, plusY=${plusY}`);

    this.fromPoint = new Point(this.fromPoint.x + plusX, this.fromPoint.y + plusY);
    this.toPoint = new Point(this.toPoint.x + plusX, this.toPoint.y + plusY);

    this.checkLayoutLimit();
    this.relayout();
  }

  private checkLayoutLimit() {
    // Top-Left edge limit check. Bottom-Right edge is movable, so skip check.

    let minX: number = Math.min(this.fromPoint.x, this.toPoint.x, 0);
    let minY: number = Math.min(this.fromPoint.y, this.toPoint.y, 0);

    this.fromPoint = new Point(this.fromPoint.x - minX, this.fromPoint.y - minY);
    this.toPoint = new Point(this.toPoint.x - minX, this.toPoint.y - minY);

  }

  private registerCallbacks() {
    this.path.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "on:click");

        if (d3.event.ctrlKey) {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, true);
        } else {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, false);
        }

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    this.path.on("contextmenu", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "on:contextmenu");

        this.currentState.onRightClicked(d3.event.x, d3.event.y);

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    this.root.call(
      d3.drag<SVGGElement, any, any>()
          .on("start", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "on:drag:start");
              if (this.currentState.isMovable()) {
                d3.event.target.origFromPoint = this.fromPoint;
                d3.event.target.origToPoint = this.toPoint;
                d3.event.target.startX = d3.event.x;
                d3.event.target.startY = d3.event.y;

                if (this.callback != null) this.callback.onDragStart(this);
              }
          } )
          .on("drag", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "on:drag:drag");
              if (this.currentState.isMovable()) {
                let isSnapDragEnabled = d3.event.sourceEvent.altKey;

                let origFromPoint = d3.event.target.origFromPoint;
                let origToPoint = d3.event.target.origToPoint;

                let dx = d3.event.x - d3.event.target.startX;
                let dy = d3.event.y - d3.event.target.startY;

                let oldFromPoint = this.fromPoint; // to calc diff of this step.

                this.fromPoint = new Point(origFromPoint.x + dx, origFromPoint.y + dy);
                this.toPoint = new Point(origToPoint.x + dx, origToPoint.y + dy);

                // Position snapping.
                // Snap control is based on FROM point.
                if (isSnapDragEnabled) {
                  let snapX = this.fromPoint.x % Def.SNAP_STEP_PIX;
                  let snapY = this.fromPoint.y % Def.SNAP_STEP_PIX;

                  this.fromPoint = new Point(this.fromPoint.x - snapX, this.fromPoint.y - snapY);
                  this.toPoint = new Point(this.toPoint.x - snapX, this.toPoint.y - snapY);
                }

                this.checkLayoutLimit();
                this.relayout();

                let plusX = this.fromPoint.x - oldFromPoint.x;
                let plusY = this.fromPoint.y - oldFromPoint.y;
                if (this.callback != null) this.callback.onDrag(this, plusX, plusY);
              }
          } )
          .on("end", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "on:drag:end");
              if (this.currentState.isMovable()) {
                d3.event.target.origFromPoint = new Point(0, 0);
                d3.event.target.origToPoint = new Point(0, 0);
                d3.event.target.startX = 0;
                d3.event.target.startY = 0;

                if (this.callback != null) this.callback.onDragEnd(this);

                if (this.callback != null) this.callback.onHistoricalChanged(this);
              }
          } )
      );
  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "enableEditMode()");
    if (this.editor != null) return;

    this.editor = this.root.append("g")
        .attr("id", "editor_plane");

    this.addEditGrip(this.GRIP_ID_FROM, this.fromPoint.x, this.fromPoint.y);
    this.addEditGrip(this.GRIP_ID_TO, this.toPoint.x, this.toPoint.y);

  }

  private addEditGrip(id: string, cx: number, cy: number): any {
    if (this.editor == null) return;

    let TAG = "EditGrip";

    let circle = this.editor.append("circle")
        .attr("id", id)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("fill", this.colorResolver.bgHighlight)
        .attr("r", this.EDIT_GRIP_RADIUS_PIX);

    circle.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
        d3.event.stopPropagation();
    });

    circle.call(
      d3.drag<SVGCircleElement, any, any>()
          .on("start", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");

              d3.event.target.origFromPoint = this.fromPoint;
              d3.event.target.origToPoint = this.toPoint;
              d3.event.target.startX = d3.event.x;
              d3.event.target.startY = d3.event.y;

          } )
          .on("drag", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              let isSnapDragEnabled = d3.event.sourceEvent.altKey;

              let origFromPoint = d3.event.target.origFromPoint;
              let origToPoint = d3.event.target.origToPoint;

              let dx = d3.event.x - d3.event.target.startX;
              let dy = d3.event.y - d3.event.target.startY;

              switch (id) {
                case this.GRIP_ID_FROM: {
                  this.fromPoint = new Point(origFromPoint.x + dx, origFromPoint.y + dy);

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = this.fromPoint.x % Def.SNAP_STEP_PIX;
                    let snapY = this.fromPoint.y % Def.SNAP_STEP_PIX;
                    this.fromPoint = new Point(this.fromPoint.x - snapX, this.fromPoint.y - snapY);
                  }
                }
                break;

                case this.GRIP_ID_TO: {
                  this.toPoint = new Point(origToPoint.x + dx, origToPoint.y + dy);

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = this.toPoint.x % Def.SNAP_STEP_PIX;
                    let snapY = this.toPoint.y % Def.SNAP_STEP_PIX;
                    this.toPoint = new Point(this.toPoint.x - snapX, this.toPoint.y - snapY);
                  }
                }
                break;

              }

              this.relayout();

          } )
          .on("end", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              d3.event.target.origFromPoint = new Point(0, 0);
              d3.event.target.origToPoint = new Point(0, 0);
              d3.event.target.startX = 0;
              d3.event.target.startY = 0;

              if (this.callback != null) this.callback.onHistoricalChanged(this);
          } )
    );
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "disableEditMode()");
    if (this.editor == null) return;

    this.editor.remove();
    this.editor = null;
  }

  private relayout() {
    // Line.
    if (this.path != null) {
      let lineData: [number, number][] = [
        [this.fromPoint.x, this.fromPoint.y],
        [this.toPoint.x, this.toPoint.y],
      ];
      let line = d3.line()
          .x( (d) => { return d[0] } )
          .y( (d) => { return d[1] } )
          .curve(d3.curveLinear);

      this.path
          .datum(lineData)
          .attr("d", line)
          .attr("stroke-width", this.width);
    }

    // Grips.
    if (this.editor != null) {
      let fromGrip = this.editor.select(`#${this.GRIP_ID_FROM}`);
      fromGrip.attr("cx", this.fromPoint.x);
      fromGrip.attr("cy", this.fromPoint.y);

      let toGrip = this.editor.select(`#${this.GRIP_ID_TO}`);
      toGrip.attr("cx", this.toPoint.x);
      toGrip.attr("cy", this.toPoint.y);

    }

  }

  private recolor() {
    this.path.attr("stroke", this.colorResolver.bg);

  }

  private ContextMenuCallbackImpl = class implements DividerLineContextMenuCallback {
    private target: DividerLine;

    constructor(target: DividerLine) {
      this.target = target;
    }

    close() {
      this.target.closeContextMenu();

      if (this.target.callback != null) this.target.callback.onHistoricalChanged(this.target);
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

  }

  private openContextMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "openContextMenu()");

    this.html.css("display", "block");

    // Position.
    let offsetX = 0;
    let offsetY = 0;
    let htmlOffset = this.html.offset();
    if (htmlOffset != undefined) {
        offsetX = htmlOffset.left;
        offsetY = htmlOffset.top;
    }
    let leftPix: number = clickX - offsetX;
    let topPix: number = clickY - offsetY;

    ReactDOM.render(
        <DividerLineContextMenu
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={leftPix}
            topPix={topPix}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, "closeContextMenu()");

    let container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, `moveToFrontEnd()`);
    this.root.raise();
    if (this.callback != null) this.callback.onRaised(this);
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, `moveToBackEnd()`);
    this.root.lower();
    if (this.callback != null) this.callback.onLowered(this);
  }

  /**
   * Delete this instance.
   */
  public delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(DividerLine.TAG, `moveToBackEnd()`);
    this.resetStateNoCallback();
    this.root.remove();
  }

}

