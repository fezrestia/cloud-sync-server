import * as d3 from "d3";
import * as $ from "jquery";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver";
import { TraceLog } from "../util/TraceLog";
import { Def, ColorSet } from "../Def";
import { D3Node, D3Event, JQueryNode, StringKeyObject } from "../TypeDef";
import { Element, ElementItxMode, ElementJson } from "./Element";

/**
 * Callback interface for OutFrame.
 */
export interface OutFrameCallback {
  onSizeChangeStart(): void;
  onSizeChange(width: number, height: number): void;
  onSizeChangeEnd(startWidth: number, startHeight: number, endWidth: number, endHeight: number): void;
}

export interface OutFrameJson extends StringKeyObject {
  [Def.KEY_UID]: number,
  [Def.KEY_CLASS]: string,
  [Def.KEY_DIMENS]: {
    [Def.KEY_X]: number,
    [Def.KEY_Y]: number,
    [Def.KEY_WIDTH]: number,
    [Def.KEY_HEIGHT]: number,
    [Def.KEY_Z_ORDER]: number,
  },
  [Def.KEY_LAYER_GROUP]: number,
}

/**
 * Background out side frame class.
 */
export class OutFrame extends Element {
  public static readonly TAG = "OutFrame";
  public readonly TAG = OutFrame.TAG;

  private readonly STROKE_WIDTH = 4;
  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;

  private readonly ROOT_ID = "out_frame";
  private readonly GRIP_ID_RIGHT_BOTTOM = "grip_right_bottom";

  public get label(): string {
    return this.ROOT_ID;
  }

  /**
   * CONSTRUCTOR.
   *
   * @param uid
   * @param html HTML root object.
   * @param svg SVG root object.
   */
  constructor(uid: number, html: JQueryNode, svg: D3Node.SVG) {
    super(uid, html, svg);
    this.colorResolver = ColorSet.resolve(this.colorSet);
    this.zOrder = Def.Z_ORDER_OUT_FRAME;
    this.layerGroup = Def.LAYER_GROUP_OUT_FRAME;
  }

  /**
   * Serialize OutFrame object to OutFrameJson Object.
   *
   * @return string OutFrameJson Object.
   */
  public serialize(): OutFrameJson {
    return {
      [Def.KEY_UID]: this.uid,
      [Def.KEY_CLASS]: this.TAG,
      [Def.KEY_DIMENS]: {
        [Def.KEY_X]: this.x,
        [Def.KEY_Y]: this.y,
        [Def.KEY_WIDTH]: this.width,
        [Def.KEY_HEIGHT]: this.height,
        [Def.KEY_Z_ORDER]: this.zOrder,
      },
      [Def.KEY_LAYER_GROUP]: this.layerGroup,
    };
  }

  // @Override
  public deserialize(json: ElementJson) {
    alert("ERR: Unsupported Exception");
  }

  /**
   * Deserlialize OutFrame object from JSON object.
   *
   * @param html HTML root node.
   * @param svg SVG root node.
   * @param json JSON object.
   * @return OutFrame.
   */
  public static deserialize(html: JQueryNode, svg: D3Node.SVG, json: OutFrameJson): OutFrame {
    const outFrame = new OutFrame(json[Def.KEY_UID], html, svg);

    outFrame.setXYWH(
        json[Def.KEY_DIMENS][Def.KEY_X],
        json[Def.KEY_DIMENS][Def.KEY_Y],
        json[Def.KEY_DIMENS][Def.KEY_WIDTH],
        json[Def.KEY_DIMENS][Def.KEY_HEIGHT]);

    outFrame.zOrder = json[Def.KEY_DIMENS][Def.KEY_Z_ORDER];

    outFrame.layerGroup = json[Def.KEY_LAYER_GROUP];

    return outFrame;
  }

  // @Override
  public select() {
    // NOP.
  }

  // @Override
  public deselect() {
    this.isEditing = false;
  }

  public resetStateNoCallback() {
    this.isEditing = false;
  }

  public move(plusX: number, plusY: number) {
    // NOP.
  }

  public delete() {
    // NOP.
  }

  // Elements.
  private path!: D3Node.Path;
  private grip: D3Node.Circle|null = null;

  // Position/Size.
  private x: number = 0;
  private y: number = 0;
  private width: number = 0;
  private height: number = 0;

  private _itxMode: ElementItxMode = ElementItxMode.RIGID;
      public set itxMode(mode: ElementItxMode) {
        this._itxMode = mode;
        if (mode !== ElementItxMode.EDITABLE) {
          this.isEditing = false;
        }
      }
      public get itxMode(): ElementItxMode {
        return this._itxMode;
      }

  // Dynamic flags.
  private _isEditing: boolean = false;
      public get isEditing(): boolean {
        return this._isEditing;
      }
      public set isEditing(editing: boolean) {
        if (this.itxMode === ElementItxMode.EDITABLE) {
          if (editing) {
            this.enableEditMode();
          } else {
            this.disableEditMode();
          }
          this._isEditing = editing;
        }
      }
  private isHighlight: boolean = false;

  // Color resolver functions.
  private colorSet: ColorSet = ColorSet.LIGHT_GRAY;
  private colorResolver: ColorResolver;

  // Callback.
  private callback: OutFrameCallback|null = null;

  /**
   * Set position and size.
   * @param x Pxiels
   * @param y Pixels
   * @param width Pixels
   * @param height Pixels
   */
  public setXYWH(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Set size.
   * @param width Pixels
   * @param height Pixels
   */
  public setWH(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Get size.
   * @return {x, y, width, height}
   */
  public getXYWH(): {x: number, y: number, width: number, height:number} {
    return {x: this.x, y: this.y, width: this.width, height: this.height};
  }

  /**
   * Set callback object.
   * @param callback Callback object.
   */
  public setCallback(callback: OutFrameCallback) {
    this.callback = callback;
  }

  /**
   * Reset selected or editing state to default.
   */
  public resetState() {
    this.isEditing = false;
  }

  /**
   * Render.
   */
  public render() {
    this._root = this.svg.append("g")
        .attr("id", this.ROOT_ID);

    this.path = this.root.append("path")
        .attr("fill", "none")
        .attr("stroke-width", this.STROKE_WIDTH);

    this.relayout();
    this.recolor();

    this.registerCallbacks();
  }

  public relayout() {
    this.path
        .datum(this.genAnchors())
        .attr("d", this.genLine());

    if (this.grip != null) {
      this.grip
          .attr("cx", this.x + this.width - this.STROKE_WIDTH / 2)
          .attr("cy", this.y + this.height - this.STROKE_WIDTH / 2);
    }
  }

  private recolor() {
    if (this.isHighlight) {
      this.path.attr("stroke", this.colorResolver.bgHighlight);
    } else {
      this.path.attr("stroke", this.colorResolver.stroke);
    }

    if (this.grip != null) {
      this.grip
          .attr("fill", this.colorResolver.bgHighlight);
    }
  }

  private genAnchors(): {x: number, y:number}[] {
    return [
      {x: this.x + this.STROKE_WIDTH / 2,               y: this.y + this.STROKE_WIDTH / 2               },
      {x: this.x + this.width - this.STROKE_WIDTH / 2,  y: this.y + this.STROKE_WIDTH / 2               },
      {x: this.x + this.width - this.STROKE_WIDTH / 2,  y: this.y + this.height - this.STROKE_WIDTH / 2 },
      {x: this.x + this.STROKE_WIDTH / 2,               y: this.y + this.height - this.STROKE_WIDTH / 2 },
      {x: this.x + this.STROKE_WIDTH / 2,               y: this.y + this.STROKE_WIDTH / 2               },
    ];
  }

  private genLine(): d3.Line<{x: number, y: number}> {
    return d3.line<{x: number, y: number}>()
        .x( (d: {x: number, y: number}) => { return d.x } )
        .y( (d: {x: number, y: number}) => { return d.y } )
        .curve(d3.curveLinear);
  }

  private registerCallbacks() {
    this.path.on("mouseover", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseover");
        if (this.itxMode === ElementItxMode.EDITABLE && !this.isEditing) {
          this.isHighlight = true;
          this.recolor();
        }
    });
    this.path.on("mouseout", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseout");
        if (this.itxMode === ElementItxMode.EDITABLE && !this.isEditing) {
          this.isHighlight = false;
          this.recolor();
        }
    });

    this.path.on("click", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:click");

        if (this.itxMode === ElementItxMode.EDITABLE) {
          this.isEditing = !this.isEditing;
        }

        event.stopPropagation();
    });
  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "enableEditMode()");
    if (this.grip != null) return;

    this.isHighlight = true;
    this.grip = this.addEditGrip(this.GRIP_ID_RIGHT_BOTTOM);
    this.root.raise();
    this.svg.attr("overflow", "visible");

    this.relayout();
    this.recolor();
  }

  private addEditGrip(id: string): D3Node.Circle {
    const TAG = "EditGrip";

    const circle = this.root.append("circle")
        .attr("id", id)
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

              target.origWidth = this.width;
              target.origHeight = this.height;

              target.startX = event.x;
              target.startY = event.y;

              if (this.callback != null) this.callback.onSizeChangeStart();
          } )
          .on("drag", (event: D3Event.Drag) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              const isSnapDragEnabled = event.sourceEvent.altKey;
              const target = event.target as any;

              const origWidth = target.origWidth;
              const origHeight = target.origHeight;

              let dx = event.x - target.startX;
              let dy = event.y - target.startY;

              switch (id) {
                case this.GRIP_ID_RIGHT_BOTTOM: {
                  if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                  if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                  // Edge position.
                  this.width = origWidth + dx;
                  this.height = origHeight + dy;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    this.width = Math.floor(this.width / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                    this.height = Math.floor(this.height / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                  }
                }
                break;
              }

              if (this.callback != null) this.callback.onSizeChange(this.width, this.height);

              this.relayout();
          } )
          .on("end", (event: MouseEvent) => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              const target = event.target as any;

              const startWidth = target.origWidth;
              const startHeight = target.origHeight;

              target.origWidth = 0;
              target.origHeight = 0;

              target.startX = 0;
              target.startY = 0;

              if (this.callback != null) this.callback.onSizeChangeEnd(
                  startWidth,
                  startHeight,
                  this.width,
                  this.height);
          } )
    );

    return circle;
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "disableEditMode()");
    if (this.grip == null) return;

    this.isHighlight = false;
    this.grip.remove();
    this.grip = null;
    this.root.lower();
    this.svg.attr("overflow", "hidden");
    this.recolor();
  }

  public moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `moveToBackEnd()`);
    this.root.lower();
  }

  // @Override
  public moveToTopOf(element: Element) {
    alert("ERR: Unsupported Exception");
  }

  // @Override
  public moveToBottomOf(element: Element) {
    alert("ERR: Unsupported Exception");
  }



}

