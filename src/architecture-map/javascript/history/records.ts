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

  export class AddNewElement extends Record {
    private readonly TAG = "AddNewElement";

    private newElementUid: number;
    private newElementJson: ElementJson;

    constructor(context: Context, newElement: Element) {
      super(context);

      // Store primitive data (number and string) here because
      // Object instance will be dead if total json history record is used.
      this.newElementUid = newElement.uid;
      this.newElementJson = newElement.serialize();
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      const target = this.context.queryElementUid(this.newElementUid);

      this.context.resetAllState();
      this.context.onMultiSelected(target); // Use this only to select without callback.
      this.context.deleteSelected();
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      switch (this.newElementJson[Def.KEY_CLASS]) {
        case ArchMod.TAG:
          this.context.deserializeArchMod(this.newElementJson as ArchModJson);
          break;

        case TextLabel.TAG:
          this.context.deserializeTextLabel(this.newElementJson as TextLabelJson);
          break;

        case Line.TAG:
          this.context.deserializeLine(this.newElementJson as LineJson);
          break;

        case Connector.TAG:
          this.context.deserializeConnector(this.newElementJson as ConnectorJson);
          break;

        default:
          TraceLog.e(TAG, `Unexpected Element:`);
          console.log(this.newElementJson);
          return;
      }
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
    private beforeJson: ElementJson;
    private afterJson: ElementJson;
    private zDiff: number;

    constructor(context: Context, afterElement: Element) {
      super(context);

      this.uid = afterElement.uid;
      this.afterJson = afterElement.serialize();
      this.beforeJson = context.queryUidOnHistoryBaseJson(this.uid);

      const afterZ = this.afterJson[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      const beforeZ = this.beforeJson[Def.KEY_DIMENS][Def.KEY_Z_ORDER];
      this.zDiff = afterZ - beforeZ;
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      const target: Element = this.context.queryElementUid(this.uid);
      const steps = Math.abs(this.zDiff);

      if (this.zDiff < 0) {
        target.moveUp(steps);
        this.context.moveUpElement(target, steps);
      }
      if (this.zDiff > 0) {
        target.moveDown(steps);
        this.context.moveDownElement(target, steps);
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
      const steps = Math.abs(this.zDiff);

      if (this.zDiff < 0) {
        target.moveDown(steps);
        this.context.moveDownElement(target, steps);
      }
      if (this.zDiff > 0) {
        target.moveUp(steps);
        this.context.moveUpElement(target, steps);
      }

      target.deserialize(this.afterJson);

      if (target.TAG === ArchMod.TAG) {
        this.context.updateConnectorsRelatedTo(target as ArchMod);
      }

      this.context.relayout();
    }
  }

  export class PasteElements extends Record {
    private readonly TAG = "PasteElements";

    private newElementUids: number[] = [];
    private newElementUidVsJson: Map<number, ElementJson> = new Map();

    constructor(context: Context, newElements: Element[]) {
      super(context);

      // Store primitive data (number and string) here because
      // Object instance will be dead if total json history record is used.
      newElements.forEach( (element: Element) => {
        this.newElementUids.push(element.uid);
        this.newElementUidVsJson.set(element.uid, element.serialize());
      } );
    }

    // @Override
    async undo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `undo()`);

      this.context.resetAllState();

      this.newElementUids.forEach( (uid: number) => {
        const target = this.context.queryElementUid(uid);
        this.context.onMultiSelected(target); // Use this only to select without callback.
      } );

      this.context.deleteSelected();
    }

    // @Override
    async redo() {
      if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `redo()`);

      this.newElementUids.forEach( (uid: number) => {
        const json: ElementJson = this.newElementUidVsJson.get(uid) as ElementJson;

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



}

