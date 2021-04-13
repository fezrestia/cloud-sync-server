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

  class AddNewElement extends Record {
    private newElement: Element;
    private newElementJson: ElementJson;

    constructor(context: Context, newElement: Element) {
      super(context);
      this.newElement = newElement;
      this.newElementJson = newElement.serialize();
    }

    // @Override
    async undo() {
      this.context.resetAllState();
      this.context.onMultiSelected(this.newElement); // Use this only to select without callback.
      this.context.deleteSelected();
    }

    // @Override
    async redo() {
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
          console.log(this.newElement);
          return;
      }
    }
  }



}

