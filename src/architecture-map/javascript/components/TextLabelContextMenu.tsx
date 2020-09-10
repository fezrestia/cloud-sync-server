import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { ReactTextAreaChangeEvent } from "../TypeDef.ts";
import { ReactKeyboardTextAreaEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { genColorSetClickButtons,
         genLabelAlignClickButtons,
         genLabelRotClickButtons,
         genZOrderClickButtons } from "./Common";

interface Props {
  label: string,
  callback: TextLabelContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
  currentLabel: string,
}

export interface TextLabelContextMenuCallback {
  close(): void;
  changeLabelRotDeg(rotDeg: number): void;
  changeLabelAlign(align: string): void;
  changeColorSet(colorSet: ColorSet): void;
  moveToFrontEnd(): void;
  moveToBackEnd(): void;
  onLabelChanged(oldLaebl: string, newLabel: string): void;

}

export class TextLabelContextMenu extends React.Component<Props, State> {
  private readonly TAG = "TextLabelContextMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
        currentLabel: props.label,
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

      // Correction.
      const newLabel = this.state.currentLabel.trim();
      if (this.props.label !== newLabel) {
        this.props.callback.onLabelChanged(this.props.label, newLabel);
      }

      this.props.callback.close();
    };

    const handleContextMenuClick = (e: ReactMouseEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
      e.stopPropagation();
      // NOP.
    };

    const handleLabelChanged = (e: ReactTextAreaChangeEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onLabelChanged()");
      e.stopPropagation();

      this.setState( {
          currentLabel: e.target.value,
      } );
    };

    const handleKeyDownUp = (e: ReactKeyboardTextAreaEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onKeyDown/Up()");
      e.stopPropagation();
    }

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
              <td className="no-wrap" >Module ID Label</td>
              <td className="no-wrap" >
                <textarea
                    id="input_label"
                    cols={32}
                    rows={3}
                    value={this.state.currentLabel}
                    onChange={ handleLabelChanged }
                    onKeyDown={ handleKeyDownUp }
                    onKeyUp={ handleKeyDownUp }
                />
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Label Direction</td>
              <td className="no-wrap" >
                {genLabelRotClickButtons( (rotDeg: number) => { callback.changeLabelRotDeg(rotDeg) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Label Align</td>
              <td className="no-wrap" >
                {genLabelAlignClickButtons( (labelAlign: string) => { callback.changeLabelAlign(labelAlign) } )}
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
