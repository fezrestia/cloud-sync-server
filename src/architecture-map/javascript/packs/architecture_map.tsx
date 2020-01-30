import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ArchModItxMode } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { ArchModJson } from "../d3/ArchMod";
import { DividerLine } from "../d3/DividerLine";
import { DividerLineItxMode } from "../d3/DividerLine";
import { DividerLineCallback } from "../d3/DividerLine";
import { DividerLineJson } from "../d3/DividerLine";
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

const GLOBAL_MODE_LABEL_ID = "global_mode_label";
const GLOBAL_MODE_ITX = "ITX";
const GLOBAL_MODE_GOD = "GOD";
const GOD_MODE_UI_ID = "god_mode_ui";

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

  // Clip board for copy and paste.
  private readonly clipboard: ElementJson[] = [];

  // Total elements. Head->Tail = Z-Low->Z-High = SVG/HTML Order Top->Bottom.
  private readonly allArchMods: ArchMod[] = [];

  // UNDO history.
  private readonly history: ArchitectureMapJson[] = [];
  private historyUndoCount: number = 0;

  // State flags.
  public isAddNewArchModMode: boolean = false;
  public isAddNewDividerLineMode: boolean = false;
  public globalMode: string = GLOBAL_MODE_GOD;

  // Selected list.
  private readonly selectedArchMods: ArchMod[] = [];

  public onSelected(selected: ArchMod, isMulti: boolean) {
    this.selectedArchMods.push(selected);
    if (!isMulti) {
      this.resetAllStateExceptFor(selected);
    }
  }

  public onMultiSelected(selected: ArchMod) {
    this.selectedArchMods.push(selected);
  }

  public onDeselected(deselected: ArchMod) {
    let index = this.selectedArchMods.indexOf(deselected);
    if (0 <= index) {
      this.selectedArchMods.splice(index, 1);
    }
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
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `deserializeFromjson()`);

    let ver: string = serialized[Def.KEY_VERSION];
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `## ver = ${ver}`);

    let outSize = serialized[Def.KEY_OUT_FRAME];
    this.outFrame.setXYWH(outSize.x, outSize.y, outSize.width, outSize.height);
    this.changeOutFrameSize(outSize.width, outSize.height);
    this.outFrame.relayout();

    let elements: ElementJson[] = serialized[Def.KEY_ARCHITECTURE_MAP];
    elements.forEach( (element: ElementJson) => {
      switch (element[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          let json = element as ArchModJson;

          let archMod = this.deserializeArchMod(json);

          // Load as selected state.
          archMod.selectMultiNoCallback();
          this.onMultiSelected(archMod);
          break;

        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(element);
          break;
      }
    } );
  }

  private deserializeArchMod(json: ArchModJson): ArchMod {
    let archMod = ArchMod.deserialize(this.html, this.svg, json);
    this.renderArchMod(archMod);
    return archMod;
  }

  public addNewArchMod(label: string, x: number, y: number, width: number, height: number) {
    let archMod = new ArchMod(this.html, this.svg, label);
    archMod.setXYWH(x, y, DEFAULT_SIZE, DEFAULT_SIZE);
    this.renderArchMod(archMod);
  }

  private renderArchMod(archMod: ArchMod) {
    archMod.setCallback(new ArchModCallbackImpl());

    switch (this.globalMode) {
      case GLOBAL_MODE_GOD:
        archMod.itxMode = ArchModItxMode.EDITABLE;
        break;
      case GLOBAL_MODE_ITX:
        archMod.itxMode = ArchModItxMode.SELECTABLE;
        break;
    }

    archMod.render();
    this.addArchMod(archMod);
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
  public updateBrushSelected(selected: number[][]) {
    let minX = selected[0][0];
    let minY = selected[0][1];
    let maxX = selected[1][0];
    let maxY = selected[1][1];

    this.allArchMods.forEach( (archMod: ArchMod) => {
      let {x, y, width, height} = archMod.getXYWH();

      if (minX < x && minY < y && x + width < maxX && y + height < maxY) {
        if (!this.selectedArchMods.includes(archMod)) {
          archMod.selectMultiNoCallback();
          this.onMultiSelected(archMod);
        }
      } else {
        if (this.selectedArchMods.includes(archMod)) {
          archMod.deselectNoCallback();
          this.onDeselected(archMod);
        }
      }

    } );
  }

  public moveSelectedArchMods(plusX: number, plusY: number, except: ArchMod) {
    this.selectedArchMods.forEach( (archMod: ArchMod) => {
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
      this.onDeselected(archMod);
    } );

    this.outFrame.resetState();
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
    this.selectedArchMods.forEach( (selected: ArchMod) => {
      selected.delete();
      this.removeArchMod(selected);
    } );
    this.selectedArchMods.length = 0;

    this.resetAllState();
  }

  public deleteAll() {
    this.allArchMods.forEach ( (archMod: ArchMod) => {
      archMod.delete();
    } );
    this.allArchMods.length = 0;
    this.selectedArchMods.length = 0;
  }

  public copyToClipBoard() {
    if (this.clipboard.length != 0) this.clipboard.length = 0; // Clear all.

    this.selectedArchMods.forEach( (selected: ArchMod) => {
      this.clipboard.push(selected.serialize());
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
          json[Def.KEY_DIMENS][Def.KEY_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_Y] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_Y] += COPY_PASTE_SLIDE_DIFF;

          let archMod = this.deserializeArchMod(json);

          // Paste as selected state.
          archMod.selectMultiNoCallback();
          this.onMultiSelected(archMod);
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
    this.deleteAll();
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

  public changeToGodMode() {
    this.globalMode = GLOBAL_MODE_GOD;

    this.resetAllState();
    this.allArchMods.forEach( (archMod: ArchMod) => {
      archMod.itxMode = ArchModItxMode.EDITABLE;
    } );
  }

  public changeToItxMode() {
    this.globalMode = GLOBAL_MODE_ITX;

    this.resetAllState();
    this.allArchMods.forEach( (archMod: ArchMod) => {
      archMod.itxMode = ArchModItxMode.SELECTABLE;
    } );
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
  onSelected(selected: ArchMod, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSelected() : ${selected.label}, isMulti=${isMulti}`);
    CONTEXT.onSelected(selected, isMulti);
  }

  onDeselected(deselected: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDeselected() : ${deselected.label}`);
    CONTEXT.onDeselected(deselected);
  }

  onEditing(editing: ArchMod, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEditing() : ${editing.label}, isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEdited() : ${edited.label}`);
    CONTEXT.onDeselected(edited);
    CONTEXT.recordHistory();
  }

  onDragStart(moved: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragStart()`);
    // NOP.
  }

  onDrag(moved: ArchMod, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedArchMods(plusX, plusY, moved);
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

// Entry point from HTML.
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

  // Default global mode.
  changeGlobalModeTo(GLOBAL_MODE_GOD);
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

          CONTEXT.updateBrushSelected(brushArea);
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

    if (CONTEXT.globalMode == GLOBAL_MODE_GOD) {
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
          TraceLog.d(TAG, "#### DEBUG LOG ####");
          TraceLog.d(TAG, "CONTEXT =");
          console.log(CONTEXT);
          TraceLog.d(TAG, "###################");
          break;

        default:
          // Other key event should be ignored and should not call preventDefault().
          return;
      }

      event.preventDefault();
    }
  };

  window.onkeyup = (event: KeyboardEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `window.onkeyup() : key=${event.key}`);
    event.stopPropagation();

    if (CONTEXT.globalMode == GLOBAL_MODE_GOD) {
      switch (event.key) {
        case "Control":
          releaseBrushLayer();
          break;

        default:
          // Other key event should be ignored and should not call preventDefault().
          return;
      }

      event.preventDefault();
    }
  };

  CONTEXT.svg.on("click", () => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
    CONTEXT.resetAllState();
    d3.event.stopPropagation();
    d3.event.preventDefault();
  } );

  CONTEXT.svg.on("contextmenu", () => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:contextmenu");
    // NOP.
    d3.event.stopPropagation();
    d3.event.preventDefault();
  } );

  CONTEXT.html.on("contextmenu", (event: JQuery.Event) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:contextmenu");
    // NOP.
    event.stopPropagation();
    event.preventDefault();
  } );
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

      CONTEXT.addNewArchMod(
          ArchMod.TAG,
          posX,
          posY,
          DEFAULT_SIZE,
          DEFAULT_SIZE);

      CONTEXT.recordHistory();

      // Finish add mode.
      resetHtmlRoot();
      CONTEXT.isAddNewArchModMode = false;
    } );

    CONTEXT.isAddNewArchModMode = true;
  }
}

(window as any).onAddNewDividerLineClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddNewDividerLineClicked()");

  if (CONTEXT.isAddNewDividerLineMode) {
    // Finish add mode.

    resetHtmlRoot();
    CONTEXT.isAddNewDividerLineMode = false;

  } else {
    // Prepare add mode.

    CONTEXT. resetAllState();

    CONTEXT.html.css("display", "block");
    CONTEXT.html.css("background-color", "#AAAAAAAA");

    CONTEXT.html.on("click", (e: JQuery.Event) => {
      let posX: number = e.offsetX || 0;
      let posY: number = e.offsetY || 0;



      let line = new DividerLine(CONTEXT.html, CONTEXT.svg)
      line.setFromPoint(100, 100);
      line.setToPoint(200, 300);
      line.itxMode = DividerLineItxMode.EDITABLE;
      line.render();



      CONTEXT.recordHistory();

      // Finish add mode.
      resetHtmlRoot();
      CONTEXT.isAddNewDividerLineMode = false;
    } );

    CONTEXT.isAddNewDividerLineMode = true;
  }
}

function resetHtmlRoot() {
  CONTEXT.html.css("display", "none");
  CONTEXT.html.css("background-color", "");
  CONTEXT.html.off("click");
}

function getExportFileNameBase(): string {
  return `ArchMap_${Util.genTimestamp()}`
}

(window as any).onSaveJsonClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onSaveJsonClicked()");

  let serialized: ArchitectureMapJson = CONTEXT.serializeToJson();

  if (TraceLog.IS_DEBUG) {
    TraceLog.d(TAG, "#### TOTAL JSON OBJ");
    console.log(serialized);
  }

  let jsonStr = JSON.stringify(serialized, null, 2);
  let filename = getExportFileNameBase();
  Downloader.downloadJson(jsonStr, filename);
};

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
};

(window as any).onSaveSvgClicked = (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onSaveSvgClicked()");

  CONTEXT.resetAllState();

  Downloader.downloadSvgAsSvg(
      CONTEXT.svg,
      getExportFileNameBase());
};

(window as any).onSavePngClicked = (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onSavePngClicked()");

  CONTEXT.resetAllState();

  let outSize = CONTEXT.outFrame.getXYWH();

  Downloader.downloadSvgAsPng(
      CONTEXT.svg,
      outSize.width,
      outSize.height,
      getExportFileNameBase());
};

function changeGlobalModeTo(mode: string) {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `changeGlobalModeTo() : mode=$mode`);

  let elm = document.getElementById(GLOBAL_MODE_LABEL_ID) as HTMLElement;
  elm.textContent = mode;

  let godModePanel = document.getElementById(GOD_MODE_UI_ID) as HTMLElement;

  switch (mode) {
    case GLOBAL_MODE_GOD:
      CONTEXT.changeToGodMode();
      godModePanel.style.display = "";
      break;

    case GLOBAL_MODE_ITX:
      CONTEXT.changeToItxMode();
      godModePanel.style.display = "none";
      break;
  }
}

(window as any).onGodModeClicked = (event: Event) => {
  changeGlobalModeTo(GLOBAL_MODE_GOD);
};

(window as any).onItxModeClicked = (event: Event) => {
  changeGlobalModeTo(GLOBAL_MODE_ITX);
};

