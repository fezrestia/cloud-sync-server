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
  private readonly allArchMods: ArchMod[] = [];

  // State flags.
  public isAddNewArchModMode: boolean = false;

  private _selectedArchMod: ArchMod|null = null;
      get selectedArchMod(): ArchMod|null {
        return this._selectedArchMod;
      }
      set selectedArchMod(selected: ArchMod|null) {
        if (this._selectedArchMod != selected && this._selectedArchMod != null) {
          this._selectedArchMod.resetState();
        }
        this.outFrame.isEditing = false;
        this._selectedArchMod = selected;
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

  public resetSelectedState() {
    if (this.selectedArchMod != null) {
      this.selectedArchMod.resetState();
    }
    this.outFrame.isEditing = false;
  }

  public resetAllState() {
    this.allArchMods.forEach( (archMod: ArchMod) => {
      archMod.resetState();
    } );
  }

  public enableSnapDrag() {
    if (this.selectedArchMod != null) {
      this.selectedArchMod.isSnapDragEnabled = true;
    }
  }

  public disableSnapDrag() {
    if (this.selectedArchMod != null) {
      this.selectedArchMod.isSnapDragEnabled = false;
    }
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
  outFrame.setWH(DEFAULT_TOTAL_WIDTH, DEFAULT_TOTAL_HEIGHT);
  outFrame.render();
  CONTEXT.outFrame = outFrame;

  registerGlobalCallbacks();
}

function registerGlobalCallbacks() {
  window.onkeydown = (event: KeyboardEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `window.onkeydown() : key=${event.key}`);
    event.stopPropagation();

    switch (event.key) {
      case "Alt":
        CONTEXT.enableSnapDrag();
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

    return true;
  };

  window.onkeyup = (event: KeyboardEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `window.onkeyup() : key=${event.key}`);
    event.stopPropagation();

    switch (event.key) {
      case "Alt":
        CONTEXT.disableSnapDrag();
        break;
    }

    return true;
  };

  CONTEXT.svg.on("click", () => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
    CONTEXT.resetSelectedState();
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

      let archMod = new ArchMod(CONTEXT.html, CONTEXT.svg, "Test Label");
      archMod.setCallback(new ArchModCallbackImpl());
      archMod.setXYWH(posX, posY, DEFAULT_SIZE, DEFAULT_SIZE);
      archMod.render();

      if (TraceLog.IS_DEBUG) {
        let {x: x, y: y, width: w, height: h} = archMod.getXYWH();
        TraceLog.d(TAG, `ArchMod added. x=${x}, y=${y}, w=${w}, h=${h}`);
      }

      // Finish add mode.
      resetHtmlRoot();
      CONTEXT.isAddNewArchModMode = false;

    } );

    CONTEXT.isAddNewArchModMode = true;
  }
}

function resetHtmlRoot() {
  CONTEXT.html.css("display", "none");
  CONTEXT.html.css("background-color", "");
  CONTEXT.html.off("click");
}

