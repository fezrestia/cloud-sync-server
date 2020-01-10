import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { ColorResolver } from "./resolver/ColorResolver.ts";
import { Point } from "./Util.ts";
import { TraceLog } from "../util/TraceLog.ts";
import { Util } from "./Util.ts";
import { ArchModContextMenu } from "../components/ArchModContextMenu.tsx";
import { ArchModContextMenuCallback } from "../components/ArchModContextMenu.tsx";
import { Def } from "../Def.ts";
import { ClipArea } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";

/**
 * Callback interface for ArchMod.
 */
export interface ArchModCallback {
  onSvgAdded(archMod: ArchMod): void;
  onSvgRemoved(archMod: ArchMod): void;

  onSelected(selected: ArchMod): void;
  onDeselected(deselected: ArchMod): void;

  onDragMoved(moved: ArchMod, pulsX: number, plusY: number): void;

}

/**
 * Architecture Module class.
 */
export class ArchMod {
  private readonly TAG = "ArchMod";

  private readonly EDIT_GRIP_RADIUS_PIX = 8;
  private readonly MIN_SIZE_PIX = 16;

  private readonly GRIP_ID_LEFT_TOP = "grip_left_top";
  private readonly GRIP_ID_RIGHT_TOP = "grip_right_top";
  private readonly GRIP_ID_LEFT_BOTTOM = "grip_left_bottom";
  private readonly GRIP_ID_RIGHT_BOTTOM = "grip_right_bottom";
  private readonly GRIP_ID_PIN = "grip_pin";

  /**
   * CONSTRUCTOR.
   * @param html HTML root view. Used for non-svg contents like as pop-up window.
   * @param svg SVG root object.
   * @param label Module ID.
   */
  constructor(
    private html: JQueryNode,
    private svg: D3Node.SVG,
    public readonly label: string) {
    // NOP.
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
  private pinX: number = 0;
  private pinY: number = 0;

  private clipArea = ClipArea.NONE;

  // Font.
  private fontSize: number = 12;

  // Static flags.
  private isSelectable: boolean = true;
  private isDraggable: boolean = true;
  private isEditable: boolean = true;

  // Dynamic flags.
  private _isSelected: boolean = false;
      public get isSelected(): boolean {
        return this._isSelected;
      }
      public set isSelected(selected: boolean) {
        let isChanged = this._isSelected != selected;
        this._isSelected = selected;
        this.setHighlight(selected);

        if (this.callback != null && isChanged) {
          selected ? this.callback.onSelected(this) : this.callback.onDeselected(this);
        }
      }
  private _isEditing: boolean = false;
      public get isEditing(): boolean {
        return this._isEditing;
      }
      public set isEditing(editing: boolean) {
        if (editing) {
          this.enableEditMode();
        } else {
          this.disableEditMode();
        }
        this._isEditing = editing;
      }
  private _isContextMenuOpened: boolean = false;
      private get isContextMenuOpened(): boolean {
        return this.html.css("display") != "none";
      }

  // Color resolver functions.
  private colorResolver: ColorResolver = ColorSet.GRAY;

  // Callback.
  private callback: ArchModCallback|null = null;

  /**
   * Set module position and size.
   * @param x Pixels
   * @param y Pixels
   * @param width Pixels
   * @param height Pixels
   */
  public setXYWH(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pinX = x + width / 2;
    this.pinY = y + height / 2;
  }

  /**
   * Get module position and size.
   * @return {x, y, width, height}
   */
  public getXYWH(): {x: number, y: number, width: number, height:number} {
    return {x: this.x, y: this.y, width: this.width, height: this.height};
  }

  /**
   * Set color strategy.
   * @param colorResolver Color strategy object.
   */
  public setColorResolver(colorResolver: ColorResolver) {
    this.colorResolver = colorResolver;
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
   * Reset selected or editing state to default.
   */
  public resetState() {
    this.isEditing = false;
    this.isSelected = false;
  }

  /**
   * Render.
   */
  public render() {
    this.root = this.svg.append("g")
        .attr("id", `ArchMod_${this.label}`)
        .datum(this);

    // Polygon, normally Rect.
    this.polygon = this.root.append("polygon")
        .attr("id", Util.getElementId("polygon", this.label))
        .attr("stroke-width", 2);

    // Text.
    this.text = this.root.append("text")
        .attr("id", Util.getElementId("text", this.label))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", this.fontSize)
        .attr("pointer-events", "none")
        .text(this.label);

    this.relayout();
    this.recolor();

    // Callbacks.
    this.registerCallbacks();

    if (this.callback != null) this.callback.onSvgAdded(this);
  }

  /**
   * Get center point of top line.
   * @return
   */
  public getTopMidPoint(): Point {
    let {x: curX, y: curY, width: curW, height: curH} = this.getXYWH();
    return new Point(curX + curW / 2, curY);
  }

  /**
   * Get center point of bottom line.
   * @return
   */
  public getBottomMidPoint(): Point {
    let {x: curX, y: curY, width: curW, height: curH} = this.getXYWH();
    return new Point(curX + curW / 2, curY + curH);
  }

  private setHighlight(isHighlight: boolean) {
    if (isHighlight) {
      this.polygon.attr("fill", this.colorResolver.bgHighlight);
    } else {
      this.polygon.attr("fill", this.colorResolver.bg);
    }
  }

  /**
   * Move this ArchMod with X-Y diff.
   *
   * @param plusX
   * @param plusY
   */
  public move(plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `move() : ID=${this.label}, plusX=${plusX}, plusY=${plusY}`);
    this.x += plusX;
    this.y += plusY;
    this.pinX += plusX;
    this.pinY += plusY;
    this.relayout();
  }

  private registerCallbacks() {
    if (this.isSelectable) {
      this.polygon.on("mouseover", () => {
          if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseover");
          if (!this.isSelected && !this.isEditing) {
              this.setHighlight(true);
          }
      });
      this.polygon.on("mouseout", () => {
          if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseout");
          if (!this.isSelected && !this.isEditing) {
              this.setHighlight(false);
          }
      });

      this.polygon.on("click", () => {
          if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:click");

          if (!this.isEditing) {
            this.isSelected = !this.isSelected;
          }

          d3.event.stopPropagation();
      });
      this.polygon.on("dblclick", () => {
          if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:dblclick");

          if (this.isEditing) {
            if (!this.isContextMenuOpened) {
              let clickX = d3.event.x;
              let clickY = d3.event.y;
              this.openContextMenu(clickX, clickY);
            }
          } else {
            // Change to edit view.
            this.isSelected = true;
            this.isEditing = true;
          }

          d3.event.stopPropagation();
      });

      if (this.isDraggable) {
        this.root.call(
          d3.drag<SVGGElement, any, any>()
              .on("start", () => {
                  if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:start");
                  if (this.isEditing) {
                    this.setHighlight(true);

                    d3.event.target.origX = this.x;
                    d3.event.target.origY = this.y;
                    d3.event.target.origPinX = this.pinX;
                    d3.event.target.origPinY = this.pinY;
                    d3.event.target.startX = d3.event.x;
                    d3.event.target.startY = d3.event.y;
                  }
              } )
              .on("drag", () => {
                  if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:drag");
                  if (this.isEditing) {
                    let isSnapDragEnabled = d3.event.sourceEvent.altKey;

                    let dx = d3.event.x - d3.event.target.startX;
                    let dy = d3.event.y - d3.event.target.startY;

                    let oldX = this.x;
                    let oldY = this.y;

                    this.x = d3.event.target.origX + dx;
                    this.y = d3.event.target.origY + dy;
                    this.pinX = d3.event.target.origPinX + dx;
                    this.pinY = d3.event.target.origPinY + dy;

                    // Position snapping.
                    if (isSnapDragEnabled) {
                      let snapX = this.x % Def.SNAP_STEP_PIX;
                      this.x -= snapX;
                      this.pinX -= snapX;
                      let snapY = this.y % Def.SNAP_STEP_PIX;
                      this.y -= snapY;
                      this.pinY -= snapY;
                    }

                    this.relayout();

                    let plusX = this.x - oldX;
                    let plusY = this.y - oldY;
                    if (this.callback != null) this.callback.onDragMoved(this, plusX, plusY);
                  }
              } )
              .on("end", () => {
                  if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:end");
                  if (this.isEditing) {
                    this.setHighlight(false);

                    d3.event.target.origX = 0;
                    d3.event.target.origY = 0;
                    d3.event.target.origPinX = 0;
                    d3.event.target.origPinY = 0;
                    d3.event.target.startX = 0;
                    d3.event.target.startY = 0;
                  }
              } )
        );
      }
    }
  }

  private enableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "enableEditMode()");
    if (this.editor != null) return;

    this.setHighlight(false);

    this.editor = this.root.append("g");

    this.addEditGrip(this.GRIP_ID_LEFT_TOP,       this.x,                 this.y);
    this.addEditGrip(this.GRIP_ID_RIGHT_TOP,      this.x + this.width,    this.y);
    this.addEditGrip(this.GRIP_ID_LEFT_BOTTOM,    this.x,                 this.y + this.height);
    this.addEditGrip(this.GRIP_ID_RIGHT_BOTTOM,   this.x + this.width,    this.y + this.height);

    if (this.clipArea != ClipArea.NONE) {
      this.addEditGrip(this.GRIP_ID_PIN, this.pinX, this.pinY);
    }

  }

  private addEditGrip(id: string, cx: number, cy: number): any {
    if (this.editor == null) return;

    let TAG = "EditGrip";

    let circle = this.editor.append("circle")
        .attr("id", id)
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("fill", this.colorResolver.stroke)
        .attr("r", this.EDIT_GRIP_RADIUS_PIX);

    circle.on("mouseover", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:mouseover");
        circle.attr("fill", this.colorResolver.bgHighlight);
    });
    circle.on("mouseout", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:mouseout");
        circle.attr("fill", this.colorResolver.stroke);
    });
    circle.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
        d3.event.stopPropagation();
    });

    circle.call(
      d3.drag<SVGCircleElement, any, any>()
          .on("start", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");

              d3.event.target.origX = this.x;
              d3.event.target.origY = this.y;
              d3.event.target.origWidth = this.width;
              d3.event.target.origHeight = this.height;
              d3.event.target.origPinX = this.pinX;
              d3.event.target.origPinY = this.pinY;

              d3.event.target.startX = d3.event.x;
              d3.event.target.startY = d3.event.y;

          } )
          .on("drag", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

              let isSnapDragEnabled = d3.event.sourceEvent.altKey;

              let origX = d3.event.target.origX;
              let origY = d3.event.target.origY;
              let origWidth = d3.event.target.origWidth;
              let origHeight = d3.event.target.origHeight;
              let origPinX = d3.event.target.origPinX;
              let origPinY = d3.event.target.origPinY;

              let dx = d3.event.x - d3.event.target.startX;
              let dy = d3.event.y - d3.event.target.startY;

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
                  let minPinX = this.x + this.MIN_SIZE_PIX / 2;
                  let minPinY = this.y + this.MIN_SIZE_PIX / 2;
                  if (this.pinX < minPinX) this.pinX = minPinX;
                  if (this.pinY < minPinY) this.pinY = minPinY;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = this.x % Def.SNAP_STEP_PIX;
                    this.x -= snapX;
                    this.width += snapX;
                    let snapY = this.y % Def.SNAP_STEP_PIX;
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
                  let maxPinX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                  let minPinY = this.y + this.MIN_SIZE_PIX / 2;
                  if (this.pinX > maxPinX) this.pinX = maxPinX;
                  if (this.pinY < minPinY) this.pinY = minPinY;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = (this.x + this.width) % Def.SNAP_STEP_PIX;
                    this.width -= snapX;
                    let snapY = this.y % Def.SNAP_STEP_PIX;
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
                  let minPinX = this.x + this.MIN_SIZE_PIX / 2;
                  let maxPinY = this.y + this.height - this.MIN_SIZE_PIX / 2;
                  if (this.pinX < minPinX) this.pinX = minPinX;
                  if (this.pinY > maxPinY) this.pinY = maxPinY;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = this.x % Def.SNAP_STEP_PIX;
                    this.x -= snapX;
                    this.width += snapX;
                    let snapY = (this.y + this.height) % Def.SNAP_STEP_PIX;
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
                  let maxPinX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                  let maxPinY = this.y + this.height - this.MIN_SIZE_PIX / 2;
                  if (this.pinX > maxPinX) this.pinX = maxPinX;
                  if (this.pinY > maxPinY) this.pinY = maxPinY;

                  // Snapping.
                  if (isSnapDragEnabled) {
                    let snapX = (this.x + this.width) % Def.SNAP_STEP_PIX;
                    this.width -= snapX;
                    let snapY = (this.y + this.height) % Def.SNAP_STEP_PIX;
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

                   let minX = this.x + this.MIN_SIZE_PIX / 2;
                   let maxX = this.x + this.width - this.MIN_SIZE_PIX / 2;
                   let minY = this.y + this.MIN_SIZE_PIX / 2;
                   let maxY = this.y + this.height - this.MIN_SIZE_PIX / 2;

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

          } )
          .on("end", () => {
              if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:end");

              d3.event.target.origX = 0;
              d3.event.target.origY = 0;
              d3.event.target.origWidth = 0;
              d3.event.target.origHeight = 0;
              d3.event.target.origPinX = 0;
              d3.event.target.origPinY = 0;

              d3.event.target.startX = 0;
              d3.event.target.startY = 0;
          } )
    );
  }

  private disableEditMode() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "disableEditMode()");
    if (this.editor == null) return;

    this.editor.remove();
    this.editor = null;
  }

  private relayout() {
    // Common dimens.
    let left = this.x;
    let top = this.y;
    let right = this.x + this.width;
    let bottom = this.y + this.height;
    let pinX = this.pinX;
    let pinY = this.pinY;
    let centerX = left + this.width / 2;
    let centerY = top + this.height / 2;

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
    let polygonPoints: string = points
        .map( (point: number[]): string => { return point.join(",") } )
        .join(" ");
    this.polygon.attr("points", polygonPoints);

    // Text label.
    let labelX: number = 0;
    let labelY: number = 0;
    switch (this.clipArea) {
      case ClipArea.NONE:
        labelX = centerX;
        labelY = centerY;
        break;

      case ClipArea.LEFT_TOP:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            labelX = centerX;
            labelY = pinY + (bottom - pinY) / 2;
            break;

          case Def.DEG_VERTICAL:
            labelX = pinX + (right - pinX) / 2;
            labelY = centerY;
            break;
        }
        break;

      case ClipArea.RIGHT_TOP:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            labelX = centerX;
            labelY = pinY + (bottom - pinY) / 2;
            break;

          case Def.DEG_VERTICAL:
            labelX = left + (pinX - left) / 2;
            labelY = centerY;
            break;
        }
        break;

      case ClipArea.LEFT_BOTTOM:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            labelX = centerX;
            labelY = top + (pinY - top) / 2;
            break;

          case Def.DEG_VERTICAL:
            labelX = pinX + (right - pinX) / 2;
            labelY = centerY;
            break;
        }
        break;

      case ClipArea.RIGHT_BOTTOM:
        switch (this.labelRotDeg) {
          case Def.DEG_HORIZONTAL:
            labelX = centerX;
            labelY = top + (pinY - top) / 2;
            break;

          case Def.DEG_VERTICAL:
            labelX = left + (pinX - left) / 2;
            labelY = centerY;
            break;
        }
        break;
    }
    this.text.attr("x", labelX);
    this.text.attr("y", labelY);
    this.text.attr("transform", `rotate(${this.labelRotDeg},${labelX},${labelY})`);

    // Grips.
    if (this.editor != null) {
      let ltGrip = this.editor.select(`#${this.GRIP_ID_LEFT_TOP}`);
      ltGrip.attr("cx", this.x);
      ltGrip.attr("cy", this.y);

      let rtGrip = this.editor.select(`#${this.GRIP_ID_RIGHT_TOP}`);
      rtGrip.attr("cx", this.x + this.width);
      rtGrip.attr("cy", this.y);

      let lbGrip = this.editor.select(`#${this.GRIP_ID_LEFT_BOTTOM}`);
      lbGrip.attr("cx", this.x);
      lbGrip.attr("cy", this.y + this.height);

      let rbGrip = this.editor.select(`#${this.GRIP_ID_RIGHT_BOTTOM}`);
      rbGrip.attr("cx", this.x + this.width);
      rbGrip.attr("cy", this.y + this.height);

      if (this.clipArea != ClipArea.NONE) {
        let pinGrip = this.editor.select(`#${this.GRIP_ID_PIN}`);
        pinGrip.attr("cx", this.pinX);
        pinGrip.attr("cy", this.pinY);
      }

    }

  }

  private recolor() {
    this.polygon.attr("stroke", this.colorResolver.stroke);
    this.polygon.attr("fill", this.colorResolver.bg)

    this.text.attr("fill", this.colorResolver.text);

  }

  private ContextMenuCallbackImpl = class implements ArchModContextMenuCallback {
    private target: ArchMod;

    constructor(target: ArchMod) {
      this.target = target;
    }

    close() {
      this.target.closeContextMenu();
    }

    changeLabelRotDeg(rotDeg: number) {
      this.target.rotateLabel(rotDeg);
    }

    changeClipArea(clipArea: ClipArea) {
      this.target.changeClipArea(clipArea);
    }

    changeColorSet(colorResolver: ColorResolver) {
      this.target.setColorResolver(colorResolver);

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

    delete() {
      this.target.delete();
    }
  }

  private openContextMenu(clickX: number, clickY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "openContextMenu()");

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
        <ArchModContextMenu
            idLabel={"Test Label"}
            callback={new this.ContextMenuCallbackImpl(this)}
            leftPix={leftPix}
            topPix={topPix}
        />,
        document.getElementById(this.html[0].id));
  }

  private closeContextMenu() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "closeContextMenu()");

    let container = document.getElementById(this.html[0].id);
    if (container != null) {
      ReactDOM.unmountComponentAtNode(container);
    }

    this.html.css("display", "none");
  }

  private rotateLabel(rotDeg: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `rotateLabel() : rotDeg=${rotDeg}`);
    this.labelRotDeg = rotDeg;
    this.relayout();
  }

  private changeClipArea(clipArea: ClipArea) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `changeClipArea() : ${clipArea}`);

    if (this.clipArea != clipArea) {
      this.clipArea = clipArea;

      // Re-construction and re-layout.
      this.disableEditMode();
      this.enableEditMode();
      this.relayout();
    }
  }

  private moveToFrontEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `moveToFrontEnd()`);
    this.root.raise();
  }

  private moveToBackEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `moveToBackEnd()`);
    this.root.lower();
  }

  private delete() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `moveToBackEnd()`);
    this.closeContextMenu();
    this.root.remove();
    if (this.callback != null) this.callback.onSvgRemoved(this);
  }
}

