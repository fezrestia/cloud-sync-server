import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";
const svgz = require("svg-z-order");

import { ColorResolver } from "./resolver/ColorResolver";
import { Point, Util } from "./Util";
import { TraceLog } from "../util/TraceLog";
import { ArchModContextMenu, ArchModContextMenuCallback } from "../components/ArchModContextMenu";
import { Def, ClipArea, ColorSet, LineStyle } from "../Def";
import { D3Node, D3Event, JQueryNode } from "../TypeDef";
import { Element, ElementItxMode } from "./Element";
import { KeyValuePopupMenu, KeyValuePopupMenuCallback } from "../components/KeyValuePopupMenu";

/**
 * Callback interface for ArchMod.
 */
export interface ArchModCallback {
  onSelected(selected: ArchMod, isMulti: boolean): void;
  onDeselected(deselected: ArchMod): void;

  onEditing(editing: ArchMod, isMulti: boolean): void;
  onEdited(edited: ArchMod): void;

  onDragStart(moved: ArchMod): void;
  onDrag(moved: ArchMod, pulsX: number, plusY: number): void;
  onDragEnd(moved: ArchMod, totalPlusX: number, totalPlusY: number): void;

  onRaised(raised: ArchMod): void;
  onLowered(lowered: ArchMod): void;

  canChangeLabel(archMod: ArchMod, newLabel: string): boolean;
  onLabelChanged(archMod: ArchMod, oldLabel: string, newLabel: string): void;

  getParentLabel(parentUid: number|null): string;

  onHistoricalChanged(archMod: ArchMod): void;

  onSizeChanged(archMod: ArchMod): void;
  onSizeChangeDone(archMod: ArchMod): void;

  onClipAreaChanged(archMod: ArchMod): void;

}

/**
 * ArchMod serialized JSON interface.
 */
export interface ArchModJson {
  [Def.KEY_UID]: number,
  [Def.KEY_PARENT_UID]: number|null,
  [Def.KEY_HIERARCHY_DEPTH]: number,
  [Def.KEY_CLASS]: string,
  [Def.KEY_LABEL]: string,
  [Def.KEY_DIMENS]: {
      [Def.KEY_X]: number,
      [Def.KEY_Y]: number,
      [Def.KEY_WIDTH]: number,
      [Def.KEY_HEIGHT]: number,
      [Def.KEY_PIN_X]: number,
      [Def.KEY_PIN_Y]: number,
      [Def.KEY_LABEL_ROT_DEG]: number,
      [Def.KEY_LABEL_HORIZONTAL_ALIGN]: string,
      [Def.KEY_LABEL_VERTICAL_ALIGN]: string,
      [Def.KEY_Z_ORDER]: number,
  },
  [Def.KEY_EDGE_LINE_STYLE]: string,
  [Def.KEY_CLIP_AREA]: string,
  [Def.KEY_COLOR_SET]: string,
  [Def.KEY_EDGE_COLOR_SET]: string,
  [Def.KEY_LAYER_GROUP]: number,
}

/**
 * Base state class for ArchMod state machine.
 */
class ArchModState {
  protected target: ArchMod;
  constructor(target: ArchMod) {
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
 * Architecture Module class.
 */
export class ArchMod extends Element {
  public static readonly TAG = "ArchMod";
  public readonly TAG = ArchMod.TAG;

  private readonly STROKE_WIDTH = 2;

  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;
  private readonly LABEL_ALIGN_MARGIN = 16;

  private readonly GRIP_ID_LEFT_TOP = "grip_left_top";
  private readonly GRIP_ID_RIGHT_TOP = "grip_right_top";
  private readonly GRIP_ID_LEFT_BOTTOM = "grip_left_bottom";
  private readonly GRIP_ID_RIGHT_BOTTOM = "grip_right_bottom";
  private readonly GRIP_ID_PIN = "grip_pin";

  private static IdleState = class extends ArchModState {
    enter() {
      this.target.setHighlight(false);
    }

    onLeftClicked(clickX: number, clickY: number, withCtrl: boolean) {
      switch (this.target.itxMode) {
        case ElementItxMode.SELECTABLE:
          this.target.currentState = new ArchMod.SelectedState(this.target, withCtrl);
          break;

        case ElementItxMode.EDITABLE:
          this.target.currentState = new ArchMod.EditingState(this.target, withCtrl);
          break;
      }
    }
  }

  private static SelectedState = class extends ArchModState {
    private isMulti: boolean;
    constructor(target: ArchMod, isMulti: boolean) {
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
      this.target.currentState = new ArchMod.IdleState(this.target);
    }

    reset() {
      this.onCanceled();
    }
  }

  private static EditingState = class extends ArchModState {
    private isMulti: boolean;
    constructor(target: ArchMod, isMulti: boolean) {
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
      this.target.currentState = new ArchMod.IdleState(this.target);
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
    this.edgeColorSet = this.edgeColorSet; // Load default

    this._currentState = new ArchMod.IdleState(this);
  }

  private _currentState: ArchModState;
      private get currentState(): ArchModState {
        return this._currentState;
      }
      private set currentState(newState: ArchModState) {
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
        this.relayout();
      }

  private _parentUid: number|null = null;
      public get parentUid(): number|null {
        return this._parentUid;
      }
      public set parentUid(parentUid: number|null) {
        this._parentUid = parentUid;
      }

  private _hierarchyDepth: number = Def.TOP_LAYER_DEPTH;
      public get hierarchyDepth(): number {
        return this._hierarchyDepth;
      }
      public set hierarchyDepth(hierarchyDepth: number) {
        this._hierarchyDepth = hierarchyDepth;
      }

  /**
   * Serialize ArchMod object to ArchModJson Object.
   *
   * @return string ArchModJson Object.
   */
  public serialize(): ArchModJson {
    const jsonObj = {
        [Def.KEY_UID]: this.uid,
        [Def.KEY_PARENT_UID]: this.parentUid,
        [Def.KEY_HIERARCHY_DEPTH]: this.hierarchyDepth,
        [Def.KEY_CLASS]: ArchMod.TAG,
        [Def.KEY_LABEL]: this.label,
        [Def.KEY_DIMENS]: {
            [Def.KEY_X]: this.x,
            [Def.KEY_Y]: this.y,
            [Def.KEY_WIDTH]: this.width,
            [Def.KEY_HEIGHT]: this.height,
            [Def.KEY_PIN_X]: this.pinX,
            [Def.KEY_PIN_Y]: this.pinY,
            [Def.KEY_LABEL_ROT_DEG]: this.labelRotDeg,
            [Def.KEY_LABEL_HORIZONTAL_ALIGN]: this.labelHorizontalAlign,
            [Def.KEY_LABEL_VERTICAL_ALIGN]: this.labelVerticalAlign,
            [Def.KEY_Z_ORDER]: this.zOrder,
        },
        [Def.KEY_EDGE_LINE_STYLE]: this.edgeLineStyle,
        [Def.KEY_CLIP_AREA]: this.clipArea,
        [Def.KEY_COLOR_SET]: this.colorSet,
        [Def.KEY_EDGE_COLOR_SET]: this.edgeColorSet,
        [Def.KEY_LAYER_GROUP]: this.layerGroup,
    };
    return jsonObj;
  }

  /**
   * Deserlialize ArchMod object from JSON object.
   *
   * @param uid Element unique ID.
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return ArchMod.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: ArchModJson): ArchMod {
    const archMod = new ArchMod(
        json[Def.KEY_UID],
        html,
        svg,
        json[Def.KEY_LABEL]);
    archMod.parentUid = json[Def.KEY_PARENT_UID];
    archMod.hierarchyDepth = json[Def.KEY_HIERARCHY_DEPTH];

    archMod.setDimens(
        json[Def.KEY_DIMENS][Def.KEY_X],
        json[Def.KEY_DIMENS][Def.KEY_Y],
        json[Def.KEY_DIMENS][Def.KEY_WIDTH],
        json[Def.KEY_DIMENS][Def.KEY_HEIGHT],
        json[Def.KEY_DIMENS][Def.KEY_PIN_X],
        json[Def.KEY_DIMENS][Def.KEY_PIN_Y],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_ROT_DEG],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_HORIZONTAL_ALIGN],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_VERTICAL_ALIGN],
        json[Def.KEY_DIMENS][Def.KEY_Z_ORDER]);

    archMod.colorSet = ColorSet.valueOf(json[Def.KEY_COLOR_SET]);
    archMod.edgeColorSet = ColorSet.valueOf(json[Def.KEY_EDGE_COLOR_SET]);

    archMod.edgeLineStyle = LineStyle.valueOf(json[Def.KEY_EDGE_LINE_STYLE]);

    archMod.clipArea = ClipArea.valueOf(json[Def.KEY_CLIP_AREA]);

    archMod.layerGroup = json[Def.KEY_LAYER_GROUP];

    return archMod;
  }

  // @Override
  public deserialize(json: ArchModJson) {
    this.parentUid = json[Def.KEY_PARENT_UID];

    this._label = json[Def.KEY_LABEL];

    this.hierarchyDepth = json[Def.KEY_HIERARCHY_DEPTH];

    this.setDimens(
        json[Def.KEY_DIMENS][Def.KEY_X],
        json[Def.KEY_DIMENS][Def.KEY_Y],
        json[Def.KEY_DIMENS][Def.KEY_WIDTH],
        json[Def.KEY_DIMENS][Def.KEY_HEIGHT],
        json[Def.KEY_DIMENS][Def.KEY_PIN_X],
        json[Def.KEY_DIMENS][Def.KEY_PIN_Y],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_ROT_DEG],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_HORIZONTAL_ALIGN],
        json[Def.KEY_DIMENS][Def.KEY_LABEL_VERTICAL_ALIGN],
        json[Def.KEY_DIMENS][Def.KEY_Z_ORDER]);

    this.colorSet = ColorSet.valueOf(json[Def.KEY_COLOR_SET]);
    this.edgeColorSet = ColorSet.valueOf(json[Def.KEY_EDGE_COLOR_SET]);

    this.edgeLineStyle = LineStyle.valueOf(json[Def.KEY_EDGE_LINE_STYLE]);

    this.clipArea = ClipArea.valueOf(json[Def.KEY_CLIP_AREA]);

    this.layerGroup = json[Def.KEY_LAYER_GROUP];

    this.relabel();
    this.relayout();
    this.recolor();
  }

  // Elements.
  private polygon!: D3Node.Polygon;
  private text!: D3Node.Text;
  private editor: D3Node.G|null = null;
  private layerIndicator!: D3Node.Text;

  // Position/Size.
  private x: number = 0;
  private y: number = 0;
  private width: number = 0;
  private height: number = 0;
  private labelRotDeg: number = 0;
  private labelHorizontalAlign: string = "center";
  private labelVerticalAlign: string = "middle";
  private pinX: number = 0;
  private pinY: number = 0;

  private _edgeLineStyle = LineStyle.NORMAL;
      public get edgeLineStyle(): LineStyle {
        return this._edgeLineStyle;
      }
      public set edgeLineStyle(edgeLineStyle: LineStyle) {
        this._edgeLineStyle = edgeLineStyle;
      }

  private _clipArea = ClipArea.NONE;
      public get clipArea(): ClipArea {
        return this._clipArea;
      }
      public set clipArea(clipArea: ClipArea) {
        this._clipArea = clipArea;
      }

  // Font.
  private fontSize: number = 12;

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

  // Edge color resolver functions.
  private _edgeColorSet: ColorSet = ColorSet.GRAY;
      public get edgeColorSet(): ColorSet {
        return this._edgeColorSet;
      }
      public set edgeColorSet(edgeColorSet: ColorSet) {
        this._edgeColorSet = edgeColorSet;
        this.edgeColorResolver = ColorSet.resolve(edgeColorSet);
      }

  private edgeColorResolver!: ColorResolver;

  // Callback.
  private callback: ArchModCallback|null = null;

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
    let pinX: number|null = null;
    let pinY: number|null = null;

    if (this.pinX === 0) pinX = x + width / 2;
    if (this.pinY === 0) pinY = y + height / 2;

    this.setDimens(x, y, width, height, pinX, pinY, null, null, null, null);
  }

  /**
   * Get module position and size.
   * @return {x, y, width, height}
   */
  public getXYWH(): {x: number, y: number, width: number, height:number} {
    return {x: this.x, y: this.y, width: this.width, height: this.height};
  }

  /**
   * Get out line points X-Y array.
   * @return {x, y}[]
   */
  public getOutLinePoints(): {x: number, y: number}[] {
    switch (this.clipArea) {
      case ClipArea.NONE:
        return [
            {x: this.x,               y: this.y},
            {x: this.x + this.width,  y: this.y},
            {x: this.x + this.width,  y: this.y + this.height},
            {x: this.x,               y: this.y + this.height},
        ];

      case ClipArea.LEFT_TOP:
        return [
            {x: this.pinX,            y: this.y},
            {x: this.x + this.width,  y: this.y},
            {x: this.x + this.width,  y: this.y + this.height},
            {x: this.x,               y: this.y + this.height},
            {x: this.x,               y: this.pinY},
            {x: this.pinX,            y: this.pinY},
        ];

      case ClipArea.RIGHT_TOP:
        return [
            {x: this.x,               y: this.y},
            {x: this.pinX,            y: this.y},
            {x: this.pinX,            y: this.pinY},
            {x: this.x + this.width,  y: this.pinY},
            {x: this.x + this.width,  y: this.y + this.height},
            {x: this.x,               y: this.y + this.height},
        ];

      case ClipArea.LEFT_BOTTOM:
        return [
            {x: this.x,               y: this.y},
            {x: this.x + this.width,  y: this.y},
            {x: this.x + this.width,  y: this.y + this.height},
            {x: this.pinX,            y: this.y + this.height},
            {x: this.pinX,            y: this.pinY},
            {x: this.x,               y: this.pinY},
        ];

      case ClipArea.RIGHT_BOTTOM:
        return [
            {x: this.x,               y: this.y},
            {x: this.x + this.width,  y: this.y},
            {x: this.x + this.width,  y: this.pinY},
            {x: this.pinX,            y: this.pinY},
            {x: this.pinX,            y: this.y + this.height},
            {x: this.x,               y: this.y + this.height},
        ];
    }
  }

  public isPointIncluded(point: {x: number, y: number}): boolean {
    const isInOutHorizontal = (this.x <= point.x) && (point.x <= this.x + this.width);
    const isInOutVertical = (this.y <= point.y) && (point.y <= this.y + this.height);
    const isInOutArea = isInOutHorizontal && isInOutVertical;

    if (this.clipArea === ClipArea.NONE) {
      return isInOutArea;
    } else {
      let clipL = 0;
      let clipT = 0;
      let clipR = 0;
      let clipB = 0;
      let isInClipHorizontal = true;
      let isInClipVertical = true;
      switch (this.clipArea) {
        case ClipArea.LEFT_TOP:
          clipL = this.x;
          clipT = this.y;
          clipR = this.pinX;
          clipB = this.pinY;
          isInClipHorizontal = (clipL <= point.x) && (point.x < clipR);
          isInClipVertical = (clipT <= point.y) && (point.y < clipB);
          break;

        case ClipArea.RIGHT_TOP:
          clipL = this.pinX;
          clipT = this.y;
          clipR = this.x + this.width;
          clipB = this.pinY;
          isInClipHorizontal = (clipL < point.x) && (point.x <= clipR);
          isInClipVertical = (clipT <= point.y) && (point.y < clipB);
          break;

        case ClipArea.LEFT_BOTTOM:
          clipL = this.x;
          clipT = this.pinY;
          clipR = this.pinX;
          clipB = this.y + this.height;
          isInClipHorizontal = (clipL <= point.x) && (point.x < clipR);
          isInClipVertical = (clipT < point.y) && (point.y <= clipB);
          break;

        case ClipArea.RIGHT_BOTTOM:
          clipL = this.pinX;
          clipT = this.pinY;
          clipR = this.x + this.width;
          clipB = this.y + this.height;
          isInClipHorizontal = (clipL < point.x) && (point.x <= clipR);
          isInClipVertical = (clipT < point.y) && (point.y <= clipB);
          break;

        default:
          alert("ERROR: isPointIncluded(): Unexpected Clip Area");
          break;
      }
      const isInClipArea = isInClipHorizontal && isInClipVertical;

      return isInOutArea && !isInClipArea;
    }
  }

  /**
   * Check @child is included in this ArchMod or not.
   *
   * @param Check child or not target.
   * @return Is child or not.
   */
  public isChild(child: ArchMod): boolean {
    const childPoints: {x: number, y: number}[] = child.getOutLinePoints();

    const isNotIncluded = childPoints.some( (point: {x: number, y: number}) => {
      return !this.isPointIncluded(point);
    } );

    return !isNotIncluded;
  }

  /**
   * Update total dimension values.
   *
   * @param x
   * @param y
   * @param width
   * @param height
   * @param pinX
   * @param pinY
   * @param labelRotDeg
   * @param labelHorizontalAlign
   * @param labelVerticalAlign
   * @param zOrder
   */
  public setDimens(
      x: number|null,
      y: number|null,
      width: number|null,
      height: number|null,
      pinX: number|null,
      pinY: number|null,
      labelRotDeg: number|null,
      labelHorizontalAlign: string|null,
      labelVerticalAlign: string|null,
      zOrder: number|null) {
    if (x != null) this.x = x;
    if (y != null) this.y = y;
    if (width != null) this.width = width;
    if (height != null) this.height = height;
    if (pinX != null) this.pinX = pinX;
    if (pinY != null) this.pinY = pinY;
    if (labelRotDeg != null) this.labelRotDeg = labelRotDeg;
    if (labelHorizontalAlign != null) this.labelHorizontalAlign = labelHorizontalAlign;
    if (labelVerticalAlign != null) this.labelVerticalAlign = labelVerticalAlign;
    if (zOrder != null) this.zOrder = zOrder;
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
  public setCallback(callback: ArchModCallback) {
    this.callback = callback;
  }

  /**
   * Render.
   */
  public render() {
    this._root = this.svg.append("g")
        .datum(this);

    // Polygon, normally Rect.
    this.polygon = this.root.append("polygon")
        .attr("stroke-width", this.STROKE_WIDTH);

    // Text.
    this.text = this.root.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", this.fontSize)
        .attr("pointer-events", "none");

    // Layer indicator.
    this.layerIndicator = this.root.append("text")
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "hanging")
        .attr("font-size", Def.INDICATOR_FONT_SIZE)
        .attr("pointer-events", "none");

    this.relabel();
    this.relayout();
    this.recolor();

    // Callbacks.
    this.registerCallbacks();
  }

  /**
   * Get FROM connector points to CALLEE Archmod.
   *
   * @return
   */
  public getFromConnectorPoints(): Point[] {
    const result = this.calcConnPoints();
    return result.bottomPoints;
  }

  /**
   * Get TO connector points to CALLER Archmod.
   *
   * @return
   */
  public getToConnectorPoints(): Point[] {
    const result = this.calcConnPoints();
    return result.topPoints;
  }

  /**
   * Get default connection point list.
   *
   * @return
   */
  public getConnectionPoints(): Point[] {
    const result = this.calcConnPoints();
    return result.topPoints.concat(result.bottomPoints);
  }

  private calcConnPoints(): { topPoints: Point[], bottomPoints: Point[] } {
    const topPoints: Point[] = [];
    const bottomPoints: Point[] = [];

    const left = this.x;
    const top = this.y;
    const right = this.x + this.width;
    const bottom = this.y + this.height;
    const pinX = this.pinX;
    const pinY = this.pinY;
    const centerX = left + this.width / 2;
    const centerY = top + this.height / 2;

    switch (this.clipArea) {
      case ClipArea.NONE:
        // Top.
        topPoints.push(new Point(centerX, top));
        // Bottom.
        bottomPoints.push(new Point(centerX, bottom));
        break;

      case ClipArea.LEFT_TOP:
        // Top.
        topPoints.push(new Point(pinX + (right - pinX) / 2, top));
        topPoints.push(new Point(left + (pinX - left) / 2, pinY));
        // Bottom.
        bottomPoints.push(new Point(centerX, bottom));
        break;

      case ClipArea.RIGHT_TOP:
        // Top.
        topPoints.push(new Point(left + (pinX - left) / 2, top));
        topPoints.push(new Point(pinX + (right - pinX) / 2, pinY));
        // Bottom.
        bottomPoints.push(new Point(centerX, bottom));
        break;

      case ClipArea.LEFT_BOTTOM:
        // Top.
        topPoints.push(new Point(centerX, top));
        // Bottom.
        bottomPoints.push(new Point(left + (pinX - left) / 2, pinY));
        bottomPoints.push(new Point(pinX + (right - pinX) / 2, bottom));
        break;

      case ClipArea.RIGHT_BOTTOM:
        // Top.
        topPoints.push(new Point(centerX, top));
        // Bottom.
        bottomPoints.push(new Point(pinX + (right - pinX) / 2, pinY));
        bottomPoints.push(new Point(left + (pinX - left) / 2, bottom));
        break;
    }

    return {
      topPoints,
      bottomPoints,
    };
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
   * Move this ArchMod with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  public move(plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `move() : ID=${this.label}, plusX=${plusX}, plusY=${plusY}`);
    this.x += plusX;
    this.y += plusY;
    this.pinX += plusX;
    this.pinY += plusY;

    this.checkLayoutLimit();
    this.relayout();
  }

  private checkLayoutLimit() {
    // Top-Left edge limit check. Bottom-Right edge is movable, so skip check.
    if (this.x < 0) {
      this.pinX -= this.x;
      this.x = 0;
    }
    if (this.y < 0) {
      this.pinY -= this.y;
      this.y = 0;
    }
  }

  private registerCallbacks() {
    this.polygon.on("click", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "on:click");

        if (event.ctrlKey) {
          this.currentState.onLeftClicked(event.x, event.y, true);
        } else {
          this.currentState.onLeftClicked(event.x, event.y, false);
        }

        event.stopPropagation();
        event.preventDefault();
    });

    this.polygon.on("contextmenu", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "on:contextmenu");

        // NOTICE: Click offset X-Y is based on viewport of polygon. (same as svg)
        this.currentState.onRightClicked(event.offsetX, event.offsetY);

        event.stopPropagation();
        event.preventDefault();
    });

    this.root.call(
      d3.drag<SVGGElement, any, any>()
          .on("start", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "on:drag:start");
              if (this.currentState.isMovable()) {
                const target = event.target as any;

                target.origX = this.x;
                target.origY = this.y;
                target.origPinX = this.pinX;
                target.origPinY = this.pinY;
                target.startX = event.x;
                target.startY = event.y;

                if (this.callback != null) this.callback.onDragStart(this);
              }
          } )
          .on("drag", (event: D3Event.Drag) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "on:drag:drag");
              if (this.currentState.isMovable()) {
                const isSnapDragEnabled = event.sourceEvent.altKey;
                const target = event.target as any;

                const dx = event.x - target.startX;
                const dy = event.y - target.startY;

                const oldX = this.x;
                const oldY = this.y;

                this.x = target.origX + dx;
                this.y = target.origY + dy;
                this.pinX = target.origPinX + dx;
                this.pinY = target.origPinY + dy;

                // Position snapping.
                if (isSnapDragEnabled) {
                  const snapX = this.x % Def.SNAP_STEP_PIX;
                  this.x -= snapX;
                  this.pinX -= snapX;
                  const snapY = this.y % Def.SNAP_STEP_PIX;
                  this.y -= snapY;
                  this.pinY -= snapY;
                }

                this.checkLayoutLimit();
                this.relayout();

                const plusX = this.x - oldX;
                const plusY = this.y - oldY;
                if (this.callback != null) this.callback.onDrag(this, plusX, plusY);
              }
          } )
          .on("end", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "on:drag:end");
              if (this.currentState.isMovable()) {
                const target = event.target as any;

                const totalDX = event.x - target.startX;
                const totalDY = event.y - target.startY;

                target.origX = 0;
                target.origY = 0;
                target.origPinX = 0;
                target.origPinY = 0;
                target.startX = 0;
                target.startY = 0;

                if (this.callback != null) this.callback.onDragEnd(this, totalDX, totalDY);
              }
          } )
      );
  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "enableEditMode()");
    if (this.editor != null) return;

    this.editor = this.root.append("g")
        .attr("id", "editor_plane");

    this.addEditGrip(this.GRIP_ID_LEFT_TOP,       this.x,                 this.y);
    this.addEditGrip(this.GRIP_ID_RIGHT_TOP,      this.x + this.width,    this.y);
    this.addEditGrip(this.GRIP_ID_LEFT_BOTTOM,    this.x,                 this.y + this.height);
    this.addEditGrip(this.GRIP_ID_RIGHT_BOTTOM,   this.x + this.width,    this.y + this.height);

    if (this.clipArea !== ClipArea.NONE) {
      this.addEditGrip(this.GRIP_ID_PIN, this.pinX, this.pinY);
    }

  }

  private addEditGrip(id: string, cx: number, cy: number): any {
    if (this.editor == null) return;

    const TAG = "EditGrip";

    const circle = this.editor.append("circle")
        .attr("id", id)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("fill", this.edgeColorResolver.stroke)
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
              target.origPinX = this.pinX;
              target.origPinY = this.pinY;

              target.startX = event.x;
              target.startY = event.y;

          } )
          .on("drag", (event: D3Event.Drag) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              const isSnapDragEnabled = event.sourceEvent.altKey;
              const target = event.target as any;

              const origX = target.origX;
              const origY = target.origY;
              const origWidth = target.origWidth;
              const origHeight = target.origHeight;
              const origPinX = target.origPinX;
              const origPinY = target.origPinY;

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

                  // Pin position.
                  const minPinX = this.x + this.MIN_SIZE_PIX / 2;
                  const minPinY = this.y + this.MIN_SIZE_PIX / 2;
                  if (this.pinX < minPinX) this.pinX = minPinX;
                  if (this.pinY < minPinY) this.pinY = minPinY;

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

                  // Pin position.
                  const maxPinX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                  const minPinY = this.y + this.MIN_SIZE_PIX / 2;
                  if (this.pinX > maxPinX) this.pinX = maxPinX;
                  if (this.pinY < minPinY) this.pinY = minPinY;

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

                  // Pin position.
                  const minPinX = this.x + this.MIN_SIZE_PIX / 2;
                  const maxPinY = this.y + this.height - this.MIN_SIZE_PIX / 2;
                  if (this.pinX < minPinX) this.pinX = minPinX;
                  if (this.pinY > maxPinY) this.pinY = maxPinY;

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

                  // Pin position.
                  const maxPinX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                  const maxPinY = this.y + this.height - this.MIN_SIZE_PIX / 2;
                  if (this.pinX > maxPinX) this.pinX = maxPinX;
                  if (this.pinY > maxPinY) this.pinY = maxPinY;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    const snapX = (this.x + this.width) % Def.SNAP_STEP_PIX;
                    this.width -= snapX;
                    const snapY = (this.y + this.height) % Def.SNAP_STEP_PIX;
                    this.height -= snapY;
                  }
                }
                break;

                case this.GRIP_ID_PIN: {
                   let newPinX = origPinX + dx;
                   let newPinY = origPinY + dy;

                   // Snapping.
                   if (isSnapDragEnabled) {
                     newPinX = Math.floor(newPinX / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                     newPinY = Math.floor(newPinY / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                   }

                   const minX = this.x + this.MIN_SIZE_PIX / 2;
                   const maxX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                   const minY = this.y + this.MIN_SIZE_PIX / 2;
                   const maxY = this.y + this.height - this.MIN_SIZE_PIX / 2;

                   if (newPinX < minX) newPinX = minX;
                   if (newPinX > maxX) newPinX = maxX;
                   if (newPinY < minY) newPinY = minY;
                   if (newPinY > maxY) newPinY = maxY;

                   this.pinX = newPinX;
                   this.pinY = newPinY;
                }
                break;
              }

              this.relayout();

              if (this.callback != null) this.callback.onSizeChanged(this);

          } )
          .on("end", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              const target = event.target as any;

              target.origX = 0;
              target.origY = 0;
              target.origWidth = 0;
              target.origHeight = 0;
              target.origPinX = 0;
              target.origPinY = 0;

              target.startX = 0;
              target.startY = 0;

              if (this.callback != null) this.callback.onSizeChangeDone(this);
              if (this.callback != null) this.callback.onHistoricalChanged(this);
          } )
    );
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "disableEditMode()");
    if (this.editor == null) return;

    this.editor.remove();
    this.editor = null;
  }

  private relayout() {
    if (this.root === undefined) {
      // Not rendered yet.
      return;
    }

    // Common dimens.
    const left = this.x;
    const top = this.y;
    const right = this.x + this.width;
    const bottom = this.y + this.height;
    const pinX = this.pinX;
    const pinY = this.pinY;
    const centerX = left + this.width / 2;
    const centerY = top + this.height / 2;

    // Rect or polygon shape.
    let points: number[][] = [];
    switch (this.clipArea) {
      case ClipArea.NONE:
        points = [
            [left,  top   ],
            [right, top   ],
            [right, bottom],
            [left,  bottom],
            [left,  top   ],
        ];
        break;

      case ClipArea.LEFT_TOP:
        points = [
            [pinX,  pinY  ],
            [pinX,  top   ],
            [right, top   ],
            [right, bottom],
            [left,  bottom],
            [left,  pinY  ],
            [pinX,  pinY  ],
        ];
        break;

      case ClipArea.RIGHT_TOP:
        points = [
            [pinX,  pinY  ],
            [right, pinY  ],
            [right, bottom],
            [left,  bottom],
            [left,  top   ],
            [pinX,  top   ],
            [pinX,  pinY  ],
        ];
        break;

      case ClipArea.LEFT_BOTTOM:
        points = [
            [pinX,  pinY  ],
            [left,  pinY  ],
            [left,  top   ],
            [right, top   ],
            [right, bottom],
            [pinX,  bottom],
            [pinX,  pinY  ],
        ];
        break;

      case ClipArea.RIGHT_BOTTOM:
        points = [
            [pinX,  pinY  ],
            [pinX,  bottom],
            [left,  bottom],
            [left,  top   ],
            [right, top   ],
            [right, pinY  ],
            [pinX,  pinY  ],
        ];
        break;
    }
    const polygonPoints: string = points
        .map( (point: number[]): string => { return point.join(",") } )
        .join(" ");
    this.polygon.attr("points", polygonPoints);
    this.polygon.attr(
        "stroke-dasharray",
        LineStyle.getStrokeDashArray(this.edgeLineStyle, this.STROKE_WIDTH));

    // Text label.
    let labelX: number = 0;
    let labelY: number = 0;
    switch (this.clipArea) {
      case ClipArea.NONE:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelX = left;
                break;
              case "center":
                // Fall-through.
              default:
                labelX = centerX;
                break;
              case "right":
                labelX = right;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelY = top + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelY = bottom - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelY = centerY;
                break;
            }
            break;

          case Def.DEG_VERTICAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelY = bottom;
                break;
              case "center":
                // Fall-through.
              default:
                labelY = centerY;
                break;
              case "right":
                labelY = top;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelX = left + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelX = right - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelX = centerX;
                break;
            }
            break;
        }
        break;

      case ClipArea.LEFT_TOP:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelX = left;
                break;
              case "center":
                // Fall-through.
              default:
                labelX = centerX;
                break;
              case "right":
                labelX = right;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelY = pinY + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelY = bottom - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelY = pinY + (bottom - pinY) / 2;
                break;
            }
            break;

          case Def.DEG_VERTICAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelY = bottom;
                break;
              case "center":
                // Fall-through.
              default:
                labelY = centerY;
                break;
              case "right":
                labelY = top;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelX = pinX + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelX = right - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelX = pinX + (right - pinX) / 2;
                break;
            }
            break;
        }
        break;

      case ClipArea.RIGHT_TOP:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelX = left;
                break;
              case "center":
                // Fall-through.
              default:
                labelX = centerX;
                break;
              case "right":
                labelX = right;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelY = pinY + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelY = bottom - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelY = pinY + (bottom - pinY) / 2;
                break;
            }
            break;

          case Def.DEG_VERTICAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelY = bottom;
                break;
              case "center":
                // Fall-through.
              default:
                labelY = centerY;
                break;
              case "right":
                labelY = top;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelX = left + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelX = pinX - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelX = left + (pinX - left) / 2;
                break;
            }
            break;
        }
        break;

      case ClipArea.LEFT_BOTTOM:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelX = left;
                break;
              case "center":
                // Fall-through.
              default:
                labelX = centerX;
                break;
              case "right":
                labelX = right;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelY = top + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelY = pinY - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelY = top + (pinY - top) / 2;
                break;
            }
            break;

          case Def.DEG_VERTICAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelY = bottom;
                break;
              case "center":
                // Fall-through.
              default:
                labelY = centerY;
                break;
              case "right":
                labelY = top;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelX = pinX + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelX = right - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelX = pinX + (right - pinX) / 2;
                break;
            }
            break;
        }
        break;

      case ClipArea.RIGHT_BOTTOM:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelX = left;
                break;
              case "center":
                // Fall-through.
              default:
                labelX = centerX;
                break;
              case "right":
                labelX = right;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelY = top + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelY = pinY - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelY = top + (pinY - top) / 2;
                break;
            }
            break;

          case Def.DEG_VERTICAL:
            switch (this.labelHorizontalAlign) {
              case "left":
                labelY = bottom;
                break;
              case "center":
                // Fall-through.
              default:
                labelY = centerY;
                break;
              case "right":
                labelY = top;
                break
            }
            switch (this.labelVerticalAlign) {
              case "top":
                labelX = left + this.LABEL_ALIGN_MARGIN;
                break;
              case "bottom":
                labelX = pinX - this.LABEL_ALIGN_MARGIN;
                break;
              case "middle":
                // Fall-through.
              default:
                labelX = left + (pinX - left) / 2;
                break;
            }
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

      if (this.clipArea !== ClipArea.NONE) {
        const pinGrip = this.editor.select(`#${this.GRIP_ID_PIN}`);
        pinGrip.attr("cx", this.pinX);
        pinGrip.attr("cy", this.pinY);
      }

    }

  }

  private recolor() {
    this.polygon.attr("stroke", this.edgeColorResolver.stroke);
    this.polygon.attr("fill", this.colorResolver.bg)

    this.text.attr("fill", this.colorResolver.text);

    this.layerIndicator.attr("fill", this.colorResolver.text);

  }

  private relabel() {
    this.root
        .attr("id", Util.getElementId("archmod", this.label));
    this.polygon
        .attr("id", Util.getElementId("polygon", this.label));
    this.text
        .attr("id", Util.getElementId("text", this.label));

    this.updateLabelLayout();

    this.layerIndicator.text(this.layerGroup);

  }

  private updateLabelLayout() {
    this.text.text(null);

    const labelX = this.text.attr("x");
    const labelY = this.text.attr("y");

    const lines: string[] = this.label.split("\n");

    let textAnchor: string;
    let dx: string;
    switch (this.labelHorizontalAlign) {
      case "left":
        textAnchor = "start";
        dx = "0.8em";
        break;
      case "center":
        // Fall-through.
      default:
        textAnchor = "middle";
        dx = "0";
        break;
      case "right":
        textAnchor = "end";
        dx = "-0.8em";
        break;
    }

    let startDY: number;
    switch (this.labelVerticalAlign) {
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
          .attr("text-anchor", textAnchor)
          .attr("dx", dx)
          .attr("dy", `${dy}em`)
          .text(line);
    } );

    this.layerIndicator.attr("x", this.x + Def.SNAP_STEP_PIX / 2);
    this.layerIndicator.attr("y", this.y + Def.SNAP_STEP_PIX / 2);
    switch (this.itxMode) {
      case ElementItxMode.EDITABLE:
        this.layerIndicator.attr("display", "block");
        break;

      default:
        this.layerIndicator.attr("display", "none");
        break;
    }
  }

  private ContextMenuCallbackImpl = class implements ArchModContextMenuCallback {
    private target: ArchMod;

    constructor(target: ArchMod) {
      this.target = target;
    }

    close() {
      this.target.closeContextMenu();

      if (this.target.callback != null) this.target.callback.onHistoricalChanged(this.target);
    }

    changeLabelRotDeg(rotDeg: number) {
      this.target.rotateLabel(rotDeg);
    }

    changeLabelHorizontalAlign(align: string) {
      this.target.alignLabel(align, null);
    }

    changeLabelVerticalAlign(align: string) {
      this.target.alignLabel(null, align);
    }

    changeEdgeLineStyle(edgeLineStyle: LineStyle) {
      this.target.edgeLineStyle = edgeLineStyle;
      this.target.relayout();
    }

    changeClipArea(clipArea: ClipArea) {
      this.target.changeClipArea(clipArea);
    }

    changeColorSet(colorSet: ColorSet) {
      this.target.colorSet = colorSet;

      // Re-construction and re-color.
      this.target.disableEditMode();
      this.target.enableEditMode();
      this.target.recolor();
    }

    changeEdgeColorSet(edgeColorSet: ColorSet) {
      this.target.edgeColorSet = edgeColorSet;

      // Re-construction and re-color.
      this.target.disableEditMode();
      this.target.enableEditMode();
      this.target.recolor();
    }

    changeLayerGroup(layerGroup: number) {
      this.target.layerGroup = layerGroup;
      this.target.relabel();
    }

    moveToFrontEnd() {
      this.target.moveToFrontEnd();
    }

    moveToBackEnd() {
      this.target.moveToBackEnd();
    }

    canChangeLabel(newLabel: string): boolean {
      return this.target.canChangeLabel(newLabel);
    }

    onLabelChanged(oldLabel: string, newLabel: string) {
      this.target.onLabelChanged(oldLabel, newLabel);
    }

  }

  public openContextMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "openContextMenu()");

    this.html.css("display", "block");

    const parentLabel = this.callback == null ? "" : this.callback.getParentLabel(this.parentUid);

    ReactDOM.render(
        <ArchModContextMenu
            parentLabel={parentLabel}
            label={this.label}
            layerGroup={this.layerGroup}
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={clickX}
            topPix={clickY}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "closeContextMenu()");

    const container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private rotateLabel(rotDeg: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `rotateLabel() : rotDeg=${rotDeg}`);
    this.labelRotDeg = rotDeg;
    this.relayout();
  }

  private alignLabel(horizontalAlign: string|null, verticalAlign: string|null) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `alignLabel() : horizontalAlign=${horizontalAlign}, verticalAlign=${verticalAlign}`);
    if (horizontalAlign != null) {
      this.labelHorizontalAlign = horizontalAlign;
    }
    if (verticalAlign != null) {
      this.labelVerticalAlign = verticalAlign;
    }
    this.relayout();
  }

  private changeClipArea(clipArea: ClipArea) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `changeClipArea() : ${clipArea}`);

    if (this.clipArea !== clipArea) {
      this.clipArea = clipArea;

      // Re-construction and re-layout.
      this.disableEditMode();
      this.enableEditMode();
      this.relayout();

      if (this.callback != null) this.callback.onClipAreaChanged(this);
    }
  }

  public moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `moveToFrontEnd()`);
    this.root.raise();
    if (this.callback != null) this.callback.onRaised(this);
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `moveToBackEnd()`);
    this.root.lower();
    if (this.callback != null) this.callback.onLowered(this);
  }

  // @Override
  public moveToTopOf(element: Element) {
    const elm = svgz.element(this.root.node());
    elm.moveUp(element.root.node());
  }

  // @Override
  public moveToBottomOf(element: Element) {
    const elm = svgz.element(this.root.node());
    elm.moveDown(element.root.node());
  }

  /**
   * Delete this instance.
   */
  public delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, `delete()`);
    this.resetState();
    this.root.remove();
  }

  private canChangeLabel(newLabel: string): boolean {
    let isOk = false;
    if (this.callback != null) {
      isOk = this.callback.canChangeLabel(this, newLabel);
    }
    return isOk;
  }

  private onLabelChanged(oldLabel: string, newLabel: string) {
    this._label = newLabel;
    this.relabel();

    if (this.callback != null) this.callback.onLabelChanged(this, oldLabel, newLabel);
  }

  private KeyValuePopupMenuCallbackImpl = class implements KeyValuePopupMenuCallback {
    private target: ArchMod;

    constructor(target: ArchMod) {
      this.target = target;
    }

    close() {
      this.target.closeDetailMenu();
    }
  }

  private _details: { key: string, value: any }[] = [];
      set details(details: { key: string, value: any }[]) {
        this._details = details;
      }
      get details(): { key: string, value: any }[] {
        return this._details;
      }

  private openDetailMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "openDetailMenu()");

    this.html.css("display", "block");

    const parentLabel = this.callback == null ? "" : this.callback.getParentLabel(this.parentUid);

    ReactDOM.render(
        <KeyValuePopupMenu
            parentLabel={parentLabel}
            label={this.label}
            callback={new this.KeyValuePopupMenuCallbackImpl(this)}
            leftPix={clickX}
            topPix={clickY}
            keyValueList={this.details}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeDetailMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(ArchMod.TAG, "closeDetailMenu()");

    const container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }



}

