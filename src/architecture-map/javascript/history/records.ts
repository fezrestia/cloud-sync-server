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

  export class MoveElement extends Record {
    private readonly TAG = "MoveElement";

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



}
