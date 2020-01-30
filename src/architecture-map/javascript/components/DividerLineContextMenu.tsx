import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";

interface Props {
  callback: DividerLineContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
}

export interface DividerLineContextMenuCallback {
  close(): void;
  changeColorSet(colorSet: ColorSet): void;
  moveToFrontEnd(): void;
  moveToBackEnd(): void;

}

export class DividerLineContextMenu extends React.Component<Props, State> {
  private readonly TAG = "DividerLineContextMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  private genClickButton(label: string, callback: () => void ) {
    return (
      <button
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
            className="layer-child background-gray"
            style={menuStyle}
            onClick={ handleContextMenuClick }
        >
          <table className="context-menu-contents" ><tbody>
            <tr>
              <td className="no-wrap" >Color Set</td>
              <td className="no-wrap" >
                {this.genClickButton("Gray",    () => { callback.changeColorSet(ColorSet.GRAY) })}
                {this.genClickButton("Orange",  () => { callback.changeColorSet(ColorSet.ORANGE) })}
                {this.genClickButton("Green",   () => { callback.changeColorSet(ColorSet.GREEN) })}
                {this.genClickButton("Blue",    () => { callback.changeColorSet(ColorSet.BLUE) })}
                {this.genClickButton("Yellow",  () => { callback.changeColorSet(ColorSet.YELLOW) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Z-Order</td>
              <td className="no-wrap" >
                {this.genClickButton("to Front End",  () => { callback.moveToFrontEnd() })}
                {this.genClickButton("to Back End",   () => { callback.moveToBackEnd() })}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
