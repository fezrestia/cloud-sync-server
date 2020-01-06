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

/**
 * Callback interface for ArchMod.
 */
export interface ArchModCallback {

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

    /**
     * CONSTRUCTOR.
     * @param html HTML root view. Used for non-svg contents like as pop-up window.
     * @param svg SVG root object.
     * @param label Module ID.
     */
    constructor(
            protected html: JQuery<HTMLElement>,
            protected svg: d3.Selection<SVGSVGElement, any, HTMLElement, any>,
            public readonly label: string) {
        // NOP.
    }

    // Elements.
    protected rootView: any;
    protected rect: any;
    protected text: any;
    protected editView: any;

    // Position/Size.
    protected x: number = 0;
    protected y: number = 0;
    protected width: number = 0;
    protected height: number = 0;

    // Position diff by dragging.
    protected dx: number = 0;
    protected dy: number = 0;

    // Font.
    private fontSize: number = 12;

    // Static flags.
    protected isSelectable: boolean = true;
    protected isDraggable: boolean = true;
    protected isEditable: boolean = true;

    // Dynamic flags.
    protected _isSelected:boolean = false;
        get isSelected(): boolean {
            return this._isSelected;
        }
        set isSelected(selected: boolean) {
            this._isSelected = selected;
            this.setHighlight(selected);
        }
    protected _isEditing: boolean = false;
        get isEditing(): boolean {
            return this._isEditing;
        }
        set isEditing(editing: boolean) {
            if (editing) {
                this.enableEditMode();
            } else {
                this.disableEditMode();
            }
            this._isEditing = editing;
        }
    protected _isContextMenuOpened: boolean = false;
        get isContextMenuOpened(): boolean {
            return this.html.css("display") != "none";
        }

    // Color resolver functions.
    private colorResolver: ColorResolver = new ColorResolver("none", "none", "none");

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
    }

    /**
     * Get module position and size.
     * @return {x, y, width, height}
     */
    public getXYWH(): {x: number, y: number, width: number, height:number} {
        let actX = this.x + this.dx;
        let actY = this.y + this.dy;
        return {x: actX, y: actY, width: this.width, height: this.height};
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
     * Render.
     * @return
     */
    public render(): any {
        this.rootView = this.svg.append("g")
            .attr("id", `ArchMod_${this.label}`)
            .datum(this);

        // Rect.
        var rect = this.rootView.append("rect")
            .attr("id", Util.getElementId("rect", this.label))
            .attr("stroke", this.colorResolver.stroke)
            .attr("fill", this.colorResolver.bg)
            .attr("stroke-width", 2);
        this.rect = rect;

        // Text.
        var text = this.rootView.append("text")
            .attr("id", Util.getElementId("text", this.label))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", this.fontSize)
            .attr("fill", this.colorResolver.text);
        text.text(this.label);
        this.text = text;

        this.relayout();

        // Callbacks.
        this.registerCallbacks();

        return this;
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

    protected setHighlight(isHighlight: boolean) {
        if (isHighlight) {
            this.rect.attr("fill", this.colorResolver.bgHighlight);
        } else {
            this.rect.attr("fill", this.colorResolver.bg);
        }
    }

    private registerCallbacks() {
        if (this.isSelectable) {
            this.rect.on("mouseover", () => {
                if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseover");
                if (!this.isSelected && !this.isEditing) {
                    this.setHighlight(true);
                }
            });
            this.rect.on("mouseout", () => {
                if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:mouseout");
                if (!this.isSelected && !this.isEditing) {
                    this.setHighlight(false);
                }
            });

            this.rect.on("click", () => {
                if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:click");

                if (!this.isEditing) {
                    this.isSelected = !this.isSelected;
                }

                d3.event.stopPropagation();
            });
            this.rect.on("dblclick", () => {
                if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:dblclick");

                if (this.isEditing) {
                    if (!this.isContextMenuOpened) {
                        let clickX = d3.event.x;
                        let clickY = d3.event.y;
                        this.openContextMenu(clickX, clickY);
                    }
                } else {
                    // Change to edit view.
                    this.isEditing = true;
                }

                d3.event.stopPropagation();
            });

            if (this.isDraggable) {
                this.rootView.call(
                    d3.drag()
                        .on("start", (d: any) => {
                            if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:start");
                            let archMod = d as ArchMod;
                            archMod.setHighlight(true);
                        } )
                        .on("drag", (d: any) => {
                            if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:drag");
                            let archMod = d as ArchMod;
                            archMod.dx += d3.event.dx;
                            archMod.dy += d3.event.dy;
                            archMod.rootView.attr("transform", `translate(${archMod.dx},${archMod.dy})`);
                        } )
                        .on("end", (d: any) => {
                            if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "on:drag:end");
                            let archMod = d as ArchMod;
                            archMod.setHighlight(false);
                        } )
                );
            }
        }
    }

    private enableEditMode() {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "enableEditMode()");
        if (this.editView != null) return;

        this.editView = this.rootView.append("g");

        this.addEditGripCircle(this.GRIP_ID_LEFT_TOP,       this.x,                 this.y);
        this.addEditGripCircle(this.GRIP_ID_RIGHT_TOP,      this.x + this.width,    this.y);
        this.addEditGripCircle(this.GRIP_ID_LEFT_BOTTOM,    this.x,                 this.y + this.height);
        this.addEditGripCircle(this.GRIP_ID_RIGHT_BOTTOM,   this.x + this.width,    this.y + this.height);





    }

    private addEditGripCircle(id: string, cx: number, cy: number): any {
        let TAG = "EditGrip";

        let circle = this.editView.append("circle")
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
            d3.drag()
                .on("start", () => {
                    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:start");

                    d3.event.target.origX = this.x;
                    d3.event.target.origY = this.y;
                    d3.event.target.origWidth = this.width;
                    d3.event.target.origHeight = this.height;

                    d3.event.target.startX = d3.event.x;
                    d3.event.target.startY = d3.event.y;

                } )
                .on("drag", () => {
                    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:drag:drag");

                    let origX = d3.event.target.origX;
                    let origY = d3.event.target.origY;
                    let origWidth = d3.event.target.origWidth;
                    let origHeight = d3.event.target.origHeight;

                    let dx = d3.event.x - d3.event.target.startX;
                    let dy = d3.event.y - d3.event.target.startY;

                    switch (id) {
                        case this.GRIP_ID_LEFT_TOP:
                            if (origWidth - dx < this.MIN_SIZE_PIX) dx = origWidth - this.MIN_SIZE_PIX;
                            if (origHeight - dy < this.MIN_SIZE_PIX) dy = origHeight - this.MIN_SIZE_PIX;

                            this.x = origX + dx;
                            this.width = origWidth - dx;
                            this.y = origY + dy;
                            this.height = origHeight - dy;
                            break;

                        case this.GRIP_ID_RIGHT_TOP:
                            if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                            if (origHeight - dy < this.MIN_SIZE_PIX) dy = origHeight - this.MIN_SIZE_PIX;

                            this.width = origWidth + dx;
                            this.y = origY + dy;
                            this.height = origHeight - dy;
                            break;

                        case this.GRIP_ID_LEFT_BOTTOM:
                            if (origWidth - dx < this.MIN_SIZE_PIX) dx = origWidth - this.MIN_SIZE_PIX;
                            if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                            this.x = origX + dx;
                            this.width = origWidth - dx;
                            this.height = origHeight + dy;
                            break;

                        case this.GRIP_ID_RIGHT_BOTTOM:
                            if (origWidth + dx < this.MIN_SIZE_PIX) dx = this.MIN_SIZE_PIX - origWidth;
                            if (origHeight + dy < this.MIN_SIZE_PIX) dy = this.MIN_SIZE_PIX - origHeight;

                            this.width = origWidth + dx;
                            this.height = origHeight + dy;
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

                    d3.event.target.startX = 0;
                    d3.event.target.startY = 0;
                } )
        );
    }

    private disableEditMode() {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "disableEditMode()");
        if (this.editView == null) return;

        this.editView.remove();
        this.editView = null;
    }

    private relayout() {
        this.rect.attr("x", this.x);
        this.rect.attr("y", this.y);
        this.rect.attr("width", this.width);
        this.rect.attr("height", this.height);

        this.text.attr("x", this.x + this.width / 2);
        this.text.attr("y", this.y + this.height /2);

        if (this.editView != null) {
            let ltGrip = this.editView.select(`#${this.GRIP_ID_LEFT_TOP}`);
            ltGrip.attr("cx", this.x);
            ltGrip.attr("cy", this.y);

            let rtGrip = this.editView.select(`#${this.GRIP_ID_RIGHT_TOP}`);
            rtGrip.attr("cx", this.x + this.width);
            rtGrip.attr("cy", this.y);

            let lbGrip = this.editView.select(`#${this.GRIP_ID_LEFT_BOTTOM}`);
            lbGrip.attr("cx", this.x);
            lbGrip.attr("cy", this.y + this.height);

            let rbGrip = this.editView.select(`#${this.GRIP_ID_RIGHT_BOTTOM}`);
            rbGrip.attr("cx", this.x + this.width);
            rbGrip.attr("cy", this.y + this.height);

        }

    }

    private ContextMenuCallbackImpl = class implements ArchModContextMenuCallback {
        private target: ArchMod;

        constructor(target: ArchMod) {
            this.target = target;
        }

        onOutsideClicked() {
            this.target.closeContextMenu();
        }

        onRotateLabel(direction: string) {
            this.target.rotateLabel(direction);
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

    private rotateLabel(direction: string) {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `rotateLabel() : ${direction}`);

        switch (direction) {
            case ArchModContextMenu.ROT_CW:

            case ArchModContextMenu.ROT_CCW:

        }
    }
}

