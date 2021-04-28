import * as d3 from "d3";
import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { Element, ElementItxMode, ElementJson } from "../d3/Element";
import { ArchMod, ArchModCallback, ArchModJson } from "../d3/ArchMod";
import { TextLabel, TextLabelCallback, TextLabelJson } from "../d3/TextLabel";
import { Line, LineCallback, LineJson } from "../d3/Line";
import { Connector, ConnectorCallback, ConnectorJson } from "../d3/Connector";
import { OutFrame, OutFrameCallback, OutFrameJson } from "../d3/OutFrame";
import { TraceLog } from "../util/TraceLog";
import { D3Node, JQueryNode } from "../TypeDef";
import { Def, ColorSet } from "../Def";
import { Util } from "../util/Util";
import { Downloader } from "../util/Downloader";
import { convertJsonToLatest } from "../JsonConverter";
import { openModuleHierarchyViewWindow } from "../itx/open_module_hierarchy_view";
import { downloadStaticHtml } from "../itx/download_static_html";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { History } from "../history/records";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const ROOT_ID = "root";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";
const OVERLAY_ROOT_ID = "overlay_root";
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

export interface ArchitectureMapJson {
  [Def.KEY_VERSION]: string,
  [Def.KEY_OUT_FRAME]: OutFrameJson,
  [Def.KEY_ARCHITECTURE_MAP]: ElementJson[],
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
  public readonly allElements: Element[] = [];

  public forEachAllElements(callback: (element: Element) => void) {
    this.allElements.forEach(callback);
  }

  // Max depth to be rendered, valid for viewer only.
  private currentHierarchyDepth = Def.TOP_LAYER_DEPTH;
  private maxHierarchyDepth = Def.TOP_LAYER_DEPTH;

  // UNDO history.
  private historyBaseJson: ArchitectureMapJson|null = null;
  private readonly historyRecords: History.Record[] = [];
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
  public readonly selectedElements: Element[] = [];

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
    this.onSelected(selected, true);
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

  public async deserializeFromJsonAll(serialized: ArchitectureMapJson): Promise<Element[]> {
    return this.deserializeFromJson(serialized, false); // Load ALL including OutFrame.
  }

  public async deserializeFromJsonPartial(serialized: ArchitectureMapJson): Promise<Element[]> {
    return this.deserializeFromJson(serialized, true); // Load Elements only.
  }

  /**
   * Deserialize static context from JSON object.
   * @param serialized ArchitectureMapJson object.
   * @param isPartial Deserialize ArchitectureMapJson as a partial Elements or not.
   * @return elements Deserialied Elements without OutFrame.
   */
  private async deserializeFromJson(
      serialized: ArchitectureMapJson,
      isPartial: boolean): Promise<Element[]> {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `deserializeFromjson() : E`);
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `    isPartial = ${isPartial}`);

    await showLoading();

    // Convert to Latest version.
    serialized = convertJsonToLatest(serialized);

    if (!isPartial) {
      // Render OutFrame.
      await Util.timeslice( () => {
        const outFrame = OutFrame.deserialize(this.html, this.svg, serialized[Def.KEY_OUT_FRAME]);
        const outSize = outFrame.getXYWH();
        this.outFrame.setXYWH(outSize.x, outSize.y, outSize.width, outSize.height);
        this.changeOutFrameSize(outSize.width, outSize.height);
        this.outFrame.relayout();
      } );
    }

    const elements: ElementJson[] = serialized[Def.KEY_ARCHITECTURE_MAP];

    // For partial JSON laod, update ALL UID here because
    // UID in JSON must be conflict with existing element UID.
    if (isPartial) {
      let uid = this.genNewElementUid();
      elements.forEach( (json: ElementJson) => {
        json[Def.KEY_UID] = uid;
        ++uid;
      } );
    }

    // Rendner each Element.
    const deserializedElements: Element[] = [];
    for (let i = 0; i < elements.length; ++i) {
      const elementJson: ElementJson = elements[i];

      const element = await Util.timeslice<Element|null>( (): Element|null => {
        let deserialized: Element;
        let json;

        switch (elementJson[Def.KEY_CLASS]) {
          case ArchMod.TAG:
            json = elementJson as ArchModJson;
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
            json = elementJson as TextLabelJson;
            deserialized = this.deserializeTextLabel(json);
            break;

          case Line.TAG:
            json = elementJson as LineJson;
            deserialized = this.deserializeLine(json);
            break;

          case Connector.TAG:
            json = elementJson as ConnectorJson;
            deserialized = this.deserializeConnector(json);
            break;

          default:
            TraceLog.e(TAG, `Unexpected Element:`);
            console.log(element);
            return null;
        }

        // Load as selected state.
        deserialized.select();
        this.onMultiSelected(deserialized);

        return deserialized;
      } );

      if (element !== null) {
        deserializedElements.push(element);
      }
    }

    await Util.timeslice( () => {
      this.resolveOverlappingArchMod();
      this.relayout();
    } );

    // Update UI.
    await Util.timeslice( () => {
      this.updateDetailHierarchyUi();
    } );

    await Util.timeslice( () => {
      hideLoading();
    } );

    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `deserializeFromjson() : X`);
    return deserializedElements;
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

  public deserializeArchMod(json: ArchModJson): ArchMod {
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
    this.relayout();
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

  public deserializeTextLabel(json: TextLabelJson): TextLabel {
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
    this.relayout();
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

  public deserializeLine(json: LineJson): Line {
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
    this.relayout();
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

  public deserializeConnector(json: ConnectorJson): Connector {
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
    this.relayout();
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
  }

  public addElementToBottom(element: Element) {
    this.allElements.unshift(element);
    this.elementUids.unshift(element.uid);
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
    this.resolveOverlappingArchMod();
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

    this.resolveOverlappingArchMod();
    this.relayout();
  }

  public lower(lowered: Element) {
    this.removeElement(lowered);
    this.addElementToBottom(lowered);

    this.resolveOverlappingArchMod();

    // OutFrame is always most back end.
    this.outFrame.moveToBackEnd();

    this.relayout();
  }

  public moveElementToTopOf(target: Element, topOf: Element) {
    // Remove.
    const index = this.allElements.indexOf(target);
    this.allElements.splice(index, 1);

    // Insert.
    const toIndex = this.allElements.indexOf(topOf);
    this.allElements.splice(toIndex + 1, 0, target);
  }

  public moveElementToBottomOf(target: Element, bottomOf: Element) {
    // Remove.
    const index = this.allElements.indexOf(target);
    this.allElements.splice(index, 1);

    // Insert.
    const bottomIndex = this.allElements.indexOf(bottomOf);
    this.allElements.splice(bottomIndex, 0, target);
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

  public pasteFromClipBoard(): Element[] {
    if (this.clipboard.length === 0) return [];

    this.resetAllState();

    this.clipboard.sort( (elmA: ElementJson, elmB: ElementJson): number => {
      const zA = elmA[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      const zB = elmB[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      if (zA < zB) return -1;
      if (zA > zB) return 1;
      return 0;
    } );

    const pastedElements: Element[] = [];

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

      pastedElements.push(element);

    } );

    this.resolveOverlappingArchMod();

    this.relayout();

    this.clipboard.length = 0; // Clear all.

    return pastedElements;
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

  public queryUidOnHistoryBaseJson(uid: number): ElementJson {
    const elementJsons = (this.historyBaseJson as ArchitectureMapJson)[Def.KEY_ARCHITECTURE_MAP] as ElementJson[];

    for (let i = 0; i < elementJsons.length; ++i) {
      const elm = elementJsons[i];
      if (elm[Def.KEY_UID] == uid) {
        return elm;
      }
    }

    alert(`ERR: UID No hit on history base. uid=${uid}`);
    return {} as ElementJson;
  }

  public forEachAllHistoryElementJsons(callback: (json: ElementJson) => void) {
    const elementJsons = (this.historyBaseJson as ArchitectureMapJson)[Def.KEY_ARCHITECTURE_MAP] as ElementJson[];
    elementJsons.forEach( (json: ElementJson) => {
      callback(json);
    } );
  }

  private isHistoryChanged(): boolean {
    const headJson: ArchitectureMapJson = this.serializeToJson();

    // Check diff.
    const baseStr = JSON.stringify(this.historyBaseJson);
    const headStr = JSON.stringify(headJson);

    return baseStr !== headStr;
  }

  private prepareRecordHistory() {
    // Remove old history branch.
    if (this.historyUndoCount !== 0) {
      this.historyRecords.splice(-1 * this.historyUndoCount);
    }
  }

  private finishRecordHistory() {
    // Set this history as latest.
    this.historyUndoCount = 0;

    // Remove overflown old history.
    if (this.historyRecords.length > MAX_UNDO_HISTORY_SIZE) {
      this.historyRecords.shift();
    }

    this.updateHistoryBase();
  }

  public updateHistoryBase() {
    this.historyBaseJson = this.serializeToJson();
  }

  public recordLoadTotalJson() {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const headJson: ArchitectureMapJson = this.serializeToJson();

    const record: History.Record = new History.UpdateTotalJson(
        this,
        this.historyBaseJson as ArchitectureMapJson,
        headJson);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public recordAddElement(element: Element) {
    this.recordAddElements([element]);
  }

  public recordAddElements(elements: Element[]) {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const record: History.Record = new History.AddElements(this, elements);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public recordDeleteElements(elements: Element[]) {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const record: History.Record = new History.DeleteElements(this, elements);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public recordMoveElements(elements: Element[], totalPlusX: number, totalPlusY: number) {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const record: History.MoveElements = new History.MoveElements(this, elements, totalPlusX, totalPlusY);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public recordChangeOutFrameSize(
      beforeWidth: number,
      beforeHeight: number,
      afterWidth: number,
      afterHeight: number) {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const record: History.Record = new History.ChangeOutFrameSize(
        this,
        beforeWidth,
        beforeHeight,
        afterWidth,
        afterHeight);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public recordChangeElement(element: Element) {
    if (!this.isHistoryChanged()) {
      return;
    }
    this.prepareRecordHistory();

    const record: History.Record = new History.ChangeElementJson(this, element);
    this.historyRecords.push(record);

    this.finishRecordHistory();
  }

  public async recoverJson(json: ArchitectureMapJson) {
    this.deleteAll();
    await this.deserializeFromJsonAll(json);
    this.resetAllState();
  }

  public async undo() {
    if (this.historyRecords.length === 0) {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo() : NO History`);
      return;
    }

    if (this.historyRecords.length - 1 - this.historyUndoCount < 0) {
      // There is no history for past, this is first state.
      return;
    }

    this.resetAllState();

    const historyRecord = this.historyRecords[this.historyRecords.length - 1 - this.historyUndoCount];
    await historyRecord.undo();

    this.historyUndoCount++;

    this.updateHistoryBase();
  }

  public async redo() {
    if (this.historyRecords.length === 0) {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo() : NO Future`);
      return;
    }

    if (this.historyUndoCount <= 0) {
      // There is no history for future, this is latest state.
      return;
    }

    this.resetAllState();

    this.historyUndoCount--;

    const historyRecord = this.historyRecords[this.historyRecords.length - 1 - this.historyUndoCount];
    await historyRecord.redo();

    this.updateHistoryBase();
  }

  public resolveOverlappingArchMod() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "resolveOverlappingArchMod()");

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
    original = original.concat(this.allElements);

    original.forEach( (element: Element, index: number, array: Element[]) => {
      let lower: ArchMod;
      if (element.TAG === ArchMod.TAG) {
        lower = element as ArchMod;
      } else {
        return;
      }

      for (let i: number = index + 1; i < array.length; ++i) {
        let upper: ArchMod
        if (array[i].TAG === ArchMod.TAG) {
          upper = array[i] as ArchMod;
        } else {
          continue;
        }

        if (overlapComparator(lower, upper) === 1) {
          // Lower is smaller than upper.
          lower.moveToFrontEnd();
          break;
        }
      }
    } );
  }

  private static updateHierarchy(elements: Element[]) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `updateHierarchy() : E`);

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
    function queryUid(elms: Element[], uid: number): ArchMod {
      return elms.find( (elm: Element) => elm.uid === uid ) as ArchMod;
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

    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `updateHierarchy() : X`);
  }

  /**
   * Get module hierarchy.
   *
   * @return { [key: string]: {} }
   */
  public getHierarchy(): { [key: string]: {} } {
    type Nd = { [key: string]: {} };

    const root: Nd = {};

    this.forEachAllElements( (element: Element) => {
      if (element.TAG === ArchMod.TAG) {
        const archMod: ArchMod = element as ArchMod;

        // Create single hierarchy.
        const hierarchy: ArchMod[] = [archMod];
        let parentUid: number|null = archMod.parentUid;
        while(parentUid !== null) {
          const parentArchMod = this.queryElementUid(parentUid) as ArchMod;
          hierarchy.unshift(parentArchMod);
          parentUid = parentArchMod.parentUid;
        }

        // Register to root node.
        let curNd: Nd = root;
        hierarchy.forEach( (mod: ArchMod) => {
          const curChildren: Nd = curNd[mod.label];
          if (curChildren === undefined) {
            curNd[mod.label] = {};
          }
          curNd = curNd[mod.label];
        } );
      }
    } );

    return root;
  }

  public relayout() {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `relayout() : E`);

    // Update Z-Order.
    let zOrder = Def.START_OF_Z_ORDER;
    this.allElements.forEach( (element: Element) => {
      element.zOrder = zOrder;
      zOrder++;
    } );

    Context.updateHierarchy(this.allElements);

    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `relayout() : X`);
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

    if (oldDepth !== this.currentHierarchyDepth) {
      this.updateDetailHierarchy();
    }

    this.updateDetailHierarchyUi();
  }

  public lessDetailHierarchy() {
    const oldDepth = this.currentHierarchyDepth;
    if (this.currentHierarchyDepth > Def.TOP_LAYER_DEPTH) {
      this.currentHierarchyDepth--;
    }

    if (oldDepth !== this.currentHierarchyDepth) {
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
      if (element.TAG === ArchMod.TAG) {
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

    if (this.maxHierarchyDepth === Def.TOP_LAYER_DEPTH) {
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

  onSizeChangeEnd(startWidth: number, startHeight: number, endWidth: number, endHeight: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `OutFrame.onSizeChangeEnd() : start=[${startWidth}x${startHeight}], end=[${endWidth}x${endHeight}]`);
    CONTEXT.changeOutFrameSize(endWidth, endHeight);
    CONTEXT.recordChangeOutFrameSize(startWidth, startHeight, endWidth, endHeight);
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
            const newConnector = CONTEXT.addNewConnector(fromArchMod, toArchMod);
            CONTEXT.recordAddElement(newConnector);
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

  onDragEnd(moved: ArchMod, totalPlusX: number, totalPlusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `ArchMod.onDragEnd()`);
    CONTEXT.onMoveResizeDone();
    CONTEXT.recordMoveElements(CONTEXT.selectedElements, totalPlusX, totalPlusY);
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
    CONTEXT.recordChangeElement(archMod);
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

  onDragEnd(moved: TextLabel, totalPlusX: number, totalPlusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `TextLabel.onDragEnd()`);
    CONTEXT.onMoveResizeDone();
    CONTEXT.recordMoveElements(CONTEXT.selectedElements, totalPlusX, totalPlusY);
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
    CONTEXT.recordChangeElement(textLabel);
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

  onDragEnd(moved: Line, totalPlusX: number, totalPlusY: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `Line.onDragEnd()`);
    CONTEXT.onMoveResizeDone();
    CONTEXT.recordMoveElements(CONTEXT.selectedElements, totalPlusX, totalPlusY);
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
    CONTEXT.recordChangeElement(line);
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
    // NOP.
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
    CONTEXT.recordChangeElement(connector);
  }

  queryArchMod(uid: number): ArchMod {
    return CONTEXT.queryElementUid(uid) as ArchMod;
  }
}

// Entry point from HTML.
(window as any).onArchitectureMapLoaded = async (
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
    await CONTEXT.deserializeFromJsonAll(serialized);
    CONTEXT.resetAllState();
    CONTEXT.recordLoadTotalJson();
  }

  // Save the first history base.
  CONTEXT.updateHistoryBase();
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
  let canUndoRedo = true;

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
          const delElements: Element[] = CONTEXT.selectedElements.concat();
          CONTEXT.deleteSelected();
          CONTEXT.recordDeleteElements(delElements);

          // Call relayout() here because recordDeleteElements uses Z-Order index before deletion.
          // relayout() will update all Z-Order index so, call relayout() after history record.
          CONTEXT.relayout();
          break;

        case "c":
          if (event.ctrlKey) {
            CONTEXT.copyToClipBoard();
          }
          break;

        case "v":
          if (event.ctrlKey) {
            const pastedElements: Element[] = CONTEXT.pasteFromClipBoard();
            CONTEXT.recordAddElements(pastedElements);
          }
          break;

        case "z":
          if (event.ctrlKey) {
            if (canUndoRedo) {
              canUndoRedo = false;
              Util.timeslice( async () => {
                await CONTEXT.undo();
                canUndoRedo = true;
              } );
            }
          }
          break;

        case "y":
          if (event.ctrlKey) {
            if (canUndoRedo) {
              canUndoRedo = false;
              Util.timeslice( async () => {
                await CONTEXT.redo();
                canUndoRedo = true;
              } );
            }
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

    const newArchMod = CONTEXT.addNewArchMod(
        ArchMod.TAG,
        posX,
        posY,
        DEFAULT_SIZE,
        DEFAULT_SIZE);

    CONTEXT.recordAddElement(newArchMod);

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

    const newTextLabel = CONTEXT.addNewTextLabel(
        TextLabel.TAG,
        posX,
        posY,
        DEFAULT_SIZE,
        DEFAULT_SIZE);

    CONTEXT.recordAddElement(newTextLabel);

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

    const newLine = CONTEXT.addNewLine(posX, posY);

    CONTEXT.recordAddElement(newLine);

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

(window as any).onLoadJsonClicked = async (event: Event) => {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "onLoadJsonClicked()");

  const target = event.target as HTMLInputElement;
  const file: File = (target.files as FileList)[0];
  const reader = new FileReader();
  reader.onload = async (e: Event) => {
    const r = e.target as FileReader;
    const jsonStr: string = r.result as string;

    const serialized: ArchitectureMapJson = JSON.parse(jsonStr);

    if (TraceLog.IS_DEBUG) {
      TraceLog.d(TAG, "Imported JSON loaded.");
      console.log(serialized);
    }

    if (CONTEXT.allElements.length === 0) {
      // 1st load, load ALL elements including OutFrame.
      await CONTEXT.deserializeFromJsonAll(serialized);
      CONTEXT.recordLoadTotalJson();
    } else {
      const elements = await CONTEXT.deserializeFromJsonPartial(serialized);
      CONTEXT.recordAddElements(elements);
    }
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

async function showLoading(): Promise<void> {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "showLoading()");

  let ref: LoadingIndicator|null = null;
  ReactDOM.render(
      <LoadingIndicator
          ref={ (loadingIndicator) => { ref = loadingIndicator } }
      />,
      document.getElementById(OVERLAY_ROOT_ID));
  await ref!.shown();
}
(window as any).showLoading = showLoading;

function hideLoading() {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "hideLoading()");

  const container = document.getElementById(OVERLAY_ROOT_ID);
  if (container != null) {
    ReactDOM.unmountComponentAtNode(container);
  }
}
(window as any).hideLoading = hideLoading;

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

