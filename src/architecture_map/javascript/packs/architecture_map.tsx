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
const COPY_PASTE_SLIDE_DIFF = 30;
const MAX_UNDO_HISTORY_SIZE = 100;

interface ElementJson {
  [Def.KEY_CLASS]: string,
}

interface OutFrameJson {
  [Def.KEY_X]: number,
  [Def.KEY_Y]: number,
  [Def.KEY_WIDTH]: number,
  [Def.KEY_HEIGHT]: number,
}

interface ArchitectureMapJson {
  [Def.KEY_VERSION]: string,
  [Def.KEY_OUT_FRAME]: OutFrameJson,
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
  private readonly clipboard: ElementJson[] = [];

  // Total elements. Head->Tail = Z-Low->Z-High = SVG/HTML Order Top->Bottom.
  private readonly allArchMods: ArchMod[] = [];

  // UNDO history.
  private readonly history: ArchitectureMapJson[] = [];
  private historyUndoCount: number = 0;

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
   * Serialize current static context to JSON object.
   * @return ArchitectureMapJson object.
   */
  public serializeToJson(): ArchitectureMapJson {
    let serializedElements: ElementJson[] = [];
    this.allArchMods.forEach( (archMod: ArchMod) => {
      let serialized = archMod.serialize();
      serializedElements.push(serialized);
    } );

    let outSize = this.outFrame.getXYWH();
    let outFrameJson = {
      [Def.KEY_X]: outSize.x,
      [Def.KEY_Y]: outSize.y,
      [Def.KEY_WIDTH]: outSize.width,
      [Def.KEY_HEIGHT]: outSize.height,
    };

    let totalJson: ArchitectureMapJson = {
      [Def.KEY_VERSION]: Def.VAL_VERSION,
      [Def.KEY_OUT_FRAME]: outFrameJson,
      [Def.KEY_ARCHITECTURE_MAP]: serializedElements,
    };

    return totalJson;
  }

  /**
   * Deserialize static context from JSON object.
   * @param serialized ArchitectureMapJson object.
   */
  public deserializeFromJson(serialized: ArchitectureMapJson) {
    TraceLog.d(TAG, `deserializeFromjson()`);

    let ver: string = serialized[Def.KEY_VERSION];
    TraceLog.d(TAG, `## ver = ${ver}`);

    let outSize = serialized[Def.KEY_OUT_FRAME];
    this.outFrame.setXYWH(outSize.x, outSize.y, outSize.width, outSize.height);
    this.changeOutFrameSize(outSize.width, outSize.height);
    this.outFrame.relayout();

    let elements: ElementJson[] = serialized[Def.KEY_ARCHITECTURE_MAP];
    elements.forEach( (element: ElementJson) => {
      switch (element[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          let json = element as ArchModJson;
          json[Def.KEY_LABEL] = this.genUniqLabelIdFrom(json[Def.KEY_LABEL]);

          let archMod = ArchMod.deserialize(CONTEXT.html, CONTEXT.svg, json);
          archMod.setCallback(new ArchModCallbackImpl());
          archMod.render();

          // Load as brushed state.
          archMod.isMovable = true;
          this.brushedArchMods.push(archMod);
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
    // Delete selected.
    if (this.selectedArchMod != null) {
      this.selectedArchMod.delete();
    }
    // Delete brushed.
    this.brushedArchMods.forEach( (archMod: ArchMod) => {
      archMod.delete();
    } );

    this.resetAllState();
  }

  /**
   * Generate new unique Label ID based on baseLabel.
   * @param baseLabel
   * @return
   */
  public genUniqLabelIdFrom(baseLabel: string): string {
    let index: number = 0;
    let newLabel = baseLabel;

    // Detect current copy index.
    let pattern: RegExp = /\_(\d+)$/;
    let matched: string[]|null = baseLabel.match(pattern);
    if (matched != null) {
      // This baseLabel has xxx_100 like copy index.
      index = Number(matched[1]);
      baseLabel = baseLabel.replace(matched[0], "");
    }

    while (true) {
      let isPresent = this.allArchMods.some( (archMod: ArchMod) => {
        return archMod.label == newLabel;
      } );

      if (!isPresent) break;

      index++;
      newLabel = `${baseLabel}_${index}`;
    }

    return newLabel;
  }

  public copyToClipBoard() {
    if (this.clipboard.length != 0) this.clipboard.length = 0; // Clear all.

    if (this.selectedArchMod != null) {
      this.clipboard.push(this.selectedArchMod.serialize());
    }
    this.brushedArchMods.forEach( (archMod: ArchMod) => {
      this.clipboard.push(archMod.serialize());
    } );

    this.resetAllState();
  }

  public pasteFromClipBoard() {
    if (this.clipboard.length == 0) return;

    this.resetAllState();

    this.clipboard.forEach( (serialized: ElementJson) => {
      switch (serialized[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          let json = serialized as ArchModJson;

          // Update label for copied one.
          json[Def.KEY_LABEL] = this.genUniqLabelIdFrom(json[Def.KEY_LABEL]);
          json[Def.KEY_DIMENS][Def.KEY_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_Y] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_Y] += COPY_PASTE_SLIDE_DIFF;

          let archMod = ArchMod.deserialize(this.html, this.svg, json);
          archMod.setCallback(new ArchModCallbackImpl());
          archMod.render();

          // Paste as brushed state.
          archMod.isMovable = true;
          this.brushedArchMods.push(archMod);
          break;

        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(serialized);
          break;
      }
    } );

    this.clipboard.length = 0; // Clear all.
  }

  public isLabelPresent(newLabel: string): boolean {
    return this.allArchMods.some( (archMod: ArchMod) => {
      return archMod.label == newLabel;
    } );
  }

  public recordHistory() {
    // Remove old history branch.
    if (this.historyUndoCount != 0) {
      this.history.splice(-1 * this.historyUndoCount);
    }

    let curJson: ArchitectureMapJson = this.serializeToJson();

    let curSize = this.history.length;
    if (curSize > 0) {
      let last = this.history[curSize - 1];
      let lastStr = JSON.stringify(last);
      let curStr = JSON.stringify(curJson);
      if (lastStr == curStr) {
        // Same as last state.
        return;
      }
    }

    this.history.push(curJson);
    this.historyUndoCount = 0;

    if (this.history.length > MAX_UNDO_HISTORY_SIZE) {
      this.history.shift();
    }
  }

  private recoverJson(json: ArchitectureMapJson) {
    let deletes = this.allArchMods.concat();
    deletes.forEach( (archMod: ArchMod) => { archMod.delete() } );
    this.deserializeFromJson(json);
    this.resetAllState();
  }

  public undo() {
    if (this.history.length < 2) return;
    this.resetAllState();

    this.historyUndoCount++;

    let historyJson = this.history[this.history.length - 1 - this.historyUndoCount];

    if (historyJson == null) {
      // No history.
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo() : NO History`);
      this.historyUndoCount--;
      return;
    }

    this.recoverJson(historyJson);
  }

  public redo() {
    if (this.history.length < 2) return;
    this.resetAllState();

    this.historyUndoCount--;

    let futureJson = this.history[this.history.length - 1 - this.historyUndoCount];

    if (futureJson == null) {
      // No future.
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo() : NO Future`);
      this.historyUndoCount++;
      return;
    }

    this.recoverJson(futureJson);
  }

}
const CONTEXT = new Context();

// OutFrame callback implementation.
class OutFrameCallbackImpl implements OutFrameCallback {
  onSizeChangeStart() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChangeStart()`);
    // NOP.
  }

  onSizeChange(width: number, height: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChange() : width=${width}, height=${height}`);
    CONTEXT.changeOutFrameSize(width, height);
  }

  onSizeChangeEnd() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChangeEnd()`);
    CONTEXT.recordHistory();
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
    CONTEXT.recordHistory();
  }

  onDragStart(moved: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragStart()`);
    // NOP.
  }

  onDrag(moved: ArchMod, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveBrushedArchMod(plusX, plusY, moved);
  }

  onDragEnd(moved: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragEnd()`);
    CONTEXT.recordHistory();
  }

  onRaised(raised: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onRaised()`);
    CONTEXT.raise(raised);
    CONTEXT.recordHistory();
  }

  onLowered(lowered: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onLowered()`);
    CONTEXT.lower(lowered);
    CONTEXT.recordHistory();
  }

  canChangeLabel(archMod: ArchMod, newLabel: string): boolean {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.canChangeLabel() : newLabel=${newLabel}`);
    return !CONTEXT.isLabelPresent(newLabel);
  }

  onLabelChanged(archMod: ArchMod, oldLabel: string, newLabel: string) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onLabelChanged() : old=${oldLabel}, new=${newLabel}`);
    CONTEXT.recordHistory();
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

        CONTEXT.resetAllState();

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

        d3.event.target.on("start", null);
        d3.event.target.on("brush", null);
        d3.event.target.on("end", null);

        // Immediately cancel selection.
        // After cleared, brush callback is called again with null selection.
        // So, unregister callbacks above here to avoid infinite loop.
        brushLayer.call(d3.event.target.clear);

        // After unregister callbacks, brush behavior is back to default.
        // So, release brush layer here before ctrl key is released.
        releaseBrushLayer();

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
    event.preventDefault();

    switch (event.key) {
      case "Control":
        prepareBrushLayer();
        break;

      case "Delete":
        CONTEXT.deleteSelected();
        CONTEXT.recordHistory();
        break;

      case "c":
        if (event.ctrlKey) {
          CONTEXT.copyToClipBoard();
        }
        break;

      case "v":
        if (event.ctrlKey) {
          CONTEXT.pasteFromClipBoard();
          CONTEXT.recordHistory();
        }
        break;

      case "z":
        if (event.ctrlKey) {
          CONTEXT.undo();
        }
        break;

      case "y":
        if (event.ctrlKey) {
          CONTEXT.redo();
        }
        break;

      case "s":
        if (event.ctrlKey) {
          (window as any).onSaveJsonClicked();
        }
        break;

      // DEBUG LOG.
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
    event.preventDefault();

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

      addNewArchMod(CONTEXT.genUniqLabelIdFrom(ArchMod.TAG), posX, posY, DEFAULT_SIZE, DEFAULT_SIZE);

      CONTEXT.recordHistory();

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

  let serialized: ArchitectureMapJson = CONTEXT.serializeToJson();

  if (TraceLog.IS_DEBUG) {
    TraceLog.d(TAG, "#### TOTAL JSON OBJ");
    console.log(serialized);
  }

  let jsonStr = JSON.stringify(serialized, null, 2);
  let filename = `ArchMap_${Util.genTimestamp()}.json`;
  Downloader.downloadJson(jsonStr, filename);
}

(window as any).onLoadJsonClicked = (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onLoadJsonClicked()");

  let target = event.target as HTMLInputElement;
  let file: File = (target.files as FileList)[0];
  let reader = new FileReader();
  reader.onload = (event: Event) => {
    let reader = event.target as FileReader;
    let jsonStr: string = reader.result as string;

    let serialized: ArchitectureMapJson = JSON.parse(jsonStr);

    if (TraceLog.IS_DEBUG) {
      TraceLog.d(TAG, "Imported JSON loaded.");
      console.log(serialized);
    }

    CONTEXT.deserializeFromJson(serialized);

    CONTEXT.recordHistory();
  };

  reader.readAsText(file);

  target.value = ""; // Clear to trigger next input callback with same path.
}

