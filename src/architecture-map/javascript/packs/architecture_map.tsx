import * as d3 from "d3";
import * as $ from "jquery";

import { Element } from "../d3/Element";
import { ElementItxMode } from "../d3/Element";
import { ElementJson } from "../d3/Element";
import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { ArchModJson } from "../d3/ArchMod";
import { DividerLine } from "../d3/DividerLine";
import { DividerLineCallback } from "../d3/DividerLine";
import { DividerLineJson } from "../d3/DividerLine";
import { Connector } from "../d3/Connector";
import { ConnectorCallback } from "../d3/Connector";
import { ConnectorJson } from "../d3/Connector";
import { OutFrame } from "../d3/OutFrame";
import { OutFrameCallback } from "../d3/OutFrame";
import { OutFrameJson } from "../d3/OutFrame";
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

interface ArchitectureMapJson {
  [Def.KEY_VERSION]: string,
  [Def.KEY_OUT_FRAME]: OutFrameJson,
  [Def.KEY_ARCHITECTURE_MAP]: ElementJson[],
}

// Current interaction context.
class Context {

  public elementUids: number[] = [0]; // 0 is OutFrame UID.

  public genNewElementUid(): number {
    let max: number = Math.max.apply(null, this.elementUids);
    let newUid = max + 1;
    return newUid;
  }

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
  private readonly allElements: Element[] = [];

  // UNDO history.
  private readonly history: ArchitectureMapJson[] = [];
  private historyUndoCount: number = 0;

  // State flags.
  public isAddNewArchModMode: boolean = false;
  public isAddNewDividerLineMode: boolean = false;
  public isAddNewConnectorMode: boolean = false;
  public globalMode: string = GLOBAL_MODE_GOD;

  // Connector related.
  public connectorBaseArchMod: ArchMod|null = null;

  // Selected list.
  private readonly selectedElements: Element[] = [];

  public onSelected(selected: Element, isMulti: boolean) {
    this.selectedElements.push(selected);
    if (!isMulti) {
      this.resetAllStateExceptFor(selected);
    }
  }

  public onMultiSelected(selected: Element) {
    this.selectedElements.push(selected);
  }

  public onDeselected(deselected: Element) {
    let index = this.selectedElements.indexOf(deselected);
    if (0 <= index) {
      this.selectedElements.splice(index, 1);
    }
  }

  /**
   * Serialize current static context to JSON object.
   * @return ArchitectureMapJson object.
   */
  public serializeToJson(): ArchitectureMapJson {
    let serializedElements: ElementJson[] = [];
    this.allElements.forEach( (element: Element) => {
      let serialized = element.serialize();
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
      let deserialized: Element;
      let json;

      switch (element[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          json = element as ArchModJson;
          deserialized = this.deserializeArchMod(json);
          break;

        case DividerLine.TAG:
          json = element as DividerLineJson;
          deserialized = this.deserializeDividerLine(json);
          break;

        case Connector.TAG:
          json = element as ConnectorJson;
          deserialized = this.deserializeConnector(json);
          break;

        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(element);
          return;
      }

      // Load as selected state.
      deserialized.select();
      this.onMultiSelected(deserialized);

    } );
  }

  private validateElementUid(element: Element) {
    let uid = element.uid;

    if (!uid) {
      // NG. UID is not set. May be ArchitectureMapJson version is old.
      uid = this.genNewElementUid();
      (element as any).uid = uid;
      return;
    }

    if (this.elementUids.includes(uid)) {
      // NG. UID is not unique.
      console.log(`#### ERROR: Element UID = ${uid} is not Unique.`);
      alert(`Element UID is NOT Unique.\nLabel = ${element.label}\nUID = ${uid}`);
      return;
    }

    // OK.
  }

  private deserializeArchMod(json: ArchModJson): ArchMod {
    let archMod = ArchMod.deserialize(this.html, this.svg, json);
    this.validateElementUid(archMod);
    this.renderArchMod(archMod);
    return archMod;
  }

  public addNewArchMod(label: string, x: number, y: number, width: number, height: number) {
    let uid = this.genNewElementUid();
    let archMod = new ArchMod(uid, this.html, this.svg, label);
    archMod.setXYWH(x, y, DEFAULT_SIZE, DEFAULT_SIZE);
    this.renderArchMod(archMod);
  }

  private renderArchMod(archMod: ArchMod) {
    archMod.setCallback(new ArchModCallbackImpl());

    switch (this.globalMode) {
      case GLOBAL_MODE_GOD:
        archMod.itxMode = ElementItxMode.EDITABLE;
        break;
      case GLOBAL_MODE_ITX:
        archMod.itxMode = ElementItxMode.SELECTABLE;
        break;
    }

    archMod.render();
    this.addElementToTop(archMod);
  }

  private deserializeDividerLine(json: DividerLineJson): DividerLine {
    let line = DividerLine.deserialize(this.html, this.svg, json);
    this.validateElementUid(line);
    this.renderDividerLine(line);
    return line;
  }

  public addNewDividerLine(fromX: number, fromY: number) {
    let uid = this.genNewElementUid();
    let line = new DividerLine(uid, this.html, this.svg);
    line.setFromToXY(fromX, fromY, fromX + DEFAULT_SIZE, fromY + DEFAULT_SIZE);
    this.renderDividerLine(line);
  }

  private renderDividerLine(line: DividerLine) {
    line.setCallback(new DividerLineCallbackImpl());

    switch (this.globalMode) {
      case GLOBAL_MODE_GOD:
        line.itxMode = ElementItxMode.EDITABLE;
        break;
      case GLOBAL_MODE_ITX:
        line.itxMode = ElementItxMode.RIGID;
        break;
    }

    line.render();
    this.addElementToTop(line);
  }

  private deserializeConnector(json: ConnectorJson): Connector {
    let connector = Connector.deserialize(this.html, this.svg, json);
    this.validateElementUid(connector);
    this.renderConnector(connector);
    return connector;
  }

  public addNewConnector(fromArchMod: ArchMod, toArchMod: ArchMod) {
    let uid = this.genNewElementUid();
    let connector = new Connector(uid, this.html, this.svg);
    connector.setFromToArchMod(fromArchMod, toArchMod);
    this.renderConnector(connector);
  }

  private renderConnector(connector: Connector) {
    connector.setCallback(new ConnectorCallbackImpl());

    switch (this.globalMode) {
      case GLOBAL_MODE_GOD:
        connector.itxMode = ElementItxMode.EDITABLE;
        break;
      case GLOBAL_MODE_ITX:
        connector.itxMode = ElementItxMode.RIGID;
        break;
    }

    connector.render();
    this.addElementToTop(connector);
  }

  public addElementToTop(element: Element) {
    this.allElements.push(element);
    this.elementUids.push(element.uid);
  }

  public addElementToBottom(element: Element) {
    this.allElements.unshift(element);
    this.elementUids.unshift(element.uid);
  }

  public removeElement(element: Element) {
    let index = this.allElements.indexOf(element);
    if (index < 0) {
      TraceLog.e(TAG, `## Element=${element.serialize()} is NOT existing.`);
      return;
    }
    this.allElements.splice(index, 1);

    let uidIndex = this.elementUids.indexOf(element.uid);
    if (index < 0) {
      TraceLog.e(TAG, `## Element UID of ${element.serialize()} is NOT existing.`);
      return;
    }
    this.elementUids.splice(uidIndex, 1);
  }

  // @param selection area 4-edge.
  public updateBrushSelected(selected: number[][]) {
    let minX = selected[0][0];
    let minY = selected[0][1];
    let maxX = selected[1][0];
    let maxY = selected[1][1];

    this.allElements.forEach( (element: Element) => {
      switch (element.TAG) {
        case ArchMod.TAG: {
          let archMod = element as ArchMod;

          let {x, y, width, height} = archMod.getXYWH();

          if (minX < x && minY < y && x + width < maxX && y + height < maxY) {
            if (!this.selectedElements.includes(archMod)) {
              archMod.select();
              this.onMultiSelected(archMod);
            }
          } else {
            if (this.selectedElements.includes(archMod)) {
              archMod.deselect();
              this.onDeselected(archMod);
            }
          }
        }
        break;

        case DividerLine.TAG: {
          let line = element as DividerLine;

          let {fromX, fromY, toX, toY} = line.getFromToXY();

          if (minX < fromX && fromX < maxX && minY < fromY && fromY < maxY
              && minX < toX && toX < maxX && minY < toY && toY < maxY) {
            if (!this.selectedElements.includes(line)) {
              line.select();
              this.onMultiSelected(line);
            }
          } else {
            if (this.selectedElements.includes(line)) {
              line.deselect();
              this.onDeselected(line);
            }
          }
        }
        break;

        case Connector.TAG:
          // NOP.
          break;

        default:
          TraceLog.e(TAG, `## Element=${element.serialize()} is NOT existing.`);
          break;
      }
    } );
  }

  public moveSelectedElements(plusX: number, plusY: number, except: Element) {
    this.selectedElements.forEach( (element: Element) => {
      if (element.TAG == Connector.TAG) return;

      if (element != except) {
        element.move(plusX, plusY);
      }

      if (element.TAG == ArchMod.TAG) {
        let archMod = element as ArchMod;
        this.updateConnectorsRelatedTo(archMod);
      }

    } );
  }

  public updateConnectorsRelatedTo(archMod: ArchMod) {
    this.allElements.forEach( (element: Element) => {
      if (element.TAG == Connector.TAG) {
        let connector = element as Connector;
        if (connector.isConnected(archMod.uid)) {
          connector.updateConnectionPoints();
        }
      }
    } );
  }

  /**
   * Reset selected/editing or something state to default without exception.
   *
   * @param except Exception of reset target. If null, ALL state will be reset.
   */
  public resetAllStateExceptFor(except: Element|null) {
    this.allElements.forEach( (element: Element) => {
      if (except == element) return;
      element.resetState();
      this.onDeselected(element);
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

  public raise(raised: Element) {
    this.removeElement(raised);
    this.addElementToTop(raised);
  }

  public lower(lowered: Element) {
    this.removeElement(lowered);
    this.addElementToBottom(lowered);
  }

  public deleteSelected() {
    this.selectedElements.forEach( (selected: Element) => {
      selected.delete();
      this.removeElement(selected);

      if (selected.TAG == ArchMod.TAG) {
        this.allElements.forEach( (element) => {
          if (element.TAG == Connector.TAG) {
            let connector = element as Connector;
            if (connector.isConnected(selected.uid)) {
              connector.delete();
              this.removeElement(connector);
            }
          }
        } );
      }

    } );
    this.selectedElements.length = 0;

    this.resetAllState();
  }

  public deleteAll() {
    this.allElements.forEach ( (element: Element) => {
      element.delete();
    } );
    this.allElements.length = 0;
    this.selectedElements.length = 0;
    this.elementUids = [0];
  }

  public copyToClipBoard() {
    if (this.clipboard.length != 0) this.clipboard.length = 0; // Clear all.

    this.selectedElements.forEach( (selected: Element) => {

      // TODO: Consider to copy/paste Connector.
      if (selected.TAG == Connector.TAG) return;

      this.clipboard.push(selected.serialize());
    } );

    this.resetAllState();
  }

  public pasteFromClipBoard() {
    if (this.clipboard.length == 0) return;

    this.resetAllState();

    this.clipboard.forEach( (serialized: ElementJson) => {
      serialized[Def.KEY_UID] = this.genNewElementUid();

      let element: Element;
      let json;

      switch (serialized[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          json = serialized as ArchModJson;

          json[Def.KEY_DIMENS][Def.KEY_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_Y] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_PIN_Y] += COPY_PASTE_SLIDE_DIFF;

          element = this.deserializeArchMod(json);
          break;

        case DividerLine.TAG:
          json = serialized as DividerLineJson;

          json[Def.KEY_DIMENS][Def.KEY_FROM_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_FROM_Y] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_TO_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_TO_Y] += COPY_PASTE_SLIDE_DIFF;

          element = this.deserializeDividerLine(json);
          break;


        // TODO: Consider Connector copy/paste.


        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(serialized);
          return;
      }

      // Paste as selected state.
      element.select();
      this.onMultiSelected(element);

    } );

    this.clipboard.length = 0; // Clear all.
  }

  public isLabelPresent(newLabel: string): boolean {
    return this.allElements.some( (element: Element) => {
      if (element.TAG == ArchMod.TAG) {
        let archMod = element as ArchMod;
        return archMod.label == newLabel;
      } else {
        return false;
      }
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
    this.allElements.forEach( (element: Element) => {
      switch (element.TAG) {
        case ArchMod.TAG:
          element.itxMode = ElementItxMode.EDITABLE;
          break;
        case DividerLine.TAG:
          element.itxMode = ElementItxMode.EDITABLE;
          break;
        case Connector.TAG:
          element.itxMode = ElementItxMode.EDITABLE;
          break;
      }
    } );
    this.outFrame.itxMode = ElementItxMode.EDITABLE;
  }

  public changeToItxMode() {
    this.globalMode = GLOBAL_MODE_ITX;

    this.resetAllState();
    this.allElements.forEach( (element: Element) => {
      switch (element.TAG) {
        case ArchMod.TAG:
          element.itxMode = ElementItxMode.SELECTABLE;
          break;
        case DividerLine.TAG:
          element.itxMode = ElementItxMode.RIGID;
          break;
        case Connector.TAG:
          element.itxMode = ElementItxMode.RIGID;
          break;
      }
    } );
    this.outFrame.itxMode = ElementItxMode.RIGID;
  }

  public queryElementUid(uid: number): Element {
    let hit = CONTEXT.allElements.find( (element: Element) => element.uid == uid );
    if (hit == undefined) throw new Error(`UID = ${uid} is NOT Hit.`);
    return hit;
  }
}
const CONTEXT = new Context();
(window as any).getContext = () => { return CONTEXT };

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

    if (CONTEXT.isAddNewConnectorMode) {
      if (CONTEXT.connectorBaseArchMod != null) {
        let fromArchMod = CONTEXT.connectorBaseArchMod;
        let toArchMod = selected;

        if (fromArchMod.uid == toArchMod.uid) {
          // NOP. Same one.
        } else {
          // Add new connector.
          CONTEXT.addNewConnector(fromArchMod, toArchMod);
          CONTEXT.recordHistory();
        }

        // Finish add mode.
        finishAddNewConnectorMode();
      } else {
        // Select base.
        CONTEXT.connectorBaseArchMod = selected;
      }
    }
  }

  onDeselected(deselected: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDeselected() : ${deselected.label}`);
    CONTEXT.onDeselected(deselected);

    if (CONTEXT.isAddNewConnectorMode) {
      // Finish add mode.
      finishAddNewConnectorMode();
    }
  }

  onEditing(editing: ArchMod, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEditing() : ${editing.label}, isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onEdited() : ${edited.label}`);
    CONTEXT.onDeselected(edited);
  }

  onDragStart(moved: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragStart()`);
    // NOP.
  }

  onDrag(moved: ArchMod, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedElements(plusX, plusY, moved);
  }

  onDragEnd(moved: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragEnd()`);
  }

  onRaised(raised: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onLowered()`);
    CONTEXT.lower(lowered);
  }

  canChangeLabel(archMod: ArchMod, newLabel: string): boolean {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.canChangeLabel() : newLabel=${newLabel}`);
    return !CONTEXT.isLabelPresent(newLabel);
  }

  onLabelChanged(archMod: ArchMod, oldLabel: string, newLabel: string) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onLabelChanged() : old=${oldLabel}, new=${newLabel}`);
  }

  onHistoricalChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onHistoricalChanged() : label=${archMod.label}`);
    CONTEXT.recordHistory();
  }

  onSizeChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSizeChanged() : label=${archMod.label}`);
    CONTEXT.updateConnectorsRelatedTo(archMod);
  }

  onClipAreaChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onClipAreaChanged() : label=${archMod.label}`);
    CONTEXT.updateConnectorsRelatedTo(archMod);
  }
}

// Common callback for ALL DividerLine instances.
class DividerLineCallbackImpl implements DividerLineCallback {
  onSelected(selected: DividerLine, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onSelected() : isMulti=${isMulti}`);
    CONTEXT.onSelected(selected, isMulti);
  }

  onDeselected(deselected: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onDeselected()`);
    CONTEXT.onDeselected(deselected);
  }

  onEditing(editing: DividerLine, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onEditing() : isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onEdited()`);
    CONTEXT.onDeselected(edited);
  }

  onDragStart(moved: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onDragStart()`);
    // NOP.
  }

  onDrag(moved: DividerLine, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedElements(plusX, plusY, moved);
  }

  onDragEnd(moved: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onDragEnd()`);
    // NOP.
  }

  onRaised(raised: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onLowered()`);
    CONTEXT.lower(lowered);
  }

  onHistoricalChanged(line: DividerLine) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `DividerLine.onHistoricalChanged()`);
    CONTEXT.recordHistory();
  }
}

// Common callback for ALL Connector instances.
class ConnectorCallbackImpl implements ConnectorCallback {
  onSelected(selected: Connector, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onSelected() : isMulti=${isMulti}`);
    CONTEXT.onSelected(selected, isMulti);
  }

  onDeselected(deselected: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onDeselected()`);
    CONTEXT.onDeselected(deselected);
  }

  onEditing(editing: Connector, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onEditing() : isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onEdited()`);
    CONTEXT.onDeselected(edited);
  }

  onDragStart(moved: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onDragStart()`);
    // NOP.
  }

  onDrag(moved: Connector, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedElements(plusX, plusY, moved);
  }

  onDragEnd(moved: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onDragEnd()`);
    // NOP.
  }

  onRaised(raised: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onLowered()`);
    CONTEXT.lower(lowered);
  }

  onHistoricalChanged(connector: Connector) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Connector.onHistoricalChanged()`);
    CONTEXT.recordHistory();
  }

  queryArchMod(uid: number): ArchMod {
    return CONTEXT.queryElementUid(uid) as ArchMod;
  }
}

// Entry point from HTML.
(window as any).onArchitectureMapLoaded = (
    defaultGlobalMode: string = GLOBAL_MODE_GOD,
    defaultLoadJson: string|null = null) => {
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

  let outFrame = new OutFrame(html, svg);
  outFrame.setCallback(new OutFrameCallbackImpl());
  outFrame.setXYWH(0, 0, DEFAULT_TOTAL_WIDTH, DEFAULT_TOTAL_HEIGHT);
  outFrame.render();
  CONTEXT.outFrame = outFrame;

  registerGlobalCallbacks();

  // Default global mode.
  changeGlobalModeTo(defaultGlobalMode);

  // Load JSON.
  if (defaultLoadJson != null) {
    let serialized: ArchitectureMapJson = JSON.parse(defaultLoadJson);
    CONTEXT.deserializeFromJson(serialized);
    CONTEXT.resetAllState();
  }
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

    let isHandledByGodMode = true;
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

        default:
          isHandledByGodMode = false;
          break;
      }
    }

    // for BOTH mode.
    let isHandledByBothMode = true;
    switch (event.key) {
      case "Esc":
        // fall-through.
      case "Escape":
        if (CONTEXT.isAddNewConnectorMode) {
          finishAddNewConnectorMode();
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
        isHandledByBothMode = false;
        break;
    }

    if (isHandledByGodMode || isHandledByBothMode) {
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
};

(window as any).onAddNewDividerLineClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddNewDividerLineClicked()");

  if (CONTEXT.isAddNewDividerLineMode) {
    // Finish add mode.

    resetHtmlRoot();
    CONTEXT.isAddNewDividerLineMode = false;

  } else {
    // Prepare add mode.

    CONTEXT.resetAllState();

    CONTEXT.html.css("display", "block");
    CONTEXT.html.css("background-color", "#AAAAAAAA");

    CONTEXT.html.on("click", (e: JQuery.Event) => {
      let posX: number = e.offsetX || 0;
      let posY: number = e.offsetY || 0;

      CONTEXT.addNewDividerLine(posX, posY);

      CONTEXT.recordHistory();

      // Finish add mode.
      resetHtmlRoot();
      CONTEXT.isAddNewDividerLineMode = false;
    } );

    CONTEXT.isAddNewDividerLineMode = true;
  }
};

(window as any).onAddNewConnectorClicked = () => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddNewConnectorClicked()");

  if (CONTEXT.isAddNewConnectorMode) {
    // Cancel add mode.
    finishAddNewConnectorMode();
  } else {
    // Prepare add mode.
    prepareAddNewConnectorMode();
  }
};

function prepareAddNewConnectorMode() {
  CONTEXT.resetAllState();

  CONTEXT.html.css("display", "block");
  CONTEXT.html.css("background-color", "#AAAAAAAA");
  CONTEXT.html.css("pointer-events", "none");

  CONTEXT.isAddNewConnectorMode = true;
  CONTEXT.connectorBaseArchMod = null;

  CONTEXT.changeToItxMode();

}

function finishAddNewConnectorMode() {
  resetHtmlRoot();

  CONTEXT.isAddNewConnectorMode = false;
  CONTEXT.connectorBaseArchMod = null;

  CONTEXT.changeToGodMode();

}

function resetHtmlRoot() {
  CONTEXT.html.css("display", "none");
  CONTEXT.html.css("background-color", "");
  CONTEXT.html.css("pointer-events", "auto");
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

(window as any).postJsonTo = (url: string) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "postJsonTo()");
  console.log(`## URL=${url}`);

  let button = event!.target as HTMLButtonElement;

  // Dim UI.
  button.disabled = true;

  let serialized: ArchitectureMapJson = CONTEXT.serializeToJson();
  let jsonStr = JSON.stringify(serialized, null, 2);

  let xhr = new XMLHttpRequest();
  xhr.onload = (e: Event) => {
    if (xhr.readyState === 4) { // DONE
      if (xhr.status === 200) { // HTTP:OK
        alert("OK");
      } else { // HTTP:NG
        alert(`${xhr.status} [${xhr.statusText}] ${xhr.responseText}`);
      }

      // Recover UI.
      button.disabled = false;
    }
  };

  xhr.open("POST", url);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(jsonStr);

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
      godModePanel.style.display = "block";
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

