import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { Point } from "./Util.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { LineContextMenu } from "../components/LineContextMenu.tsx";
import { LineContextMenuCallback } from "../components/LineContextMenu.tsx";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";
import { Element } from "./Element";
import { ElementItxMode } from "./Element";

/**
 * Callback interface for Line.
 */
export interface LineCallback {
  onSelected(selected: Line, isMulti: boolean): void;
  onDeselected(deselected: Line): void;

  onEditing(editing: Line, isMulti: boolean): void;
  onEdited(edited: Line): void;

  onDragStart(moved: Line): void;
  onDrag(moved: Line, plusX: number, plusY: number): void;
  onDragEnd(moved: Line): void;

  onRaised(raised: Line): void;
  onLowered(lowered: Line): void;

  onHistoricalChanged(line: Line): void;

}

/**
 * Line serialized JSON interface.
 */
export interface LineJson {
  [Def.KEY_UID]: number,
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
 * Base state class for Line state machine.
 */
class LineState {
  protected target: Line;
  constructor(target: Line) {
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
 *  Line class.
 */
export class Line extends Element {
  public static readonly TAG = "Line";
  public readonly TAG = Line.TAG;

  private static countId: number = 0;

  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;
  private readonly DEFAULT_WIDTH = 4;
  private readonly GRIP_ID_FROM = "from_grip";
  private readonly GRIP_ID_TO = "to_grip";

  private static IdleState = class extends LineState {
    enter() {
      this.target.setHighlight(false);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      switch (this.target.itxMode) {
        case ElementItxMode.SELECTABLE:
          this.target.currentState = new Line.SelectedState(this.target, withCtrl);
          break;

        case ElementItxMode.EDITABLE:
          this.target.currentState = new Line.EditingState(this.target, withCtrl);
          break;
      }
    }
  }

  private static SelectedState = class extends LineState {
    private isMulti: boolean;
    constructor(target: Line, isMulti: boolean) {
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
      this.target.currentState = new Line.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }
  }

  private static EditingState = class extends LineState {
    private isMulti: boolean;
    constructor(target: Line, isMulti: boolean) {
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
      this.target.currentState = new Line.IdleState(this.target);
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
   */
  constructor(uid: number, html: JQueryNode, svg: D3Node.SVG) {
    super(uid, html, svg);

    this.colorSet = this.colorSet; // Load defaut
    this._currentState = new Line.IdleState(this);
    this.width = this.DEFAULT_WIDTH;

    this._label = String(Line.countId);
    Line.countId++;
  }

  private _label: string;
  public get label(): string {
    return this._label;
  }

  private _currentState: LineState;
      private get currentState(): LineState {
        return this._currentState;
      }
      private set currentState(newState: LineState) {
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
   * Serialize Line object to LineJson Object.
   *
   * @return string LineJson Object.
   */
  public serialize(): LineJson {
    let jsonObj = {
        [Def.KEY_UID]: this.uid,
        [Def.KEY_CLASS]: Line.TAG,
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
   * Deserlialize Line object from JSON object.
   *
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return Line.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: LineJson): Line {
    let divLine = new Line(
        json[Def.KEY_UID],
        html,
        svg);
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
  private callback: LineCallback|null = null;

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
  public setCallback(callback: LineCallback) {
    this.callback = callback;
  }

  /**
   * Render.
   */
  public render() {
    this.root = this.svg.append("g")
        .attr("id", `line_${this._label}`)
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
   * Move this Line with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  public move(plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, `move() : plusX=${plusX}, plusY=${plusY}`);

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
        if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "on:click");

        if (d3.event.ctrlKey) {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, true);
        } else {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, false);
        }

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    this.path.on("contextmenu", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "on:contextmenu");

        // NOTICE: Click offset X-Y is based on viewport of polygon. (same as svg)
        this.currentState.onRightClicked(d3.event.offsetX, d3.event.offsetY);

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    this.root.call(
      d3.drag<SVGGElement, any, any>()
          .on("start", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "on:drag:start");
              if (this.currentState.isMovable()) {
                d3.event.target.origFromPoint = this.fromPoint;
                d3.event.target.origToPoint = this.toPoint;
                d3.event.target.startX = d3.event.x;
                d3.event.target.startY = d3.event.y;

                if (this.callback != null) this.callback.onDragStart(this);
              }
          } )
          .on("drag", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "on:drag:drag");
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
              if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "on:drag:end");
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
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "enableEditMode()");
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
              let isRadialSnapEnabled = d3.event.sourceEvent.shiftKey;

              let origFromPoint = d3.event.target.origFromPoint;
              let origToPoint = d3.event.target.origToPoint;

              let dx = d3.event.x - d3.event.target.startX;
              let dy = d3.event.y - d3.event.target.startY;

              // cX/cY = Center Point
              // pX/pY = Snap Point
              let calcRadialSnapXY = (cX: number, cY: number, pX: number, pY: number)
                  : { x: number, y: number } => {
                let x = pX - cX;
                let y = pY - cY;
                let r = Math.sqrt(x * x + y * y);
                let rawRad = Math.atan2(y, x); // [-PI, +PI]
                let radStep = Math.round(rawRad / Def.RADIAL_SNAP_STEP_RAD);
                let snapRad = radStep * Def.RADIAL_SNAP_STEP_RAD;

                let newX = Math.round(r * Math.cos(snapRad));
                let newY = Math.round(r * Math.sin(snapRad));

                return {
                  x: cX + newX,
                  y: cY + newY,
                };
              };

              switch (id) {
                case this.GRIP_ID_FROM: {
                  this.fromPoint = new Point(origFromPoint.x + dx, origFromPoint.y + dy);

                  // Snapping.
                  if (isSnapDragEnabled) {
                    if (isRadialSnapEnabled) {
                      let snappedXY = calcRadialSnapXY(
                          this.toPoint.x,
                          this.toPoint.y,
                          this.fromPoint.x,
                          this.fromPoint.y);
                      this.fromPoint = new Point(snappedXY.x, snappedXY.y);
                    } else {
                      let snapX = this.fromPoint.x % Def.SNAP_STEP_PIX;
                      let snapY = this.fromPoint.y % Def.SNAP_STEP_PIX;
                      this.fromPoint = new Point(this.fromPoint.x - snapX, this.fromPoint.y - snapY);
                    }
                  }
                }
                break;

                case this.GRIP_ID_TO: {
                  this.toPoint = new Point(origToPoint.x + dx, origToPoint.y + dy);

                  // Snapping.
                  if (isSnapDragEnabled) {
                    if (isRadialSnapEnabled) {
                      let snappedXY = calcRadialSnapXY(
                          this.fromPoint.x,
                          this.fromPoint.y,
                          this.toPoint.x,
                          this.toPoint.y);
                      this.toPoint = new Point(snappedXY.x, snappedXY.y);
                    } else {
                      let snapX = this.toPoint.x % Def.SNAP_STEP_PIX;
                      let snapY = this.toPoint.y % Def.SNAP_STEP_PIX;
                      this.toPoint = new Point(this.toPoint.x - snapX, this.toPoint.y - snapY);
                    }
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
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "disableEditMode()");
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

  private ContextMenuCallbackImpl = class implements LineContextMenuCallback {
    private target: Line;

    constructor(target: Line) {
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
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "openContextMenu()");

    this.html.css("display", "block");

    ReactDOM.render(
        <LineContextMenu
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={clickX}
            topPix={clickY}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, "closeContextMenu()");

    let container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, `moveToFrontEnd()`);
    this.root.raise();
    if (this.callback != null) this.callback.onRaised(this);
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, `moveToBackEnd()`);
    this.root.lower();
    if (this.callback != null) this.callback.onLowered(this);
  }

  /**
   * Delete this instance.
   */
  public delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Line.TAG, `moveToBackEnd()`);
    this.resetState();
    this.root.remove();
  }

}

