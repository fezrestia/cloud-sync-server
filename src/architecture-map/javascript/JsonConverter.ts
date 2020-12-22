import { TraceLog } from "./util/TraceLog";
import { Def, MarkerType } from "./Def";
import { Connector } from "./d3/Connector";
import { ConnectorJson } from "./d3/Connector";
import { Line } from "./d3/Line";
import { LineJson } from "./d3/Line";
import { ElementJson } from "./d3/Element";
import { OutFrame } from "./d3/OutFrame";
import { ArchMod } from "./d3/ArchMod";
import { ArchModJson } from "./d3/ArchMod";

// Convert old version JSON to latest.
export function convertJsonToLatest(serialized: any): any {
  const TAG = "JsonConverter";
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `convertJsonToLatest()`);

  let ver: number = Number(serialized[Def.KEY_VERSION]);
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `## Old Version = ${ver}`);

  // Update version.
  serialized[Def.KEY_VERSION] = Def.VAL_VERSION;

  let outFrame = serialized[Def.KEY_OUT_FRAME];
  let elements = serialized[Def.KEY_ARCHITECTURE_MAP];

  // Add UID.
  if (ver < 3) {
    let uid: number = 1;
    elements.forEach( (element: ElementJson) => {
      element[Def.KEY_UID] = uid;
      uid++;
    } );
  }

  // Add ConnectorEnd.
  if (ver < 5) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "Connector") {
        let connJson = element as any;
        connJson["from_connector_end"] = "none";
        connJson["to_connector_end"] = "none";
      }
    } );
  }

  // Convert DividerLine to Line.
  if (ver < 6) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "DividerLine") {
        element[Def.KEY_CLASS] = "Line";
      }
    } );
  }

  // Convert ConnectorEnd to MarkerType.
  if (ver < 7) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "Connector") {
        let connJson = element as any;
        connJson[Def.KEY_FROM_MARKER_TYPE] = connJson["from_connector_end"];
        connJson[Def.KEY_TO_MARKER_TYPE] = connJson["to_connector_end"];
        delete connJson["from_connector_end"];
        delete connJson["to_connector_end"];

      }
      if (element[Def.KEY_CLASS] == "Line") {
        let lineJson = element as any;
        lineJson["from_marker_type"] = "none";
        lineJson["to_marker_type"] = "none";

      }

    } );
  }

  // Add line_Style to Line.
  if (ver < 8) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "Line") {
        let lineJson = element as any;
        lineJson[Def.KEY_LINE_STYLE] = "normal";
      }
    } );
  }

  // Add parent_uid to ArchMod.
  if (ver < 10) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "ArchMod") {
        let archModJson = element as any;
        archModJson[Def.KEY_PARENT_UID] = null;
      }
    } );
  }

  // Add edge_color_set to ArchMod.
  if (ver < 11) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == "ArchMod") {
        let archModJson = element as any;
        archModJson[Def.KEY_EDGE_COLOR_SET] = archModJson[Def.KEY_COLOR_SET];
      }
    } );
  }

  // Convert label_align to label_horizontal_align/label_vertical_align in ArchMod and TextLabel.
  if (ver < 12) {
    elements.forEach( (element: ElementJson) => {
      const clazz = element[Def.KEY_CLASS];
      if (clazz == "ArchMod" || clazz == "TextLabel") {
        let json = element as any;
        json[Def.KEY_DIMENS][Def.KEY_LABEL_HORIZONTAL_ALIGN] = "center";
        json[Def.KEY_DIMENS][Def.KEY_LABEL_VERTICAL_ALIGN] = json[Def.KEY_DIMENS][Def.KEY_LABEL_ALIGN];
        delete json[Def.KEY_DIMENS][Def.KEY_LABEL_ALIGN];
      }
    } );
  }

  // Add z_order to Element based instances.
  if (ver < 13) {
    outFrame[Def.KEY_UID] = Def.UID_OUT_FRAME;
    outFrame[Def.KEY_CLASS] = OutFrame.TAG;
    const outFrameX = outFrame[Def.KEY_X];
    const outFrameY = outFrame[Def.KEY_Y];
    const outFrameWidth = outFrame[Def.KEY_WIDTH];
    const outFrameHeight = outFrame[Def.KEY_HEIGHT];
    outFrame[Def.KEY_DIMENS] = {
        [Def.KEY_X]: outFrameX,
        [Def.KEY_Y]: outFrameY,
        [Def.KEY_WIDTH]: outFrameWidth,
        [Def.KEY_HEIGHT]: outFrameHeight,
        [Def.KEY_Z_ORDER]: Def.Z_ORDER_OUT_FRAME,
    };
    delete outFrame[Def.KEY_X];
    delete outFrame[Def.KEY_Y];
    delete outFrame[Def.KEY_WIDTH];
    delete outFrame[Def.KEY_HEIGHT];

    let zOrder = Def.START_OF_Z_ORDER;
    elements.forEach( (json: ElementJson) => {
      json[Def.KEY_DIMENS][Def.KEY_Z_ORDER] = zOrder;
      zOrder++;
    } );
  }

  // Add hierarchy_depth to ArchMod.
  if (ver < 14) {
    elements.forEach( (json: ElementJson) => {
      if (json[Def.KEY_CLASS] === ArchMod.TAG) {
        const archModJson = json as ArchModJson;
        let depth = Def.TOP_LAYER_DEPTH;
        let parentUid: number|null = archModJson[Def.KEY_PARENT_UID];

        while (parentUid != null) {
          const parentJson = queryUid(elements, parentUid) as ArchModJson;
          parentUid = parentJson[Def.KEY_PARENT_UID];
          depth++;
        }

        archModJson[Def.KEY_HIERARCHY_DEPTH] = depth;
      }
    } );
  }

  return serialized;
}

function queryUid(elementJsons: ElementJson[], uid: number): ElementJson {
  return elementJsons.find( (json: ElementJson) => json[Def.KEY_UID] === uid ) as ElementJson;
}

