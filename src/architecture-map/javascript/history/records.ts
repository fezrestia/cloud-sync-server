import { Def } from "../Def";
import { TraceLog } from "../util/TraceLog";
import { Context, ArchitectureMapJson } from "../packs/architecture_map";
import { Element, ElementJson } from "../d3/Element";
import { ArchMod, ArchModJson } from "../d3/ArchMod";
import { TextLabel, TextLabelJson } from "../d3/TextLabel";
import { Line, LineJson } from "../d3/Line";
import { Connector, ConnectorJson } from "../d3/Connector";

const TAG = "History.Record";

export module History {

  export abstract class Record {
    protected readonly context: Context;

    constructor(context: Context) {
      this.context = context;
    }

    abstract undo(): void;
    abstract redo(): void;
  }

  export class UpdateTotalJson extends Record {
    private oldTotalJson: ArchitectureMapJson;
    private newTotalJson: ArchitectureMapJson;

    constructor(
        context: Context,
        oldTotalJson: ArchitectureMapJson,
        newTotalJson: ArchitectureMapJson) {
      super(context);
      this.oldTotalJson = oldTotalJson;
      this.newTotalJson = newTotalJson;
    }

    // @Override
    async undo() {
      this.context.resetAllState();
      await this.context.recoverJson(this.oldTotalJson);
    }

    // @Override
    async redo() {
      this.context.resetAllState();
      await this.context.recoverJson(this.newTotalJson);
    }
  }

  export class AddElements extends Record {
    private readonly TAG = "AddElements";

    private addElementUids: number[] = [];
    private addElementUidVsJson: Map<number, ElementJson> = new Map();

    constructor(context: Context, addElements: Element[]) {
      super(context);

      // Store primitive data (number and string) here because
      // Object instance will be dead if total json history record is used.
      addElements.forEach( (element: Element) => {
        this.addElementUids.push(element.uid);
        this.addElementUidVsJson.set(element.uid, element.serialize());
      } );
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      this.context.resetAllState();

      this.addElementUids.forEach( (uid: number) => {
        const target = this.context.queryElementUid(uid);
        this.context.onMultiSelected(target); // Use this only to select without callback.
      } );

      this.context.deleteSelected();
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      this.addElementUids.forEach( (uid: number) => {
        const json: ElementJson = this.addElementUidVsJson.get(uid) as ElementJson;

        switch (json[Def.KEY_CLASS]) {
          case ArchMod.TAG:
            this.context.deserializeArchMod(json as ArchModJson);
            break;

          case TextLabel.TAG:
            this.context.deserializeTextLabel(json as TextLabelJson);
            break;

          case Line.TAG:
            this.context.deserializeLine(json as LineJson);
            break;

          case Connector.TAG:
            this.context.deserializeConnector(json as ConnectorJson);
            break;

          default:
            TraceLog.e(TAG, `Unexpected Element:`);
            console.log(json);
            return;
        }
      } );
    }
  }

  export class DeleteElements extends Record {
    private readonly TAG = "DeleteElements";

    private delElementUids: number[] = [];
    private delElementUidVsJson: Map<number, ElementJson> = new Map();
    private delElementUidVsTopUid: Map<number, number|null> = new Map();

    constructor(context: Context, delElements: Element[]) {
      super(context);

      // Store primitive data (number and string) here because
      // Object instance will be dead if total json history record is used.
      delElements.forEach( (element: Element) => {
        this.delElementUids.push(element.uid);

        const json: ElementJson = element.serialize();
        this.delElementUidVsJson.set(element.uid, json);

        // Store Z-Order.
        const z: number = json[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
        const topZ = z + 1;

        let topUid: number|null = null;
        this.context.forEachAllElements( (elm: Element) => {
          if (elm.zOrder === topZ) {
            topUid = elm.uid;
          }
        } );
        this.delElementUidVsTopUid.set(element.uid, topUid);
      } );
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      const elementJsons: ElementJson[] = [];
      this.delElementUids.forEach( (uid: number) => {
        const json: ElementJson = this.delElementUidVsJson.get(uid) as ElementJson;
        elementJsons.push(json);
      } );

      // from Top to Bottom.
      function compare(a: ElementJson, b: ElementJson): number {
        const aZ: number = a[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
        const bZ: number = b[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
        return bZ - aZ;
      }
      const sortedElementJsons: ElementJson[] = elementJsons.sort(compare);

      sortedElementJsons.forEach( (json: ElementJson) => {
        let elm: Element;
        switch (json[Def.KEY_CLASS]) {
          case ArchMod.TAG:
            elm = this.context.deserializeArchMod(json as ArchModJson);
            break;

          case TextLabel.TAG:
            elm = this.context.deserializeTextLabel(json as TextLabelJson);
            break;

          case Line.TAG:
            elm = this.context.deserializeLine(json as LineJson);
            break;

          case Connector.TAG:
            elm = this.context.deserializeConnector(json as ConnectorJson);
            break;

          default:
            TraceLog.e(TAG, `Unexpected Element:`);
            console.log(json);
            return;
        }

        // Modify Z-Order.
        const topUid: number|null|undefined = this.delElementUidVsTopUid.get(elm.uid);
        if (topUid === undefined) {
          TraceLog.e(TAG, `undo() : Unexpected elm.uid = ${elm.uid}`);
        } else if (topUid === null) {
          // NOP, this element is top element.
        } else {
          const topElm: Element = this.context.queryElementUid(topUid);
          elm.moveToBottomOf(topElm);
          this.context.moveElementToBottomOf(elm, topElm);
        }
      } );

      this.context.relayout();
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      this.context.resetAllState();

      this.delElementUids.forEach( (uid: number) => {
        const target = this.context.queryElementUid(uid);
        this.context.onMultiSelected(target); // Use this only to select without callback.
      } );

      this.context.deleteSelected();

      this.context.relayout();
    }
  }

  export class MoveElements extends Record {
    private readonly TAG = "MoveElements";

    private elementUids: number[] = [];
    private totalPlusX: number;
    private totalPlusY: number;

    constructor(context: Context, elements: Element[], totalPlusX: number, totalPlusY: number) {
      super(context);

      // Store primitive data here because
      // Object instance will be dead if total json history record is used.
      elements.forEach( (elm: Element) => {
        this.elementUids.push(elm.uid);
      } );
      this.totalPlusX = totalPlusX;
      this.totalPlusY = totalPlusY;
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      this.elementUids.forEach( (uid: number) => {
        const target = this.context.queryElementUid(uid);
        target.move(-1 * this.totalPlusX, -1 * this.totalPlusY);

        if (target.TAG === ArchMod.TAG) {
          this.context.updateConnectorsRelatedTo(target as ArchMod);
        }
      } );
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      this.elementUids.forEach( (uid: number) => {
        const target = this.context.queryElementUid(uid);
        target.move(this.totalPlusX, this.totalPlusY);

        if (target.TAG === ArchMod.TAG) {
          this.context.updateConnectorsRelatedTo(target as ArchMod);
        }
      } );
    }
  }

  export class ChangeOutFrameSize extends Record {
    private readonly TAG = "ChangeOutFrameSize";

    private beforeWidth: number;
    private beforeHeight: number;
    private afterWidth: number;
    private afterHeight: number;

    constructor(
        context: Context,
        beforeWidth: number,
        beforeHeight: number,
        afterWidth: number,
        afterHeight: number) {
      super(context);

      this.beforeWidth = beforeWidth;
      this.beforeHeight = beforeHeight;
      this.afterWidth = afterWidth;
      this.afterHeight = afterHeight;
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      this.context.outFrame.setWH(this.beforeWidth, this.beforeHeight);
      this.context.outFrame.relayout();
      this.context.changeOutFrameSize(this.beforeWidth, this.beforeHeight);
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      this.context.outFrame.setWH(this.afterWidth, this.afterHeight);
      this.context.outFrame.relayout();
      this.context.changeOutFrameSize(this.afterWidth, this.afterHeight);
    }
  }

  export class ChangeElementJson extends Record {
    private readonly TAG = "ChangeElementJson";

    private uid: number;

    private afterJson: ElementJson;
    private beforeJson: ElementJson;

    private afterBottomUid: number = 0;
    private afterTopUid: number = 0;

    private beforeBottomUid: number = 0;
    private beforeTopUid: number = 0;

    // zDiff > 0 : raised, zDiff < 0 : lowered.
    private zDiff: number;

    constructor(context: Context, afterElement: Element) {
      super(context);

      this.uid = afterElement.uid;
      this.afterJson = afterElement.serialize();
      this.beforeJson = context.queryUidOnHistoryBaseJson(this.uid);

      // Store Z-Order.
      const afterZ: number = this.afterJson[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      const afterBottomZ = afterZ - 1;
      const afterTopZ = afterZ + 1;
      this.context.forEachAllElements( (elm: Element) => {
        switch (elm.zOrder) {
          case afterBottomZ:
            this.afterBottomUid = elm.uid;
            break;

          case afterTopZ:
            this.afterTopUid = elm.uid;
            break;

          default:
            // NOP.
            break;
        }
      } );

      const beforeZ: number = this.beforeJson[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      const beforeBottomZ = beforeZ - 1;
      const beforeTopZ = beforeZ + 1;
      this.context.forEachAllHistoryElementJsons( (json: ElementJson) => {
        switch (json[Def.KEY_DIMENS][Def.KEY_Z_ORDER]) {
          case beforeBottomZ:
            this.beforeBottomUid = json[Def.KEY_UID];
            break;

          case beforeTopZ:
            this.beforeTopUid = json[Def.KEY_UID];
            break;

          default:
            // NOP.
            break;
        }
      } );

      this.zDiff = afterZ - beforeZ;
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      const target: Element = this.context.queryElementUid(this.uid);

      if (this.zDiff < 0) {
        // Undo lowered. Move to top of before bottom element.

        const beforeBottomElm: Element = this.context.queryElementUid(this.beforeBottomUid);
        target.moveToTopOf(beforeBottomElm);
        this.context.moveElementToTopOf(target, beforeBottomElm);
      }
      if (this.zDiff > 0) {
        // Undo raised. Move to bottom of before top element.

        const beforeTopElm: Element = this.context.queryElementUid(this.beforeTopUid);
        target.moveToBottomOf(beforeTopElm);
        this.context.moveElementToBottomOf(target, beforeTopElm);
      }

      target.deserialize(this.beforeJson);

      if (target.TAG === ArchMod.TAG) {
        this.context.updateConnectorsRelatedTo(target as ArchMod);
      }

      this.context.relayout();
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      const target: Element = this.context.queryElementUid(this.uid);

      if (this.zDiff < 0) {
        // Redo lowered. Move to bottom of after top element.

        const afterTopElm: Element = this.context.queryElementUid(this.afterTopUid);
        target.moveToBottomOf(afterTopElm);
        this.context.moveElementToBottomOf(target, afterTopElm);
      }
      if (this.zDiff > 0) {
        // Redo raised. Move to top of after bottom element.

        const afterBottomElm: Element = this.context.queryElementUid(this.afterBottomUid);
        target.moveToTopOf(afterBottomElm);
        this.context.moveElementToTopOf(target, afterBottomElm);
      }

      target.deserialize(this.afterJson);

      if (target.TAG === ArchMod.TAG) {
        this.context.updateConnectorsRelatedTo(target as ArchMod);
      }

      this.context.relayout();
    }
  }



}

