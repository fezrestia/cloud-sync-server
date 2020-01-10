import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { OutFrame } from "../d3/OutFrame";
import { OutFrameCallback } from "../d3/OutFrame";
import { TraceLog } from "../util/TraceLog.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const ROOT_ID = "root";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";
const DEFAULT_SIZE = 120;
const DEFAULT_TOTAL_WIDTH = 640;
const DEFAULT_TOTAL_HEIGHT = 640;

// Current interaction context.
class Context {
  // Root nodes.
  public root!: JQueryNode;
  public svg!: D3Node.SVG;
  public html!: JQueryNode;

  // Elements.
  public outFrame! :OutFrame;
  public brushLayer!: D3Node.G|null;
  private readonly allArchMods: ArchMod[] = [];
  private readonly brushedArchMods: ArchMod[] = [];

  // State flags.
  public isAddNewArchModMode: boolean = false;

  private _selectedArchMod: ArchMod|null = null;
      get selectedArchMod(): ArchMod|null {
        return this._selectedArchMod;
      }
      set selectedArchMod(selected: ArchMod|null) {
        if (this.selectedArchMod == selected) return;
        this._selectedArchMod = selected;
        this.resetAllStateExceptFor(selected);
      }

  public addArchMod(archMod: ArchMod) {
    this.allArchMods.push(archMod);
  }

  public removeArchMod(archMod: ArchMod) {
    let index = this.allArchMods.indexOf(archMod);
    if (index < 0) {
      TraceLog.e(TAG, `## ArchMod=${archMod.label} is NOT existing.`);
      return;
    }
    this.allArchMods.splice(index, 1);
  }

  // @param selection area 4-edge.
  public updateBrushed(selected: number[][]) {
    let minX = selected[0][0];
    let minY = selected[0][1];
    let maxX = selected[1][0];
    let maxY = selected[1][1];

    this.allArchMods.forEach( (archMod: ArchMod) => {
      let {x, y, width, height} = archMod.getXYWH();

      if (minX < x && minY < y && x + width < maxX && y + height < maxY) {
        if (!this.brushedArchMods.includes(archMod)) {
          archMod.isMovable = true;
          this.brushedArchMods.push(archMod);
        }
      } else {
        let index = this.brushedArchMods.indexOf(archMod);
        if (0 <= index) {
          let removes: ArchMod[] = this.brushedArchMods.splice(index, 1);
          removes[0].isMovable = false;
        }
      }

    } );
  }

  public moveBrushedArchMod(plusX: number, plusY: number, except: ArchMod) {
    this.brushedArchMods.forEach( (archMod: ArchMod) => {
      if (archMod == except) return;
      archMod.move(plusX, plusY);
    } );
  }

  /**
   * Reset selected/editing or something state to default without exception.
   *
   * @param except ArchMod Exception of reset target. If null, ALL state will be reset.
   */
  public resetAllStateExceptFor(except: ArchMod|null) {
    this.allArchMods.forEach( (archMod: ArchMod) => {
      if (except == archMod) return;
      archMod.resetState();
    } );

    this.outFrame.resetState();

    this.brushedArchMods.length = 0; // clear all.
  }

  public resetAllState() {
    this.resetAllStateExceptFor(null);
  }

  public changeOutFrameSize(width:number, height: number) {
    this.root.css("width", width);
    this.root.css("height", height);
  }

}
const CONTEXT = new Context();

// OutFrame callback implementation.
class OutFrameCallbackImpl implements OutFrameCallback {
  onSizeChanged(width: number, height: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChanged() : width=${width}, height=${height}`);
    CONTEXT.changeOutFrameSize(width, height);
  }
}

// Common callback implementation for ALL ArchMod instances.
class ArchModCallbackImpl implements ArchModCallback {
  onSvgAdded(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSvgAdded() : ${archMod.label}`);
    CONTEXT.addArchMod(archMod);
  }

  onSvgRemoved(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSvgRemoved() : ${archMod.label}`);
    CONTEXT.removeArchMod(archMod);
  }

  onSelected(selected: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSelected() : ${selected.label}`);
    CONTEXT.selectedArchMod = selected;
  }

  onDeselected(deselected: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDeselected() : ${deselected.label}`);
    CONTEXT.selectedArchMod = null;
  }

  onEditing(editing: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEditing() : ${editing.label}`);
    CONTEXT.selectedArchMod = editing;
  }

  onEdited(edited: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEdited() : ${edited.label}`);
    CONTEXT.selectedArchMod = null;
  }

  onDragMoved(moved: ArchMod, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragMoved() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveBrushedArchMod(plusX, plusY, moved);
  }

}

(window as any).onArchitectureMapTopLoaded = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onArchitectureMapTopLoaded()");

  let root: JQueryNode = $(`#${ROOT_ID}`);
  root.css("width", DEFAULT_TOTAL_WIDTH);
  root.css("height", DEFAULT_TOTAL_HEIGHT);
  CONTEXT.root = root;

  let svg: D3Node.SVG = d3.select(`#${SVG_ROOT_ID}`);
  CONTEXT.svg = svg;

  let html: JQueryNode = $(`#${HTML_ROOT_ID}`);
  html.css("display", "none");
  CONTEXT.html = html;

  let outFrame = new OutFrame(CONTEXT.svg);
  outFrame.setCallback(new OutFrameCallbackImpl());
  outFrame.setXYWH(0, 0, DEFAULT_TOTAL_WIDTH, DEFAULT_TOTAL_HEIGHT);
  outFrame.render();
  CONTEXT.outFrame = outFrame;



  registerGlobalCallbacks();
}

function prepareBrushLayer() {
  if (CONTEXT.brushLayer != null) return;

  CONTEXT.resetAllState();

  let brushLayer: D3Node.G = CONTEXT.svg.append("g")
      .attr("class", "brushes")
      .lower();
  CONTEXT.brushLayer = brushLayer;

  // Max brush area size.
  let {x, y, width, height} = CONTEXT.outFrame.getXYWH();

  let brush: d3.BrushBehavior<any> = d3.brush()
      .extent([[x, y], [x + width, y + height]])
      .filter( () => {
        return !d3.event.button;
      } )
      .on("start", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:start");

        brushLayer.raise();
      } )
      .on("brush", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:brush");

        if (d3.event.selection != null) {
          let brushArea: number[][] = d3.event.selection;
          if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `brushArea = ${brushArea}`);

          CONTEXT.updateBrushed(brushArea);
        }
      } )
      .on("end", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:end");

        if (d3.event.selection != null) {
          // Immediately cancel selection.
          // After cleared, brush callback is called again with null selection.
          // So, check selection != null here to avoid infinite loop.
          brushLayer.call(d3.event.target.clear);
        }

        brushLayer.lower();
      } );

  brushLayer.call(brush);
}

function releaseBrushLayer() {
  if (CONTEXT.brushLayer == null) return;

  CONTEXT.brushLayer.remove();
  CONTEXT.brushLayer = null;
}

function registerGlobalCallbacks() {
  window.onkeydown = (event: KeyboardEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `window.onkeydown() : key=${event.key}`);
    event.stopPropagation();

    switch (event.key) {
      case "Control":
        prepareBrushLayer();
        break;

      case "d":
        if (TraceLog.IS_DEBUG) {
          TraceLog.d(TAG, "#### DEBUG LOG ####");

          TraceLog.d(TAG, "CONTEXT =");
          console.log(CONTEXT);

          TraceLog.d(TAG, "###################");
        }
        break;
    }
  };

  window.onkeyup = (event: KeyboardEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `window.onkeyup() : key=${event.key}`);
    event.stopPropagation();

    switch (event.key) {
      case "Control":
        releaseBrushLayer();
        break;
    }
  };

  CONTEXT.svg.on("click", () => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
    CONTEXT.resetAllState();
    d3.event.stopPropagation();
  });
}

(window as any).onAddNewArchModClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddNewArchModClicked()");

  if (CONTEXT.isAddNewArchModMode) {
    // Finish add mode.

    resetHtmlRoot();
    CONTEXT.isAddNewArchModMode = false;

  } else {
    // Prepare add mode.

    CONTEXT.resetAllState();

    CONTEXT.html.css("display", "block");
    CONTEXT.html.css("background-color", "#AAAAAAAA");

    CONTEXT.html.on("click", (e: JQuery.Event) => {
      let posX: number = e.offsetX || 0;
      let posY: number = e.offsetY || 0;

      addNewArchMod("Test Label", posX, posY, DEFAULT_SIZE, DEFAULT_SIZE);

      // Finish add mode.
      resetHtmlRoot();
      CONTEXT.isAddNewArchModMode = false;
    } );

    CONTEXT.isAddNewArchModMode = true;
  }
}

function addNewArchMod(label: string, x: number, y: number, width: number, height: number): ArchMod {
  let archMod = new ArchMod(CONTEXT.html, CONTEXT.svg, label);
  archMod.setCallback(new ArchModCallbackImpl());
  archMod.setXYWH(x, y, DEFAULT_SIZE, DEFAULT_SIZE);
  archMod.render();
  return archMod;
}

function resetHtmlRoot() {
  CONTEXT.html.css("display", "none");
  CONTEXT.html.css("background-color", "");
  CONTEXT.html.off("click");
}

