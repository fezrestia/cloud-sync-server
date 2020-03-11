import { TraceLog } from "./util/TraceLog";
import { Def } from "./Def";
import { Connector } from "./d3/Connector";
import { ConnectorJson } from "./d3/Connector";
import { MarkerType } from "./d3/Marker";
import { Line } from "./d3/Line";
import { LineJson } from "./d3/Line";
import { ElementJson } from "./d3/Element";

// Convert old version JSON to latest.
export function convertJsonToLatest(serialized: any): any {
  const TAG = "JsonConverter";
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `convertJsonToLatest()`);

  let ver: number = Number(serialized[Def.KEY_VERSION]);
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `## Old Version = ${ver}`);

  // Update version.
  serialized[Def.KEY_VERSION] = Def.VAL_VERSION;

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

  return serialized;
}

