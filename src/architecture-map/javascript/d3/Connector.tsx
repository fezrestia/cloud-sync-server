import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { Point } from "./Util.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { ConnectorContextMenu } from "../components/ConnectorContextMenu.tsx";
import { ConnectorContextMenuCallback } from "../components/ConnectorContextMenu.tsx";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";
import { Element } from "./Element";
import { ElementItxMode } from "./Element";
import { ArchMod } from "./ArchMod";
import { Marker } from "./Marker";
import { MarkerType } from "./Marker";

/**
 * Callback interface for Connector.
 */
export interface ConnectorCallback {
  onSelected(selected: Connector, isMulti: boolean): void;
  onDeselected(deselected: Connector): void;

  onEditing(editing: Connector, isMulti: boolean): void;
  onEdited(edited: Connector): void;

  onDragStart(moved: Connector): void;
  onDrag(moved: Connector, plusX: number, plusY: number): void;
  onDragEnd(moved: Connector): void;

  onRaised(raised: Connector): void;
  onLowered(lowered: Connector): void;

  onHistoricalChanged(line: Connector): void;

  queryArchMod(uid: number): ArchMod;

}

/**
 * Connector serialized JSON interface.
 */
export interface ConnectorJson {
  [Def.KEY_UID]: number,
  [Def.KEY_CLASS]: string,
  [Def.KEY_FROM_UID]: number,
  [Def.KEY_TO_UID]: number,
  [Def.KEY_DIMENS]: {
      [Def.KEY_FROM_X]: number,
      [Def.KEY_FROM_Y]: number,
      [Def.KEY_TO_X]: number,
      [Def.KEY_TO_Y]: number,
      [Def.KEY_WIDTH]: number,
  },
  [Def.KEY_FROM_MARKER_TYPE]: string,
  [Def.KEY_TO_MARKER_TYPE]: string,
  [Def.KEY_COLOR_SET]: string,
}

/**
 * Base state class for Connector state machine.
 */
class ConnectorState {
  protected target: Connector;
  constructor(target: Connector) {
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
 * Line class.
 */
export class Connector extends Element {
  public static readonly TAG = "Connector";
  public readonly TAG = Connector.TAG;

  private static countId: number = 0;

  private static readonly EDIT_GRIP_RADIUS_PIX = 8;
  private static readonly MIN_SIZE_PIX = 16;
  private static readonly DEFAULT_WIDTH = 4;
  private static readonly GRIP_ID_FROM = "from_grip";
  private static readonly GRIP_ID_TO = "to_grip";

  private static readonly DEFAULT_COLOR_SET = ColorSet.GRAY;

  private static readonly DEFAULT_FROM_MARKER_TYPE = MarkerType.NONE;
  private static readonly DEFAULT_TO_MARKER_TYPE = MarkerType.NONE;

  private static readonly ENABLE_HIGH_SPEED_RENDERING = false;

  private static IdleState = class extends ConnectorState {
    enter() {
      this.target.isHighlight = false;
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      switch (this.target.itxMode) {
        case ElementItxMode.SELECTABLE:
          this.target.currentState = new Connector.SelectedState(this.target, withCtrl);
          break;

        case ElementItxMode.EDITABLE:
          this.target.currentState = new Connector.EditingState(this.target, withCtrl);
          break;
      }
    }
  }

  private static SelectedState = class extends ConnectorState {
    private isMulti: boolean;
    constructor(target: Connector, isMulti: boolean) {
      super(target);
      this.isMulti = isMulti;
    }

    enter() {
      this.target.isHighlight = true;
      if (this.target.callback != null) this.target.callback.onSelected(this.target, this.isMulti);
    }

    exit() {
      this.target.isHighlight = false;
      if (this.target.callback != null) this.target.callback.onDeselected(this.target);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      this.onCanceled();
    }

    onCanceled() {
      this.target.currentState = new Connector.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }
  }

  private static EditingState = class extends ConnectorState {
    private isMulti: boolean;
    constructor(target: Connector, isMulti: boolean) {
      super(target);
      this.isMulti = isMulti;
    }

    enter() {
      this.target.isHighlight = true;
      this.target.enableEditMode();
      if (this.target.callback != null) this.target.callback.onEditing(this.target, this.isMulti);
    }

    exit() {
      this.target.closeContextMenu();
      this.target.isHighlight = false;
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
      this.target.currentState = new Connector.IdleState(this.target);
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

    this.colorSet = Connector.DEFAULT_COLOR_SET;

    this._currentState = new Connector.IdleState(this);

    this._label = String(Connector.countId);
    Connector.countId++;
  }

  private _label: string;
  public get label(): string {
    return this._label;
  }

  private _currentState: ConnectorState;
      private get currentState(): ConnectorState {
        return this._currentState;
      }
      private set currentState(newState: ConnectorState) {
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

  private _fromMarkerType: MarkerType = Connector.DEFAULT_FROM_MARKER_TYPE;
      public get fromMarkerType(): MarkerType {
        return this._fromMarkerType;
      }
      public set fromMarkerType(end: MarkerType) {
        this._fromMarkerType = end;
        this.relayout();
        this.recolor();
      }

  private _toMarkerType: MarkerType = Connector.DEFAULT_TO_MARKER_TYPE;
      public get toMarkerType(): MarkerType {
        return this._toMarkerType;
      }
      public set toMarkerType(end: MarkerType) {
        this._toMarkerType = end;
        this.relayout();
        this.recolor();
      }

  private _isHighlight: boolean = false;
      private get isHighlight(): boolean {
        return this._isHighlight;
      }
      private set isHighlight(highlight: boolean) {
        this._isHighlight = highlight;
        this.recolor();
      }

  /**
   * Serialize Connector object to ConnectorJson Object.
   *
   * @return string ConnectorJson Object.
   */
  public serialize(): ConnectorJson {
    let jsonObj = {
        [Def.KEY_UID]: this.uid,
        [Def.KEY_CLASS]: Connector.TAG,
        [Def.KEY_FROM_UID]: this.fromUid,
        [Def.KEY_TO_UID]: this.toUid,
        [Def.KEY_DIMENS]: {
            [Def.KEY_FROM_X]: this.fromPoint.x,
            [Def.KEY_FROM_Y]: this.fromPoint.y,
            [Def.KEY_TO_X]: this.toPoint.x,
            [Def.KEY_TO_Y]: this.toPoint.y,
            [Def.KEY_WIDTH]: this.width,
        },
        [Def.KEY_FROM_MARKER_TYPE]: this.fromMarkerType,
        [Def.KEY_TO_MARKER_TYPE]: this.toMarkerType,
        [Def.KEY_COLOR_SET]: this.colorSet,
    };
    return jsonObj;
  }

  /**
   * Deserlialize Connector object from JSON object.
   *
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return Connector.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: ConnectorJson): Connector {
    let connector = new Connector(
        json[Def.KEY_UID],
        html,
        svg);

    (connector as any).fromUid = json[Def.KEY_FROM_UID];
    (connector as any).toUid = json[Def.KEY_TO_UID];

    let fromX = json[Def.KEY_DIMENS][Def.KEY_FROM_X];
    let fromY = json[Def.KEY_DIMENS][Def.KEY_FROM_Y];
    let toX = json[Def.KEY_DIMENS][Def.KEY_TO_X];
    let toY = json[Def.KEY_DIMENS][Def.KEY_TO_Y];

    (connector as any).fromPoint =  new Point(fromX, fromY);
    (connector as any).toPoint =  new Point(toX, toY);
    (connector as any).width = json[Def.KEY_DIMENS][Def.KEY_WIDTH];

    (connector as any)._fromMarkerType = MarkerType.valueOf(json[Def.KEY_FROM_MARKER_TYPE]);
    (connector as any)._toMarkerType = MarkerType.valueOf(json[Def.KEY_TO_MARKER_TYPE]);

    connector.colorSet = ColorSet.valueOf(json[Def.KEY_COLOR_SET]);

    return connector;
  }

  // Elements.
  private root!: D3Node.G;
  private path!: D3Node.Path;
  private editor: D3Node.G|null = null;

  // Position/Size.
  private fromUid: number = 0;
  private toUid: number = 0;
  private fromPoint: Point = new Point(0, 0);
  private toPoint: Point = new Point(0, 0);
  private width: number = Connector.DEFAULT_WIDTH;

  // Color resolver functions.
  private _colorSet!: ColorSet;
      public get colorSet(): ColorSet {
        return this._colorSet;
      }
      public set colorSet(colorSet: ColorSet) {
        this._colorSet = colorSet;
        this.colorResolver = ColorSet.resolve(colorSet);
      }

  private colorResolver!: ColorResolver;

  // Callback.
  private callback: ConnectorCallback|null = null;

  private runNoCallback(proc: () => void) {
    let cb = this.callback;
    this.callback = null;
    proc();
    this.callback = cb;
  }

  /**
   * Set FROM/TO ArchMod element.
   *
   * @param fromArchMod
   * @param toArchMod
   */
  public setFromToArchMod(fromArchMod: ArchMod, toArchMod: ArchMod) {
    this.fromUid = fromArchMod.uid;
    this.toUid = toArchMod.uid;

    let fromConnPoints = fromArchMod.getFromConnectorPoints();
    let toConnPoints = toArchMod.getToConnectorPoints();

    // Initial values.
    let minDiff = Number.MAX_SAFE_INTEGER;
    let validFromPoint = fromConnPoints[fromConnPoints.length - 1]; // Most bottom.
    let validToPoint = toConnPoints[0]; // Most top.

    fromConnPoints.forEach( (fromP: Point) => {
      toConnPoints.forEach( (toP: Point) => {
        let diff = Math.pow(toP.x - fromP.x, 2) + Math.pow(toP.y - fromP.y, 2);

        if (diff < minDiff) {
          validFromPoint = fromP;
          validToPoint = toP;

          minDiff = diff;
        }

      } );
    } );

    this.fromPoint = validFromPoint;
    this.toPoint = validToPoint;

    this.relayout();
  }

  /**
   * Update FROM/TO connection points.
   */
  public updateConnectionPoints() {
    if (this.callback != null) {
      let fromArchMod = this.callback.queryArchMod(this.fromUid);
      let toArchMod = this.callback.queryArchMod(this.toUid);

      this.setFromToArchMod(fromArchMod, toArchMod);
    }
  }

  /**
   * This connector is FROM @uid or not.
   *
   * @param uid
   * @return Connected FROM uid or not.
   */
  public isConnectedFrom(uid: number) {
    return this.fromUid == uid;
  }

  /**
   * This connector is TO @uid or not.
   *
   * @param uid
   * @return Connected TO uid or not.
   */
  public isConnectedTo(uid: number) {
    return this.toUid == uid;
  }

  /**
   * This connector is connected to @uid or not.
   *
   * @param uid
   * @return Connected or not.
   */
  public isConnected(uid: number) {
    return this.isConnectedFrom(uid) || this.isConnectedTo(uid);
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
   * Change stroke width.
   *
   * @param strokeWidth
   */
  public changeStrokeWidth(strokeWidth: number) {
    this.width = strokeWidth;
    this.relayout();

  }

  /**
   * Change connecto end style.
   *
   * @param fromMarkerType null means NOP.
   * @param toMarkerType null means NOP.
   */
  public changeMarkerType(fromMarkerType: MarkerType|null, toMarkerType: MarkerType|null) {
    if (fromMarkerType != null) {
      this.fromMarkerType = fromMarkerType;
    }

    if (toMarkerType != null) {
      this.toMarkerType = toMarkerType;
    }

  }

  /**
   * Set callback object.
   *
   * @param callback Callback object.
   */
  public setCallback(callback: ConnectorCallback) {
    this.callback = callback;
  }

  /**
   * Render.
   */
  public render() {
    this.root = this.svg.append("g")
        .attr("id", `connector_${this._label}`)
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

  // @Override
  public move(plusX: number, plusY: number) {
    alert(`Connector.move() is NEVER used`);
  }

  /**
   * Move FROM connect point.
   *
   * @plusX Move step in pixels
   * @plusY Move step in pixels
   */
  public moveFromPoint(plusX: number, plusY: number) {
    this.fromPoint = new Point(this.fromPoint.x + plusX, this.fromPoint.y + plusY);
    this.relayout();
  }

  /**
   * Move TO connect point.
   *
   * @plusX Move step in pixels
   * @plusY Move step in pixels
   */
  public moveToPoint(plusX: number, plusY: number) {
    this.toPoint = new Point(this.toPoint.x + plusX, this.toPoint.y + plusY);
    this.relayout();
  }

  private registerCallbacks() {
    this.path.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "on:click");

        if (d3.event.ctrlKey) {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, true);
        } else {
          this.currentState.onLeftClicked(d3.event.x, d3.event.y, false);
        }

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

    this.path.on("contextmenu", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "on:contextmenu");

        // NOTICE: Click offset X-Y is based on viewport of polygon. (same as svg)
        this.currentState.onRightClicked(d3.event.offsetX, d3.event.offsetY);

        d3.event.stopPropagation();
        d3.event.preventDefault();
    });

  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "enableEditMode()");
    if (this.editor != null) return;

    this.editor = this.root.append("g")
        .attr("id", "editor_plane");

    if (this.fromMarkerType == MarkerType.NONE) {
      this.addEditGrip(Connector.GRIP_ID_FROM, this.fromPoint.x, this.fromPoint.y);
    }
    if (this.toMarkerType == MarkerType.NONE) {
      this.addEditGrip(Connector.GRIP_ID_TO, this.toPoint.x, this.toPoint.y);
    }

    this.relayout();
    this.recolor();

  }

  private addEditGrip(id: string, cx: number, cy: number): any {
    if (this.editor == null) return;

    let TAG = "EditGrip";

    let grip = this.editor.append("rect")
        .attr("id", id);

    grip.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
        d3.event.stopPropagation();
    });

//    grip.call(
//      d3.drag<SVGRectElement, any, any>()
//          .on("start", () => {
//              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");
//
//              d3.event.target.origFromPoint = this.fromPoint;
//              d3.event.target.origToPoint = this.toPoint;
//              d3.event.target.startX = d3.event.x;
//              d3.event.target.startY = d3.event.y;
//
//          } )
//          .on("drag", () => {
//              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");
//
//              let isSnapDragEnabled = d3.event.sourceEvent.altKey;
//              let isRadialSnapEnabled = d3.event.sourceEvent.shiftKey;
//
//              let origFromPoint = d3.event.target.origFromPoint;
//              let origToPoint = d3.event.target.origToPoint;
//
//              let dx = d3.event.x - d3.event.target.startX;
//              let dy = d3.event.y - d3.event.target.startY;
//
//              // cX/cY = Center Point
//              // pX/pY = Snap Point
//              let calcRadialSnapXY = (cX: number, cY: number, pX: number, pY: number)
//                  : { x: number, y: number } => {
//                let x = pX - cX;
//                let y = pY - cY;
//                let r = Math.sqrt(x * x + y * y);
//                let rawRad = Math.atan2(y, x); // [-PI, +PI]
//                let radStep = Math.round(rawRad / Def.RADIAL_SNAP_STEP_RAD);
//                let snapRad = radStep * Def.RADIAL_SNAP_STEP_RAD;
//
//                let newX = Math.round(r * Math.cos(snapRad));
//                let newY = Math.round(r * Math.sin(snapRad));
//
//                return {
//                  x: cX + newX,
//                  y: cY + newY,
//                };
//              };
//
//              switch (id) {
//                case Connector.GRIP_ID_FROM: {
//                  this.fromPoint = new Point(origFromPoint.x + dx, origFromPoint.y + dy);
//
//                  // Snapping.
//                  if (isSnapDragEnabled) {
//                    if (isRadialSnapEnabled) {
//                      let snappedXY = calcRadialSnapXY(
//                          this.toPoint.x,
//                          this.toPoint.y,
//                          this.fromPoint.x,
//                          this.fromPoint.y);
//                      this.fromPoint = new Point(snappedXY.x, snappedXY.y);
//                    } else {
//                      let snapX = this.fromPoint.x % Def.SNAP_STEP_PIX;
//                      let snapY = this.fromPoint.y % Def.SNAP_STEP_PIX;
//                      this.fromPoint = new Point(this.fromPoint.x - snapX, this.fromPoint.y - snapY);
//                    }
//                  }
//                }
//                break;
//
//                case Connector.GRIP_ID_TO: {
//                  this.toPoint = new Point(origToPoint.x + dx, origToPoint.y + dy);
//
//                  // Snapping.
//                  if (isSnapDragEnabled) {
//                    if (isRadialSnapEnabled) {
//                      let snappedXY = calcRadialSnapXY(
//                          this.fromPoint.x,
//                          this.fromPoint.y,
//                          this.toPoint.x,
//                          this.toPoint.y);
//                      this.toPoint = new Point(snappedXY.x, snappedXY.y);
//                    } else {
//                      let snapX = this.toPoint.x % Def.SNAP_STEP_PIX;
//                      let snapY = this.toPoint.y % Def.SNAP_STEP_PIX;
//                      this.toPoint = new Point(this.toPoint.x - snapX, this.toPoint.y - snapY);
//                    }
//                  }
//                }
//                break;
//
//              }
//
//              this.relayout();
//
//          } )
//          .on("end", () => {
//              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");
//
//              d3.event.target.origFromPoint = new Point(0, 0);
//              d3.event.target.origToPoint = new Point(0, 0);
//              d3.event.target.startX = 0;
//              d3.event.target.startY = 0;
//
//              if (this.callback != null) this.callback.onHistoricalChanged(this);
//          } )
//    );
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "disableEditMode()");
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

      // Marker.
      Marker.prepareMarkers(this.svg, this.colorSet);
      Marker.updateMarkers(
          this.path,
          this.fromMarkerType,
          this.toMarkerType,
          this.colorSet,
          this.isHighlight,
          Connector.ENABLE_HIGH_SPEED_RENDERING);
    }

    // Grips.
    if (this.editor != null) {
      let fromGrip = this.editor.select(`#${Connector.GRIP_ID_FROM}`);
      fromGrip.attr("x", this.fromPoint.x - Connector.EDIT_GRIP_RADIUS_PIX)
      fromGrip.attr("y", this.fromPoint.y - Connector.EDIT_GRIP_RADIUS_PIX)
      fromGrip.attr("width", Connector.EDIT_GRIP_RADIUS_PIX * 2)
      fromGrip.attr("height", Connector.EDIT_GRIP_RADIUS_PIX * 2)

      let toGrip = this.editor.select(`#${Connector.GRIP_ID_TO}`);
      toGrip.attr("x", this.toPoint.x - Connector.EDIT_GRIP_RADIUS_PIX)
      toGrip.attr("y", this.toPoint.y - Connector.EDIT_GRIP_RADIUS_PIX)
      toGrip.attr("width", Connector.EDIT_GRIP_RADIUS_PIX * 2)
      toGrip.attr("height", Connector.EDIT_GRIP_RADIUS_PIX * 2)

    }

  }

  private recolor() {
    let color;
    if (this.isHighlight) {
      color = this.colorResolver.bgHighlight;
    } else {
      color = this.colorResolver.bg;
    }

    this.path.attr("stroke", color);

    if (this.editor != null) {
      let fromGrip = this.editor.select(`#${Connector.GRIP_ID_FROM}`);
      fromGrip.attr("fill", this.colorResolver.bgHighlight);

      let toGrip = this.editor.select(`#${Connector.GRIP_ID_TO}`);
      toGrip.attr("fill", this.colorResolver.bgHighlight);

    }

    if (this.path != null) {
      // Marker.
      Marker.prepareMarkers(this.svg, this.colorSet);
      Marker.updateMarkers(
          this.path,
          this.fromMarkerType,
          this.toMarkerType,
          this.colorSet,
          this.isHighlight,
          Connector.ENABLE_HIGH_SPEED_RENDERING);
    }

  }

  private ContextMenuCallbackImpl = class implements ConnectorContextMenuCallback {
    private target: Connector;

    constructor(target: Connector) {
      this.target = target;
    }

    close() {
      this.target.closeContextMenu();

      if (this.target.callback != null) this.target.callback.onHistoricalChanged(this.target);
    }

    changeFromMarkerType(markerType: MarkerType) {
      this.target.fromMarkerType = markerType;

      // Re-construction.
      this.target.disableEditMode();
      this.target.enableEditMode();
    }

    changeToMarkerType(markerType: MarkerType) {
      this.target.toMarkerType = markerType;

      // Re-construction.
      this.target.disableEditMode();
      this.target.enableEditMode();
    }

    changeColorSet(colorSet: ColorSet) {
      this.target.colorSet = colorSet;

      // Re-construction.
      this.target.disableEditMode();
      this.target.enableEditMode();
    }

    moveToFrontEnd() {
      this.target.moveToFrontEnd();
    }

    moveToBackEnd() {
      this.target.moveToBackEnd();
    }

  }

  private openContextMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "openContextMenu()");

    this.html.css("display", "block");

    ReactDOM.render(
        <ConnectorContextMenu
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={clickX}
            topPix={clickY}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, "closeContextMenu()");

    let container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, `moveToFrontEnd()`);
    this.root.raise();
    if (this.callback != null) this.callback.onRaised(this);
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, `moveToBackEnd()`);
    this.root.lower();
    if (this.callback != null) this.callback.onLowered(this);
  }

  /**
   * Delete this instance.
   */
  public delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(Connector.TAG, `moveToBackEnd()`);
    this.resetState();
    this.root.remove();
  }

}

