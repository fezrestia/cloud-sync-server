import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { ReactInputChangeEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ClipArea } from "../Def.ts";
import { ColorSet } from "../Def.ts";

interface Props {
  label: string,
  callback: ArchModContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
  currentLabel: string,
  labelError: string|null,
}

export interface ArchModContextMenuCallback {
  close(): void;
  changeLabelRotDeg(rotDeg: number): void;
  changeClipArea(clipArea: ClipArea): void;
  changeColorSet(colorSet: ColorSet): void;
  moveToFrontEnd(): void;
  moveToBackEnd(): void;
  delete(): void;
  canChangeLabel(newLabel: string): boolean;
  onLabelChanged(oldLaebl: string, newLabel: string): void;

}

export class ArchModContextMenu extends React.Component<Props, State> {
  private readonly TAG = "ArchModContextMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
        currentLabel: props.label,
        labelError: null,
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

      if (this.state.labelError == null) {
        this.props.callback.onLabelChanged(this.props.label, this.state.currentLabel);
      }

      this.props.callback.close();
    };

    let handleContextMenuClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
      e.stopPropagation();
      // NOP.
    };

    let handleLabelChanged = (e: ReactInputChangeEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onLabelChanged()");
      e.stopPropagation();

      let newLabel = e.target.value;
      let isOk = false;
      if (this.props.callback != null) {
        isOk = this.props.callback.canChangeLabel(newLabel);
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `Label Change OK/NG = ${isOk}, newLabel=${newLabel}`);
      }

      let error = isOk ? null : "ID is already exists.";
      this.setState( {
          currentLabel: newLabel,
          labelError: error,
      } );
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
              <td className="no-wrap" >Module ID Label</td>
              <td className="no-wrap" >
                <input type="text" size={32} value={this.state.currentLabel} onChange={ handleLabelChanged } />
                {this.state.labelError && <span className="error-msg" >{this.state.labelError}</span>}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Label Direction</td>
              <td className="no-wrap" >
                {this.genClickButton("Horizontal",  () => { callback.changeLabelRotDeg(Def.DEG_HORIZONTAL) })}
                {this.genClickButton("Vertical",    () => { callback.changeLabelRotDeg(Def.DEG_VERTICAL) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Clip Area</td>
              <td className="no-wrap" >
                {this.genClickButton("None",          () => { callback.changeClipArea(ClipArea.NONE) })}
                {this.genClickButton("Left-Top",      () => { callback.changeClipArea(ClipArea.LEFT_TOP) })}
                {this.genClickButton("Right-Top",     () => { callback.changeClipArea(ClipArea.RIGHT_TOP) })}
                {this.genClickButton("Left-Bottom",   () => { callback.changeClipArea(ClipArea.LEFT_BOTTOM) })}
                {this.genClickButton("Right-Bottom",  () => { callback.changeClipArea(ClipArea.RIGHT_BOTTOM) })}
              </td>
            </tr>
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
            <tr>
              <td className="no-wrap" >Delete</td>
              <td className="no-wrap" >
                {this.genClickButton("DELETE", () => { callback.delete() })}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
