import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { ArchModJson } from "../d3/ArchMod";
import { OutFrame } from "../d3/OutFrame";
import { OutFrameCallback } from "../d3/OutFrame";
import { TraceLog } from "../util/TraceLog.ts";
import { ColorSet } from "../Def.ts";
import { D3Node } from "../TypeDef.ts";
import { JQueryNode } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { Util } from "../util/Util";
import { Downloader } from "../util/Downloader.ts";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const ROOT_ID = "root";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";
const DEFAULT_SIZE = 120;
const DEFAULT_TOTAL_WIDTH = 640;
const DEFAULT_TOTAL_HEIGHT = 640;

interface ElementJson {
  [Def.KEY_CLASS]: string,
}

interface ArchitectureMapJson {
  [Def.KEY_VERSION]: string,
  [Def.KEY_ARCHITECTURE_MAP]: ElementJson[],
}

// Current interaction context.
class Context {
  // Root nodes.
  public root!: JQueryNode;
  public svg!: D3Node.SVG;
  public html!: JQueryNode;

  // Background static elements.
  public outFrame! :OutFrame;

  // Interactable dynamic elements.
  public brushLayer!: D3Node.G|null;
  private readonly brushedArchMods: ArchMod[] = [];

  // Total elements. Head->Tail = Z-Low->Z-High = SVG/HTML Order Top->Bottom.
  private readonly allArchMods: ArchMod[] = [];

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

  /**
   * Serialized current static context to JSON string.
   * @return string JSON.
   */
  public serializeToJson(): string {
    let serializedElements: ElementJson[] = [];
    this.allArchMods.forEach( (archMod: ArchMod) => {
      let serialized = archMod.serialize();
      serializedElements.push(serialized);
    } );

    let totalJson: ArchitectureMapJson = {
      [Def.KEY_VERSION]: Def.VAL_VERSION,
      [Def.KEY_ARCHITECTURE_MAP]: serializedElements,
    };

    let jsonString = JSON.stringify(totalJson, null, 2);
    return jsonString;
  }

  public deserializeFromJson(serialized: string) {
    TraceLog.d(TAG, `deserializeFromjson()`);

    let jsonObj: ArchitectureMapJson = JSON.parse(serialized);

    let ver: string = jsonObj[Def.KEY_VERSION];
    TraceLog.d(TAG, `## ver = ${ver}`);

    let elements: ElementJson[] = jsonObj[Def.KEY_ARCHITECTURE_MAP];
    elements.forEach( (element: ElementJson) => {
      switch (element[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          let json = element as ArchModJson;
          let archMod = ArchMod.deserialize(CONTEXT.html, CONTEXT.svg, json);
          archMod.setCallback(new ArchModCallbackImpl());
          archMod.render();
          break;

        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(element);
          break;
      }
    } );
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

  public raise(raised: ArchMod) {
    this.removeArchMod(raised);
    this.allArchMods.push(raised);
  }

  public lower(lowered: ArchMod) {
    this.removeArchMod(lowered);
    this.allArchMods.unshift(lowered);
  }

  public deleteSelected() {
    if (this.selectedArchMod != null) {
      this.selectedArchMod.delete();
    }
    this.brushedArchMods.forEach( (archMod: ArchMod) => {
      archMod.delete();
    } );
    this.resetAllState();
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

  onRaised(raised: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onLowered()`);
    CONTEXT.lower(lowered);
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

      case "Delete":
        CONTEXT.deleteSelected();
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

(window as any).onSaveJsonClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onSaveJsonClicked()");

  let currentSerialized: string = CONTEXT.serializeToJson();

  if (TraceLog.IS_DEBUG) {
    TraceLog.d(TAG, "#### TOTAL JSON OBJ");
    let jsonObj = JSON.parse(currentSerialized);
    console.log(jsonObj);
  }

  let filename = `ArchMap_${Util.genTimestamp()}.json`;

  Downloader.downloadJson(currentSerialized, filename);
}

(window as any).onLoadJsonClicked = (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onLoadJsonClicked()");

  let target = event.target as HTMLInputElement;
  let file: File = (target.files as FileList)[0];
  let reader = new FileReader();
  reader.onload = (event: Event) => {
    let reader = event.target as FileReader;
    let jsonStr: string = reader.result as string;

    if (TraceLog.IS_DEBUG) {
      TraceLog.d(TAG, "Imported JSON loaded.");
      let jsonObj: object = JSON.parse(jsonStr);
      console.log(jsonObj);
    }

    CONTEXT.deserializeFromJson(jsonStr);
  };
  reader.readAsText(file);
}

