import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { ReactInputChangeEvent } from "../TypeDef.ts";
import { ReactKeyboardInputEvent } from "../TypeDef.ts";
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

      // Correction.
      let newLabel = this.state.currentLabel.trim();
      if (this.props.label != newLabel) {
        this.props.callback.onLabelChanged(this.props.label, newLabel);
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
      if (this.props.label == newLabel) {
        // No changed.
        isOk = true;
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `Label is NOT changed.`);
      } else if (this.props.callback != null) {
        isOk = this.props.callback.canChangeLabel(newLabel);
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `Label Change OK/NG = ${isOk}, newLabel=${newLabel}`);
      }

      let error = isOk ? null : "ID is already exists.";
      this.setState( {
          currentLabel: newLabel,
          labelError: error,
      } );
    };

    let handleKeyDownUp = (e: ReactKeyboardInputEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onKeyDown/Up()");
      e.stopPropagation();
    }

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
              <td className="no-wrap" >Module ID Label</td>
              <td className="no-wrap" >
                <input
                    id="input_label"
                    type="text"
                    size={32}
                    value={this.state.currentLabel}
                    onChange={ handleLabelChanged }
                    onKeyDown={ handleKeyDownUp }
                    onKeyUp={ handleKeyDownUp }
                />
                {this.state.labelError && <span className="error-msg" >{this.state.labelError}</span>}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Label Direction</td>
              <td className="no-wrap" >
                {this.genClickButton("label_rot_horizontal",  "Horizontal",  () => { callback.changeLabelRotDeg(Def.DEG_HORIZONTAL) })}
                {this.genClickButton("label_rot_vertical",    "Vertical",    () => { callback.changeLabelRotDeg(Def.DEG_VERTICAL) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Clip Area</td>
              <td className="no-wrap" >
                {this.genClickButton("clip_area_none",          "None",          () => { callback.changeClipArea(ClipArea.NONE) })}
                {this.genClickButton("clip_area_left_top",      "Left-Top",      () => { callback.changeClipArea(ClipArea.LEFT_TOP) })}
                {this.genClickButton("clip_area_right_top",     "Right-Top",     () => { callback.changeClipArea(ClipArea.RIGHT_TOP) })}
                {this.genClickButton("clip_area_left_bottom",   "Left-Bottom",   () => { callback.changeClipArea(ClipArea.LEFT_BOTTOM) })}
                {this.genClickButton("clip_area_right_bottom",  "Right-Bottom",  () => { callback.changeClipArea(ClipArea.RIGHT_BOTTOM) })}
              </td>
            </tr>
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
                {this.genClickButton("z_order_back",  "to Back End",   () => { callback.moveToBackEnd() })}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
