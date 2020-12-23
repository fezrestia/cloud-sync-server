import * as d3 from "d3";
import * as $ from "jquery";

import { Element } from "../d3/Element";
import { ElementItxMode } from "../d3/Element";
import { ElementJson } from "../d3/Element";
import { ArchMod } from "../d3/ArchMod";
import { ArchModCallback } from "../d3/ArchMod";
import { ArchModJson } from "../d3/ArchMod";
import { TextLabel } from "../d3/TextLabel";
import { TextLabelCallback } from "../d3/TextLabel";
import { TextLabelJson } from "../d3/TextLabel";
import { Line } from "../d3/Line";
import { LineCallback } from "../d3/Line";
import { LineJson } from "../d3/Line";
import { Connector } from "../d3/Connector";
import { ConnectorCallback } from "../d3/Connector";
import { ConnectorJson } from "../d3/Connector";
import { OutFrame } from "../d3/OutFrame";
import { OutFrameCallback } from "../d3/OutFrame";
import { OutFrameJson } from "../d3/OutFrame";
import { TraceLog } from "../util/TraceLog";
import { ColorSet } from "../Def";
import { D3Node } from "../TypeDef";
import { JQueryNode } from "../TypeDef";
import { Def } from "../Def";
import { Util } from "../util/Util";
import { Downloader } from "../util/Downloader";
import { convertJsonToLatest } from "../JsonConverter";
import { openModuleHierarchyViewWindow } from "../itx/open_module_hierarchy_view";
import { downloadStaticHtml } from "../itx/download_static_html";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const ROOT_ID = "root";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";
const DEFAULT_SIZE = 120;
const DEFAULT_TOTAL_WIDTH = 640;
const DEFAULT_TOTAL_HEIGHT = 640;
const ROOT_DIV_RIGHT_BOTTOM_CLEARANCE = 200;
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

// @return Modified or not.
function resolveOverlappingArchMod(elements: Element[]): boolean {

  const overlapComparator = (a: Element, b: Element): number => {
    if (a.TAG === ArchMod.TAG && b.TAG === ArchMod.TAG) {
      const rectA: {x: number, y: number, width: number, height: number } = (a as ArchMod).getXYWH();
      const aL = rectA.x;
      const aT = rectA.y;
      const aR = rectA.x + rectA.width;
      const aB = rectA.y + rectA.height;

      const rectB: {x: number, y: number, width: number, height: number } = (b as ArchMod).getXYWH();
      const bL = rectB.x;
      const bT = rectB.y;
      const bR = rectB.x + rectB.width;
      const bB = rectB.y + rectB.height;

      if (aL < bL && bR < aR && aT < bT && bB < aB) {
        // a > b, sort A to B.
        return -1;
      } else if (bL < aL && aR < bR && bT < aT && aB < bB) {
        // b > a, sort B to A.
        return 1;
      } else {
        // Same size, not sort.
        return 0;
      }

    } else {
      // Target is only ArchMod, not sort.
      return 0;
    }
  };

  let original: Element[] = [];
  original = original.concat(elements);

  elements.sort(overlapComparator);

  let isChanged = false;
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].uid !== original[i].uid) {
      isChanged = true;
      break;
    }
  }

  if (isChanged) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "resolveOverlappingArchMod()");
    return true;
  } else {
    return false;
  }
}

function updateHierarchy(elements: Element[]) {
  let original: Element[] = [];
  original = original.concat(elements);

  const reversed = original.reverse();

  while (reversed.length !== 0) {
    const topElm = reversed.shift();
    if (topElm === undefined) {
      TraceLog.e(TAG, "updateHierarchy(): Unexpected State. topElm is undefined.");
    } else {
      if (topElm.TAG === ArchMod.TAG) {
        const topArchMod = topElm as ArchMod;

        const parentElm = reversed.find( (element: Element) => {
          if (element.TAG === ArchMod.TAG) {
            const archMod = element as ArchMod;

            return archMod.isChild(topArchMod);
          } else {
            return false;
          }
        } );

        if (parentElm !== undefined) {
          // Parent is existing.
          const parentArchMod = parentElm as ArchMod;
          topArchMod.parentUid = parentArchMod.uid;
        } else {
          // No parent.
          topArchMod.parentUid = null;
        }
      }
    }
  }

  // Update depth info.
  function queryUid(elements: Element[], uid: number): ArchMod {
    return elements.find( (element: Element) => element.uid === uid ) as ArchMod;
  }
  elements.forEach( (element: Element) => {
    if (element.TAG === ArchMod.TAG) {
      const archMod = element as ArchMod;
      let depth = Def.TOP_LAYER_DEPTH;
      let parentUid = archMod.parentUid;

      while (parentUid != null) {
        const parentArchMod = queryUid(elements, parentUid);
        parentUid = parentArchMod.parentUid;
        depth++;
      }

      archMod.hierarchyDepth = depth;
    }
  } );
}

export interface ContextCallback {
  onArchModSelected(archMod: ArchMod): void;
}

// Current interaction context.
export class Context {

  public elementUids: number[] = [0]; // 0 is OutFrame UID.

  public genNewElementUid(): number {
    const max: number = Math.max.apply(null, this.elementUids);
    const newUid = max + 1;
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

  public forEachAllElements(callback: (element: Element) => void) {
    this.allElements.forEach(callback);
  }

  // Max depth to be rendered, valid for viewer only.
  private currentHierarchyDepth = Def.TOP_LAYER_DEPTH;
  private maxHierarchyDepth = Def.TOP_LAYER_DEPTH;

  // UNDO history.
  private readonly history: ArchitectureMapJson[] = [];
  private historyUndoCount: number = 0;

  // State flags.
  public isAddNewArchModMode: boolean = false;
  public isAddNewTextLabelMode: boolean = false;
  public isAddNewLineMode: boolean = false;
  public isAddNewConnectorMode: boolean = false;
  public globalMode: string = GLOBAL_MODE_GOD;

  // Connector related.
  public connectorBaseArchMod: ArchMod|null = null;

  // Selected list.
  private readonly selectedElements: Element[] = [];

  private _callback: ContextCallback|null = null;
      get callback(): ContextCallback|null {
        return this._callback;
      }
      set callback(callback: ContextCallback|null) {
        this._callback = callback;
      }

  public onSelected(selected: Element, isMulti: boolean) {
    this.selectedElements.push(selected);
    if (!isMulti) {
      this.resetAllStateExceptFor(selected);

      if (this.callback != null) {
        if (selected.TAG === ArchMod.TAG) {
          this.callback.onArchModSelected(selected as ArchMod);
        }
      }
    }
  }

  public onMultiSelected(selected: Element) {
    this.selectedElements.push(selected);
  }

  public onDeselected(deselected: Element) {
    const index = this.selectedElements.indexOf(deselected);
    if (0 <= index) {
      this.selectedElements.splice(index, 1);
    }
  }

  public tryToOpenContextMenuOfSingleSelectedElement() {
    if (this.selectedElements.length === 1) {
      const element: Element = this.selectedElements[0];

      switch(element.TAG) {
        case ArchMod.TAG: {
            const archMod = element as ArchMod;
            const size = archMod.getXYWH();
            const clickX = size.x + size.width / 2;
            const clickY = size.y + size.height / 2;
            archMod.openContextMenu(clickX, clickY);
          }
          break;

        case Line.TAG: {
            const line = element as Line;
            const size = line.getFromToXY();
            const width = Math.abs(size.toX - size.fromX);
            const height = Math.abs(size.toY - size.fromY);
            const clickX = Math.min(size.fromX, size.toX) + width / 2;
            const clickY = Math.min(size.fromY, size.toY) + height / 2;
            line.openContextMenu(clickX, clickY);
          }
          break;

        case Connector.TAG: {
            const conn = element as Connector;
            const size = conn.getFromToXY();
            const width = Math.abs(size.toX - size.fromX);
            const height = Math.abs(size.toY - size.fromY);
            const clickX = Math.min(size.fromX, size.toX) + width / 2;
            const clickY = Math.min(size.fromY, size.toY) + height / 2;
            conn.openContextMenu(clickX, clickY);
          }
          break;

        case TextLabel.TAG: {
            const label = element as TextLabel;
            const size = label.getXYWH();
            const clickX = size.x + size.width / 2;
            const clickY = size.y + size.height / 2;
            label.openContextMenu(clickX, clickY);
          }
          break;
      }
    }
  }

  /**
   * Serialize current static context to JSON object.
   * @return ArchitectureMapJson object.
   */
  public serializeToJson(): ArchitectureMapJson {
    const serializedElements: ElementJson[] = [];
    this.allElements.forEach( (element: Element) => {
      const serialized = element.serialize();
      serializedElements.push(serialized);
    } );

    const outFrameJson = this.outFrame.serialize();

    const totalJson: ArchitectureMapJson = {
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

    // Convert to Latest version.
    serialized = convertJsonToLatest(serialized);

    const outFrame = OutFrame.deserialize(this.html, this.svg, serialized[Def.KEY_OUT_FRAME]);
    const outSize = outFrame.getXYWH();
    this.outFrame.setXYWH(outSize.x, outSize.y, outSize.width, outSize.height);
    this.changeOutFrameSize(outSize.width, outSize.height);
    this.outFrame.relayout();

    const elements: ElementJson[] = serialized[Def.KEY_ARCHITECTURE_MAP];
    elements.forEach( (element: ElementJson) => {
      let deserialized: Element;
      let json;

      switch (element[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          json = element as ArchModJson;
          deserialized = this.deserializeArchMod(json);

          // Update hierarchy depth here,
          // because detail level change feature is valid only for viewer.
          const archMod = deserialized as ArchMod;
          const depth = archMod.hierarchyDepth;
          if (this.maxHierarchyDepth < depth) {
            this.maxHierarchyDepth = depth;
            this.currentHierarchyDepth = depth;
          }
          break;

        case TextLabel.TAG:
          json = element as TextLabelJson;
          deserialized = this.deserializeTextLabel(json);
          break;

        case Line.TAG:
          json = element as LineJson;
          deserialized = this.deserializeLine(json);
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

      // Update UI.
      this.updateDetailHierarchyUi();

    } );
  }

  private validateElementUid(element: Element) {
    const uid = element.uid;

    if (!uid) {
      // NG. UID is not set.
      console.log(`#### ERROR: Element UID is NOT Available.`);
      alert(`Element UID is NOT Available.`);
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
    const archMod = ArchMod.deserialize(this.html, this.svg, json);
    this.validateElementUid(archMod);
    this.renderArchMod(archMod);
    return archMod;
  }

  public addNewArchMod(label: string, x: number, y: number, width: number, height: number): ArchMod {
    const uid = this.genNewElementUid();
    const archMod = new ArchMod(uid, this.html, this.svg, label);
    archMod.setXYWH(x, y, DEFAULT_SIZE, DEFAULT_SIZE);
    this.renderArchMod(archMod);
    return archMod;
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

  private deserializeTextLabel(json: TextLabelJson): TextLabel {
    const textLabel = TextLabel.deserialize(this.html, this.svg, json);
    this.validateElementUid(textLabel);
    this.renderTextLabel(textLabel);
    return textLabel;
  }

  public addNewTextLabel(label: string, x: number, y: number, width: number, height: number): TextLabel {
    const uid = this.genNewElementUid();
    const textLabel = new TextLabel(uid, this.html, this.svg, label);
    textLabel.setXYWH(x, y, DEFAULT_SIZE, DEFAULT_SIZE);
    this.renderTextLabel(textLabel);
    return textLabel;
  }

  private renderTextLabel(textLabel: TextLabel) {
    textLabel.setCallback(new TextLabelCallbackImpl());

    switch (this.globalMode) {
      case GLOBAL_MODE_GOD:
        textLabel.itxMode = ElementItxMode.EDITABLE;
        break;
      case GLOBAL_MODE_ITX:
        textLabel.itxMode = ElementItxMode.SELECTABLE;
        break;
    }

    textLabel.render();
    this.addElementToTop(textLabel);
  }

  private deserializeLine(json: LineJson): Line {
    const line = Line.deserialize(this.html, this.svg, json);
    this.validateElementUid(line);
    this.renderLine(line);
    return line;
  }

  public addNewLine(fromX: number, fromY: number): Line {
    const uid = this.genNewElementUid();
    const line = new Line(uid, this.html, this.svg);
    line.setFromToXY(fromX, fromY, fromX + DEFAULT_SIZE, fromY + DEFAULT_SIZE);
    this.renderLine(line);
    return line;
  }

  private renderLine(line: Line) {
    line.setCallback(new LineCallbackImpl());

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
    const connector = Connector.deserialize(this.html, this.svg, json);
    this.validateElementUid(connector);
    this.renderConnector(connector);
    return connector;
  }

  public addNewConnector(fromArchMod: ArchMod, toArchMod: ArchMod): Connector {
    const uid = this.genNewElementUid();
    const connector = new Connector(uid, this.html, this.svg);
    connector.setFromToArchMod(fromArchMod, toArchMod);
    this.renderConnector(connector);
    return connector;
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

    this.relayout();
  }

  public addElementToBottom(element: Element) {
    this.allElements.unshift(element);
    this.elementUids.unshift(element.uid);

    this.relayout();
  }

  public removeElement(element: Element) {
    const index = this.allElements.indexOf(element);
    if (index < 0) {
      TraceLog.e(TAG, `## Element=${element.serialize()} is NOT existing.`);
      return;
    }
    this.allElements.splice(index, 1);

    const uidIndex = this.elementUids.indexOf(element.uid);
    if (index < 0) {
      TraceLog.e(TAG, `## Element UID of ${element.serialize()} is NOT existing.`);
      return;
    }
    this.elementUids.splice(uidIndex, 1);
  }

  // @param selection area 4-edge.
  public updateBrushSelected(selected: number[][]) {
    const minX = selected[0][0];
    const minY = selected[0][1];
    const maxX = selected[1][0];
    const maxY = selected[1][1];

    this.allElements.forEach( (element: Element) => {
      switch (element.TAG) {
        case ArchMod.TAG:
          // fall-through.
        case TextLabel.TAG: {
          const elm = element as ArchMod|TextLabel;

          const {x, y, width, height} = elm.getXYWH();

          if (minX < x && minY < y && x + width < maxX && y + height < maxY) {
            if (!this.selectedElements.includes(elm)) {
              elm.select();
              this.onMultiSelected(elm);
            }
          } else {
            if (this.selectedElements.includes(elm)) {
              elm.deselect();
              this.onDeselected(elm);
            }
          }
        }
        break;

        case Line.TAG: {
          const line = element as Line;

          const {fromX, fromY, toX, toY} = line.getFromToXY();

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
      if (element.TAG === Connector.TAG) return;

      if (element !== except) {
        element.move(plusX, plusY);
      }

      if (element.TAG === ArchMod.TAG) {
        const archMod = element as ArchMod;
        this.updateConnectorsRelatedTo(archMod);
      }

    } );
  }

  public onMoveResizeDone() {
    this.relayout();
  }

  public updateConnectorsRelatedTo(archMod: ArchMod) {
    this.allElements.forEach( (element: Element) => {
      if (element.TAG === Connector.TAG) {
        const connector = element as Connector;
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
      if (except === element) return;
      element.resetState();
      this.onDeselected(element);
    } );

    this.outFrame.resetState();
  }

  public resetAllState() {
    this.resetAllStateExceptFor(null);
  }

  public changeOutFrameSize(width:number, height: number) {
    this.root.css("width", width + ROOT_DIV_RIGHT_BOTTOM_CLEARANCE);
    this.root.css("height", height + ROOT_DIV_RIGHT_BOTTOM_CLEARANCE);
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

      if (selected.TAG === ArchMod.TAG) {
        this.allElements.forEach( (element) => {
          if (element.TAG === Connector.TAG) {
            const connector = element as Connector;
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
    if (this.clipboard.length !== 0) this.clipboard.length = 0; // Clear all.

    this.selectedElements.forEach( (selected: Element) => {

      // TODO: Consider to copy/paste Connector.
      if (selected.TAG === Connector.TAG) return;

      this.clipboard.push(selected.serialize());
    } );

    this.resetAllState();
  }

  public pasteFromClipBoard() {
    if (this.clipboard.length === 0) return;

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

        case TextLabel.TAG:
          json = serialized as TextLabelJson;

          json[Def.KEY_DIMENS][Def.KEY_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_Y] += COPY_PASTE_SLIDE_DIFF;

          element = this.deserializeTextLabel(json);
          break;

        case Line.TAG:
          json = serialized as LineJson;

          json[Def.KEY_DIMENS][Def.KEY_FROM_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_FROM_Y] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_TO_X] += COPY_PASTE_SLIDE_DIFF;
          json[Def.KEY_DIMENS][Def.KEY_TO_Y] += COPY_PASTE_SLIDE_DIFF;

          element = this.deserializeLine(json);
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
      if (element.TAG === ArchMod.TAG) {
        const archMod = element as ArchMod;
        return archMod.label === newLabel;
      } else {
        return false;
      }
    } );
  }

  public recordHistory() {
    // Remove old history branch.
    if (this.historyUndoCount !== 0) {
      this.history.splice(-1 * this.historyUndoCount);
    }

    const curJson: ArchitectureMapJson = this.serializeToJson();

    const curSize = this.history.length;
    if (curSize > 0) {
      const last = this.history[curSize - 1];
      const lastStr = JSON.stringify(last);
      const curStr = JSON.stringify(curJson);
      if (lastStr === curStr) {
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

    const historyJson = this.history[this.history.length - 1 - this.historyUndoCount];

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

    const futureJson = this.history[this.history.length - 1 - this.historyUndoCount];

    if (futureJson == null) {
      // No future.
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo() : NO Future`);
      this.historyUndoCount++;
      return;
    }

    this.recoverJson(futureJson);
  }

  public relayout() {
    if (resolveOverlappingArchMod(this.allElements)) {
      this.allElements.forEach ( (element: Element) => {
        element.delete();
      } );

      this.allElements.forEach ( (element: Element) => {
        element.render();
      } );

      this.selectedElements.forEach( (element: Element) => {
        element.select();
      } );
    }

    // Update Z-Order.
    let zOrder = Def.START_OF_Z_ORDER;
    this.allElements.forEach( (element: Element) => {
      element.zOrder = zOrder;
      zOrder++;
    } );

    updateHierarchy(this.allElements);
  }

  public changeToGodMode() {
    this.globalMode = GLOBAL_MODE_GOD;

    this.resetAllState();
    this.allElements.forEach( (element: Element) => {
      element.itxMode = ElementItxMode.EDITABLE;
    } );
    this.outFrame.itxMode = ElementItxMode.EDITABLE;
  }

  public changeToItxMode() {
    this.globalMode = GLOBAL_MODE_ITX;

    this.resetAllState();
    this.allElements.forEach( (element: Element) => {
      if (element.TAG === ArchMod.TAG) {
        element.itxMode = ElementItxMode.SELECTABLE;
      } else {
        element.itxMode = ElementItxMode.RIGID;
      }
    } );
    this.outFrame.itxMode = ElementItxMode.RIGID;
  }

  public queryElementUid(uid: number): Element {
    const hit = this.allElements.find( (element: Element) => element.uid === uid );
    if (hit === undefined) throw new Error(`UID = ${uid} is NOT Hit.`);
    return hit;
  }

  public queryConnector(fromUid: number, toUid: number): Element|null {
    const hit = this.allElements.find( (element: Element)=> {
      if (element.TAG === Connector.TAG) {
        const conn = element as Connector;
        return conn.isConnectedFrom(fromUid) && conn.isConnectedTo(toUid);
      } else {
        // NO Hit.
        return false;
      }
    } );
    if (hit === undefined) {
      return null;
    } else {
      return hit;
    }
  }

  public moreDetailHierarchy() {
    const oldDepth = this.currentHierarchyDepth;
    if (this.currentHierarchyDepth < this.maxHierarchyDepth) {
      this.currentHierarchyDepth++;
    }

    if (oldDepth != this.currentHierarchyDepth) {
      this.updateDetailHierarchy();
    }

    this.updateDetailHierarchyUi();
  }

  public lessDetailHierarchy() {
    const oldDepth = this.currentHierarchyDepth;
    if (this.currentHierarchyDepth > Def.TOP_LAYER_DEPTH) {
      this.currentHierarchyDepth--;
    }

    if (oldDepth != this.currentHierarchyDepth) {
      this.updateDetailHierarchy();
    }

    this.updateDetailHierarchyUi();
  }

  private updateDetailHierarchy() {
    this.allElements.forEach ( (element: Element) => {
      element.delete();
    } );

    this.allElements.forEach ( (element: Element) => {
      // Check hierarchy depth.
      if (element.TAG == ArchMod.TAG) {
        const archMod = element as ArchMod;
        if (this.currentHierarchyDepth < archMod.hierarchyDepth) {
          // Skip rendering.
          return;
        }
      }

      element.render();
    } );
  }

  private updateDetailHierarchyUi() {
    const MORE_ID = "#more_detail_hierarchy_button";
    const LESS_ID = "#less_detail_hierarchy_button";

    if (this.maxHierarchyDepth == Def.TOP_LAYER_DEPTH) {
      // Only 1 layer arch map.
      $(MORE_ID).prop("disabled", true);
      $(LESS_ID).prop("disabled", true);
      return;
    }

    if (this.currentHierarchyDepth >= this.maxHierarchyDepth) {
      // Most detail.
      $(MORE_ID).prop("disabled", true);
      $(LESS_ID).prop("disabled", false);
    }

    if (this.currentHierarchyDepth <= Def.TOP_LAYER_DEPTH) {
      // Least detail.
      $(MORE_ID).prop("disabled", false);
      $(LESS_ID).prop("disabled", true);
    }

    $("#detail_level_indicator").text(`${this.currentHierarchyDepth}/${this.maxHierarchyDepth}`);
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
    // NOP.
  }

  onSizeChangeEnd(width: number, height: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChangeEnd() : width=${width}, height=${height}`);
    CONTEXT.changeOutFrameSize(width, height);
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
        const fromArchMod = CONTEXT.connectorBaseArchMod;
        const toArchMod = selected;

        if (fromArchMod.uid === toArchMod.uid) {
          // NOP. Same one.
        } else {
          // Duplicate check.
          const nit = CONTEXT.queryConnector(fromArchMod.uid, toArchMod.uid);

          if (nit == null) {
            // Add new connector.
            CONTEXT.addNewConnector(fromArchMod, toArchMod);
            CONTEXT.recordHistory();
          }
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
    CONTEXT.onMoveResizeDone();
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

  getParentLabel(parentUid: number|null): string {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.getParentLabel() : parentUid=${parentUid}`);

    if (parentUid == null) {
      return "";
    }

    const parentLabels: string[] = [];

    let nextUid: number|null = parentUid;
    while (nextUid != null) {
      const parentArchMod = CONTEXT.queryElementUid(nextUid) as ArchMod;
      parentLabels.unshift(parentArchMod.label);
      nextUid = parentArchMod.parentUid;
    }

    return parentLabels.join(" - ");
  }

  onHistoricalChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onHistoricalChanged() : label=${archMod.label}`);
    CONTEXT.recordHistory();
  }

  onSizeChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSizeChanged() : label=${archMod.label}`);
    CONTEXT.updateConnectorsRelatedTo(archMod);
  }

  onSizeChangeDone(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onSizeChangeDone() : label=${archMod.label}`);
    CONTEXT.onMoveResizeDone();
  }

  onClipAreaChanged(archMod: ArchMod) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onClipAreaChanged() : label=${archMod.label}`);
    CONTEXT.updateConnectorsRelatedTo(archMod);
  }
}

// Common callback implementation for ALL TextLabel instances.
class TextLabelCallbackImpl implements TextLabelCallback {
  onSelected(selected: TextLabel, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onSelected() : ${selected.label}, isMulti=${isMulti}`);
    CONTEXT.onSelected(selected, isMulti);
  }

  onDeselected(deselected: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onDeselected() : ${deselected.label}`);
    CONTEXT.onDeselected(deselected);
  }

  onEditing(editing: TextLabel, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onEditing() : ${editing.label}, isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onEdited() : ${edited.label}`);
    CONTEXT.onDeselected(edited);
  }

  onDragStart(moved: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onDragStart()`);
    // NOP.
  }

  onDrag(moved: TextLabel, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedElements(plusX, plusY, moved);
  }

  onDragEnd(moved: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onDragEnd()`);
    CONTEXT.onMoveResizeDone();
  }

  onRaised(raised: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onLowered()`);
    CONTEXT.lower(lowered);
  }

  onLabelChanged(textLabel: TextLabel, oldLabel: string, newLabel: string) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onLabelChanged() : old=${oldLabel}, new=${newLabel}`);
  }

  onHistoricalChanged(textLabel: TextLabel) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onHistoricalChanged() : label=${textLabel.label}`);
    CONTEXT.recordHistory();
  }
}

// Common callback for ALL Line instances.
class LineCallbackImpl implements LineCallback {
  onSelected(selected: Line, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onSelected() : isMulti=${isMulti}`);
    CONTEXT.onSelected(selected, isMulti);
  }

  onDeselected(deselected: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onDeselected()`);
    CONTEXT.onDeselected(deselected);
  }

  onEditing(editing: Line, isMulti: boolean) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onEditing() : isMulti=${isMulti}`);
    CONTEXT.onSelected(editing, isMulti);
  }

  onEdited(edited: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onEdited()`);
    CONTEXT.onDeselected(edited);
  }

  onDragStart(moved: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onDragStart()`);
    // NOP.
  }

  onDrag(moved: Line, plusX: number, plusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onDrag() : plusX=${plusX}, plusY=${plusY}`);
    CONTEXT.moveSelectedElements(plusX, plusY, moved);
  }

  onDragEnd(moved: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onDragEnd()`);
    CONTEXT.onMoveResizeDone();
  }

  onRaised(raised: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onRaised()`);
    CONTEXT.raise(raised);
  }

  onLowered(lowered: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onLowered()`);
    CONTEXT.lower(lowered);
  }

  onHistoricalChanged(line: Line) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onHistoricalChanged()`);
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
    CONTEXT.onMoveResizeDone();
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

  const root: JQueryNode = $(`#${ROOT_ID}`);
  root.css("width", DEFAULT_TOTAL_WIDTH + ROOT_DIV_RIGHT_BOTTOM_CLEARANCE);
  root.css("height", DEFAULT_TOTAL_HEIGHT + ROOT_DIV_RIGHT_BOTTOM_CLEARANCE);
  CONTEXT.root = root;

  const svg: D3Node.SVG = d3.select(`#${SVG_ROOT_ID}`);
  CONTEXT.svg = svg;

  const html: JQueryNode = $(`#${HTML_ROOT_ID}`);
  html.css("display", "none");
  CONTEXT.html = html;

  const outFrame = new OutFrame(Def.UID_OUT_FRAME, html, svg);
  outFrame.setCallback(new OutFrameCallbackImpl());
  outFrame.setXYWH(0, 0, DEFAULT_TOTAL_WIDTH, DEFAULT_TOTAL_HEIGHT);
  outFrame.render();
  CONTEXT.outFrame = outFrame;

  registerGlobalCallbacks();

  // Default global mode.
  changeGlobalModeTo(defaultGlobalMode);

  // Load JSON.
  if (defaultLoadJson != null) {
    const serialized: ArchitectureMapJson = JSON.parse(defaultLoadJson);
    CONTEXT.deserializeFromJson(serialized);
    CONTEXT.resetAllState();
    CONTEXT.recordHistory();
  }
}

function prepareBrushLayer() {
  if (CONTEXT.brushLayer != null) return;

  const brushLayer: D3Node.G = CONTEXT.svg.append("g")
      .attr("class", "brushes")
      .lower();
  CONTEXT.brushLayer = brushLayer;

  // Max brush area size.
  const {x, y, width, height} = CONTEXT.outFrame.getXYWH();

  const brush: d3.BrushBehavior<any> = d3.brush()
      .extent([[x, y], [x + width, y + height]])
      .filter( (event: MouseEvent) => {
        return !event.button;
      } )
      .on("start", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:start");

        CONTEXT.resetAllState();

        brushLayer.raise();
      } )
      .on("brush", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:brush");

        const brushArea: number[][]|null = (event as any).selection;

        if (brushArea != null) {
          if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `brushArea = ${brushArea}`);

          CONTEXT.updateBrushSelected(brushArea);
        }
      } )
      .on("end", (event: MouseEvent) => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "brush:end");

        const target = event.target as any;

        target.on("start", null);
        target.on("brush", null);
        target.on("end", null);

        // Immediately cancel selection.
        // After cleared, brush callback is called again with null selection.
        // So, unregister callbacks above here to avoid infinite loop.
        brushLayer.call(target.clear);

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
    if (CONTEXT.globalMode === GLOBAL_MODE_GOD) {
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

        case "F2":
          CONTEXT.tryToOpenContextMenuOfSingleSelectedElement();
          break;

        case "F5":
          alert("Reload Short-Cut Key is Disabled in EDIT mode.");
          break;

        default:
          isHandledByGodMode = false;
          break;
      }
    } else {
      isHandledByGodMode = false;
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

    if (CONTEXT.globalMode === GLOBAL_MODE_GOD) {
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

  CONTEXT.svg.on("click", (event: MouseEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");
    CONTEXT.resetAllState();
    event.stopPropagation();
    event.preventDefault();
  } );

  CONTEXT.svg.on("contextmenu", (event: MouseEvent) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:contextmenu");
    // NOP.
    event.stopPropagation();
    event.preventDefault();
  } );

  CONTEXT.html.on("contextmenu", (event: JQuery.Event) => {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:contextmenu");
    // NOP.
    event.stopPropagation();
    event.preventDefault();
  } );
}

// Add new component interaction entry point.
(window as any).onAddComponentClicked = (clicked: HTMLInputElement) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onAddComponentClicked()");

  switch(clicked.id) {
    case "add_archmod":
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "Finish add new ArchMod");

      if (CONTEXT.isAddNewArchModMode) {
        finishAddNewArchModMode();
        clicked.checked = false;
      } else {
        prepareAddNewArchModMode();
      }
      break;

    case "add_textlabel":
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "Finish add new TextLabel");

      if (CONTEXT.isAddNewTextLabelMode) {
        finishAddNewTextLabelMode();
        clicked.checked = false;
      } else {
        prepareAddNewTextLabelMode();
      }
      break;

    case "add_line":
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "Finish add new Line");

      if (CONTEXT.isAddNewLineMode) {
        finishAddNewLineMode();
        clicked.checked =false;
      } else {
        prepareAddNewLineMode();
      }
      break;

    case "add_connector":
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "Finish add new Connector");

      if (CONTEXT.isAddNewConnectorMode) {
        finishAddNewConnectorMode();
        clicked.checked = false;
      } else {
        prepareAddNewConnectorMode();
      }
      break;
  }

};

// Open module hierarchy viewer on new popup window.
(window as any).onModuleHierarchyViewClicked = (event: MouseEvent, clicked: HTMLInputElement) => {
  openModuleHierarchyViewWindow(CONTEXT, event.screenX, event.screenY);
};

// Download static HTML.
(window as any).downloadStaticHtml = (clicked: HTMLInputElement) => {
  downloadStaticHtml(clicked);
};

function prepareAddNewArchModMode() {
  CONTEXT.resetAllState();

  CONTEXT.html.css("display", "block");
  CONTEXT.html.css("background-color", "#AAAAAAAA");

  CONTEXT.html.on("click", (e: JQuery.Event) => {
    const posX: number = e.offsetX || 0;
    const posY: number = e.offsetY || 0;

    CONTEXT.addNewArchMod(
        ArchMod.TAG,
        posX,
        posY,
        DEFAULT_SIZE,
        DEFAULT_SIZE);

    CONTEXT.recordHistory();

    finishAddNewArchModMode();
  } );

  CONTEXT.isAddNewArchModMode = true;
}

function finishAddNewArchModMode() {
  resetHtmlRoot();
  CONTEXT.isAddNewArchModMode = false;

  (document.getElementById("add_archmod") as HTMLInputElement).checked = false;
}

function prepareAddNewTextLabelMode() {
  CONTEXT.resetAllState();

  CONTEXT.html.css("display", "block");
  CONTEXT.html.css("background-color", "#AAAAAAAA");

  CONTEXT.html.on("click", (e: JQuery.Event) => {
    const posX: number = e.offsetX || 0;
    const posY: number = e.offsetY || 0;

    CONTEXT.addNewTextLabel(
        TextLabel.TAG,
        posX,
        posY,
        DEFAULT_SIZE,
        DEFAULT_SIZE);

    CONTEXT.recordHistory();

    finishAddNewTextLabelMode();
  } );

  CONTEXT.isAddNewTextLabelMode = true;
}

function finishAddNewTextLabelMode() {
  resetHtmlRoot();
  CONTEXT.isAddNewTextLabelMode = false;

  (document.getElementById("add_textlabel") as HTMLInputElement).checked = false;
}

function prepareAddNewLineMode() {
  CONTEXT.resetAllState();

  CONTEXT.html.css("display", "block");
  CONTEXT.html.css("background-color", "#AAAAAAAA");

  CONTEXT.html.on("click", (e: JQuery.Event) => {
    const posX: number = e.offsetX || 0;
    const posY: number = e.offsetY || 0;

    CONTEXT.addNewLine(posX, posY);

    CONTEXT.recordHistory();

    finishAddNewLineMode();
  } );

  CONTEXT.isAddNewLineMode = true;
}

function finishAddNewLineMode() {
  resetHtmlRoot();
  CONTEXT.isAddNewLineMode = false;

  (document.getElementById("add_line") as HTMLInputElement).checked = false;
}

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

  (document.getElementById("add_connector") as HTMLInputElement).checked = false;
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

  const serialized: ArchitectureMapJson = CONTEXT.serializeToJson();

  if (TraceLog.IS_DEBUG) {
    TraceLog.d(TAG, "#### TOTAL JSON OBJ");
    console.log(serialized);
  }

  const jsonStr = JSON.stringify(serialized, null, 2);
  const filename = getExportFileNameBase();
  Downloader.downloadJson(jsonStr, filename);
};

(window as any).onLoadJsonClicked = (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onLoadJsonClicked()");

  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  const reader = new FileReader();
  reader.onload = (e: Event) => {
    const r = e.target as FileReader;
    const jsonStr: string = r.result as string;

    const serialized: ArchitectureMapJson = JSON.parse(jsonStr);

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

  const button = event!.target as HTMLButtonElement;

  // Dim UI.
  button.disabled = true;

  const serialized: ArchitectureMapJson = CONTEXT.serializeToJson();
  const jsonStr = JSON.stringify(serialized, null, 2);

  const xhr = new XMLHttpRequest();
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

  const outSize = CONTEXT.outFrame.getXYWH();

  Downloader.downloadSvgAsPng(
      CONTEXT.svg,
      outSize.width,
      outSize.height,
      getExportFileNameBase());
};

function changeGlobalModeTo(mode: string) {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `changeGlobalModeTo() : mode=$mode`);

  const elm = document.getElementById(GLOBAL_MODE_LABEL_ID) as HTMLElement;
  elm.textContent = mode;

  const godModePanel = document.getElementById(GOD_MODE_UI_ID) as HTMLElement;

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

(window as any).onMoreDetailHierarchyClicked = () => {
  CONTEXT.moreDetailHierarchy();
}

(window as any).onLessDetailHierarchyClicked = () => {
  CONTEXT.lessDetailHierarchy();
}

