import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { TraceLog } from "../util/TraceLog.ts";
import { ColorSet } from "../Def.ts";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const ROOT_ID = "root";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";
const DEFAULT_SIZE = 120;

// Current interaction context.
class Context {

  public root: JQuery<HTMLElement>|null = null;
  public svg: d3.Selection<SVGSVGElement, any, HTMLElement, any>|null = null;
  public html: JQuery<HTMLElement>|null = null;

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

  public readonly allArchMods: ArchMod[] = [];


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

function onArchitectureMapTopLoaded() {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onArchitectureMapTopLoaded()");

  let totalWidth = 640;
  let totalHeight = 640;

  let root = $(`#${ROOT_ID}`);
  root.css("width", totalWidth);
  root.css("height", totalHeight);
  CONTEXT.root = root;

  let svg: d3.Selection<SVGSVGElement, any, HTMLElement, any> = d3.select(`#${SVG_ROOT_ID}`);
  svg.attr("width", "100%");
  svg.attr("height", "100%");
  CONTEXT.svg = svg;

  let html = $(`#${HTML_ROOT_ID}`);
  html.css("width", "100%");
  html.css("height", "100%");
  html.css("display", "none");
  CONTEXT.html = html;








  svg.on("click", () => {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
      CONTEXT.resetSelectedState();
      d3.event.stopPropagation();
  });

}
eval(`window["onArchitectureMapTopLoaded"] = onArchitectureMapTopLoaded;`);

function onAddNewArchModClicked() {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddNewArchModClicked()");

  let html = CONTEXT.html;
  if (html == null) return;

  if (CONTEXT.isAddNewArchModMode) {
    // Finish add mode.

    html.css("display", "none");
    html.css("background-color", "");
    html.off("click");

    CONTEXT.isAddNewArchModMode = false;
  } else {
    // Prepare add mode.

    CONTEXT.resetAllState();

    html.css("display", "block");
    html.css("background-color", "#AAAAAAAA");
    html.on("click", (e: JQuery.Event) => {
      let html = CONTEXT.html;
      let svg = CONTEXT.svg;
      if (html == null || svg == null) return;

      let posX: number = e.offsetX || 0;
      let posY: number = e.offsetY || 0;

      let archMod = new ArchMod(html, svg, "Test Label");
      archMod.setCallback(new ArchModCallbackImpl());
      archMod.setXYWH(posX, posY, DEFAULT_SIZE, DEFAULT_SIZE);
      archMod.render();

      if (TraceLog.IS_DEBUG) {
        let {x: x, y: y, width: w, height: h} = archMod.getXYWH();
        TraceLog.d(TAG, `ArchMod added. x=${x}, y=${y}, w=${w}, h=${h}`);
      }

      // Finish add mode.
      onAddNewArchModClicked();
    } );

    CONTEXT.isAddNewArchModMode = true;
  }
}
eval(`window["onAddNewArchModClicked"] = onAddNewArchModClicked;`);

