import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
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

// Current interaction context.
class Context {

  constructor() {
    // NOP.
  }

  public root!: JQueryNode;
  public svg!: D3Node.SVG;
  public html!: JQueryNode;

  public isAddNewArchModMode: boolean = false;

  private _selectedArchMod: ArchMod|null = null;
      get selectedArchMod(): ArchMod|null {
        return this._selectedArchMod;
      }
      set selectedArchMod(selected: ArchMod|null) {
        if (this._selectedArchMod != selected && this._selectedArchMod != null) {
          this._selectedArchMod.resetState();
        }

        this._selectedArchMod = selected;
      }

  private readonly allArchMods: ArchMod[] = [];

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
}
const CONTEXT = new Context();

// Common callback implementation for ALL ArchMod instances.
class ArchModCallbackImpl implements ArchModCallback {
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

  let totalWidth = 640;
  let totalHeight = 640;

  let root: JQueryNode = $(`#${ROOT_ID}`);
  root.css("width", totalWidth);
  root.css("height", totalHeight);
  CONTEXT.root = root;

  let svg: D3Node.SVG = d3.select(`#${SVG_ROOT_ID}`);
  CONTEXT.svg = svg;

  let html: JQueryNode = $(`#${HTML_ROOT_ID}`);
  html.css("display", "none");
  CONTEXT.html = html;

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

      CONTEXT.addArchMod(archMod);

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

