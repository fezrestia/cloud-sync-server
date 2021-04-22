import * as React from "react";

import { TraceLog } from "../util/TraceLog";
import { ReactMouseEvent } from "../TypeDef";
import { Def, ColorSet, MarkerType } from "../Def";
import { genColorSetClickButtons,
         genZOrderClickButtons,
         genFromMarkerTypeClickButtons,
         genToMarkerTypeClickButtons } from "./Common";

interface Props {
  callback: ConnectorContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
}

export interface ConnectorContextMenuCallback {
  close(): void;
  changeFromMarkerType(markerType: MarkerType): void;
  changeToMarkerType(markerType: MarkerType): void;
  changeColorSet(colorSet: ColorSet): void;
  moveToFrontEnd(): void;
  moveToBackEnd(): void;

}

export class ConnectorContextMenu extends React.Component<Props, State> {
  private readonly TAG = "ConnectorContextMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  private genClickButton(id: string, label: string, callback: () => void ) {
    return (
      <button
          id={id}
          onClick={ (e: ReactMouseEvent) => {
            callback();
            e.stopPropagation();
          } }
      >
        {label}
      </button>
    );
  }

  render() {

    const menuStyle = {
        left: this.props.leftPix,
        top: this.props.topPix,
    };

    const handleBackgroundClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onBackgroundClicked()");
      e.stopPropagation();

      this.props.callback.close();
    };

    const handleContextMenuClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
      e.stopPropagation();
      // NOP.
    };

    const callback = this.props.callback;

    return (
      <div className="layer-parent match-parent" >
        {/* Background layer. */}
        <div
            className="layer-child match-parent"
            onClick={ handleBackgroundClick }
        >
        </div>

        {/* Context menu body. */}
        <div
            id="context_menu_body"
            className="layer-child background-gray"
            style={menuStyle}
            onClick={ handleContextMenuClick }
        >
          <table className="context-menu-contents" ><tbody>
            <tr>
              <td className="no-wrap" >FROM Marker</td>
              <td>
                {genFromMarkerTypeClickButtons( (markerType: MarkerType) => { callback.changeFromMarkerType(markerType) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >TO Marker</td>
              <td>
                {genToMarkerTypeClickButtons( (markerType: MarkerType) => { callback.changeToMarkerType(markerType) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Color Set</td>
              <td className="no-wrap" >
                {genColorSetClickButtons( (colorSet: ColorSet) => { callback.changeColorSet(colorSet) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Z-Order</td>
              <td className="no-wrap" >
                {genZOrderClickButtons( () => { callback.moveToFrontEnd() }, () => { callback.moveToBackEnd() } )}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
