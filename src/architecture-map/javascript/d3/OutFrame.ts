import * as d3 from "d3";
import * as $ from "jquery";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { Def } from "../Def.ts";
import { JQueryNode } from "../TypeDef.ts";
import { D3Node } from "../TypeDef.ts";
import { ColorSet } from "../Def.ts";
import { Element } from "./Element";
import { ElementItxMode } from "./Element";
import { ElementJson } from "./Element";

/**
 * Callback interface for OutFrame.
 */
export interface OutFrameCallback {
  onSizeChangeStart(): void;
  onSizeChange(width: number, height: number): void;
  onSizeChangeEnd(): void;

}

/**
 * Background out side frame class.
 */
export class OutFrame extends Element {
  public readonly TAG = "OutFrame";

  private readonly STROKE_WIDTH = 4;
  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;

  private readonly ROOT_ID = "out_frame";
  private readonly GRIP_ID_RIGHT_BOTTOM = "grip_right_bottom";

  /**
   * CONSTRUCTOR.
   *
   * @param html HTML root object.
   * @param svg SVG root object.
   */
  constructor(protected html: JQueryNode, protected svg: D3Node.SVG) {
    super(html, svg);
    this.colorResolver = ColorSet.resolve(this.colorSet);
  }

  public serialize(): ElementJson {
    // NOP.
    return { [Def.KEY_CLASS]: this.TAG };
  }

  public selectSingleNoCallback() {
    // NOP.
  }

  public selectMultiNoCallback() {
    // NOP.
  }

  public deselectNoCallback() {
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
  private root!: D3Node.G;
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
        if (mode != ElementItxMode.EDITABLE) {
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
        if (this.itxMode == ElementItxMode.EDITABLE) {
          if (editing) {
            this.enableEditMode();
          } else {
            this.disableEditMode();
          }
          this._isEditing = editing;
        }
      }
  private _isSnapDragEnabled: boolean = false;
      public get isSnapDragEnabled(): boolean {
        return this._isSnapDragEnabled;
      }
      public set isSnapDragEnabled(isEnabled: boolean) {
        this._isSnapDragEnabled = isEnabled;
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
    this.root = this.svg.append("g")
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
        if (this.itxMode == ElementItxMode.EDITABLE && !this.isEditing) {
          this.isHighlight = true;
          this.recolor();
        }
    });
    this.path.on("mouseout", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseout");
        if (this.itxMode == ElementItxMode.EDITABLE && !this.isEditing) {
          this.isHighlight = false;
          this.recolor();
        }
    });

    this.path.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:click");

        if (this.itxMode == ElementItxMode.EDITABLE) {
          this.isEditing = !this.isEditing;
        }

        d3.event.stopPropagation();
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
    let TAG = "EditGrip";

    let circle = this.root.append("circle")
        .attr("id", id)
        .attr("r", this.EDIT_GRIP_RADIUS_PIX);

    circle.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
        d3.event.stopPropagation();
    });

    circle.call(
      d3.drag<SVGCircleElement, any, any>()
          .on("start", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");

              d3.event.target.origWidth = this.width;
              d3.event.target.origHeight = this.height;

              d3.event.target.startX = d3.event.x;
              d3.event.target.startY = d3.event.y;

              if (this.callback != null) this.callback.onSizeChangeStart();
          } )
          .on("drag", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              let origWidth = d3.event.target.origWidth;
              let origHeight = d3.event.target.origHeight;

              let dx = d3.event.x - d3.event.target.startX;
              let dy = d3.event.y - d3.event.target.startY;

              switch (id) {
                case this.GRIP_ID_RIGHT_BOTTOM: {
                  if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                  if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                  // Edge position.
                  this.width = origWidth + dx;
                  this.height = origHeight + dy;

                  // Snapping.
                  if (this.isSnapDragEnabled) {
                    this.width = Math.floor(this.width / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                    this.height = Math.floor(this.height / Def.SNAP_STEP_PIX) * Def.SNAP_STEP_PIX;
                  }
                }
                break;
              }

              if (this.callback != null) this.callback.onSizeChange(this.width, this.height);

              this.relayout();
          } )
          .on("end", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              d3.event.target.origWidth = 0;
              d3.event.target.origHeight = 0;

              d3.event.target.startX = 0;
              d3.event.target.startY = 0;

              if (this.callback != null) this.callback.onSizeChangeEnd();
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
}

