import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";

interface Props {
  callback: ConnectorContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
}

export interface ConnectorContextMenuCallback {
  close(): void;
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

    let menuStyle = {
        left: this.props.leftPix,
        top: this.props.topPix,
    };

    let handleBackgroundClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onBackgroundClicked()");
      e.stopPropagation();

      this.props.callback.close();
    };

    let handleContextMenuClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
      e.stopPropagation();
      // NOP.
    };

    let callback = this.props.callback;

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
              <td className="no-wrap" >Color Set</td>
              <td className="no-wrap" >
                {this.genClickButton("color_set_gray",    "Gray",    () => { callback.changeColorSet(ColorSet.GRAY) })}
                {this.genClickButton("color_set_orange",  "Orange",  () => { callback.changeColorSet(ColorSet.ORANGE) })}
                {this.genClickButton("color_set_green",   "Green",   () => { callback.changeColorSet(ColorSet.GREEN) })}
                {this.genClickButton("color_set_blue",    "Blue",    () => { callback.changeColorSet(ColorSet.BLUE) })}
                {this.genClickButton("color_set_yellow",  "Yellow",  () => { callback.changeColorSet(ColorSet.YELLOW) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Z-Order</td>
              <td className="no-wrap" >
                {this.genClickButton("z_order_front", "to Front End",  () => { callback.moveToFrontEnd() })}
                {this.genClickButton("z_order_back", "to Back End",   () => { callback.moveToBackEnd() })}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
