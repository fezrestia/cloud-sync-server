import { TraceLog } from "./util/TraceLog";
import { Def } from "./Def";
import { Connector } from "./d3/Connector";
import { ConnectorEnd } from "./Def";
import { Line } from "./d3/Line";

// Convert old version JSON to latest.
export function convertJsonToLatest(serialized: any): any {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `convertJsonToLatest()`);

  let ver: number = Number(serialized[Def.KEY_VERSION]);
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `## Old Version = ${ver}`);

  // Update version.
  serialized[Def.KEY_VERSION] = Def.VAL_VERSION;

  let elements = serialized[Def.KEY_ARCHITECTURE_MAP];

  // Add UID.
  if (ver < 3) {
    let uid: number = 1;
    elements.forEach( (element) => {
      element[Def.KEY_UID] = uid;
      uid++;
    } );
  }

  // Add ConnectorEnd.
  if (ver < 5) {
    elements.forEach( (element: ElementJson) => {
      if (element[Def.KEY_CLASS] == Connector.TAG) {
        let connJson = element as ConnectorJson;
        connJson[Def.KEY_FROM_CONNECTOR_END] = ConnectorEnd.NONE;
        connJson[Def.KEY_TO_CONNECTOR_END] = ConnectorEnd.NONE;
      }
    } );
  }

  // Convert DividerLine to Line.
  if (ver < 6) {
    elements.forEach( (element) => {
      if (element[Def.KEY_CLASS] == "DividerLine") {
        element[Def.KEY_CLASS] = Line.TAG;
      }
    } );
  }

  return serialized;
}

