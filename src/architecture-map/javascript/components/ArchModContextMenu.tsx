import * as React from "react";

import { TraceLog } from "../util/TraceLog";
import { ReactMouseEvent,
         ReactTextAreaChangeEvent,
         ReactInputChangeEvent,
         ReactKeyboardTextAreaEvent,
         ReactKeyboardInputEvent } from "../TypeDef";
import { Def, ClipArea, ColorSet, LineStyle } from "../Def";
import { genColorSetClickButtons,
         genEdgeLineStyleClickButtons,
         genClipAreaClickButtons,
         genLabelHorizontalAlignClickButtons,
         genLabelVerticalAlignClickButtons,
         genLabelRotClickButtons,
         genZOrderClickButtons } from "./Common";

interface Props {
  parentLabel: string,
  label: string,
  layerGroup: number,
  callback: ArchModContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
  currentLabel: string,
  labelError: string|null,
  currentLayerGroup: string,
}

export interface ArchModContextMenuCallback {
  close(): void;
  changeLabelRotDeg(rotDeg: number): void;
  changeLabelHorizontalAlign(align: string): void;
  changeLabelVerticalAlign(align: string): void;
  changeEdgeLineStyle(edgeLineStyle: LineStyle): void;
  changeClipArea(clipArea: ClipArea): void;
  changeColorSet(colorSet: ColorSet): void;
  changeEdgeColorSet(edgeColorSet: ColorSet): void;
  changeLayerGroup(layerGroup: number): void;
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
        currentLayerGroup: props.layerGroup.toString(),
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

      const newLabel = e.target.value;

      let isOk = false;
      if (this.props.label === newLabel) {
        // No changed.
        isOk = true;
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `Label is NOT changed.`);
      } else if (this.props.callback != null) {
        isOk = this.props.callback.canChangeLabel(newLabel);
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `Label Change OK/NG = ${isOk}, newLabel=${newLabel}`);
      }

      const error = isOk ? null : "ID is already exists.";
      this.setState( {
          currentLabel: newLabel,
          labelError: error,
      } );
    };

    const handleLayerGroupChanged = (e: ReactInputChangeEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onLayerGroupChanged()");
      e.stopPropagation();

      const newLayerGroup = parseInt(e.target.value);

      if ((typeof newLayerGroup === "number") && isFinite(newLayerGroup)) {
        // OK.

        if (this.props.layerGroup !== newLayerGroup) {
          this.props.callback.changeLayerGroup(newLayerGroup);
        }

      } else {
        if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `newLayerGroup is not a Number : ${newLayerGroup}`);
        // NOP.
      }

      this.setState( {
          currentLayerGroup: e.target.value,
      } );
    }

    const handleKeyDownUp = (e: ReactKeyboardTextAreaEvent|ReactKeyboardInputEvent) => {
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
              <td className="no-wrap" >Parent Modules</td>
              <td className="no-wrap" >
                <label>{this.props.parentLabel}</label>
              </td>
            </tr>
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
                {this.state.labelError && <span className="error-msg" >{this.state.labelError}</span>}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Layer Group</td>
              <td className="no-wrap" >
                <input
                    id="input_layer_group"
                    width={4}
                    value={this.state.currentLayerGroup}
                    onChange={ handleLayerGroupChanged }
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
              <td className="no-wrap" >Horizontal Label Align</td>
              <td className="no-wrap" >
                {genLabelHorizontalAlignClickButtons( (labelAlign: string) => { callback.changeLabelHorizontalAlign(labelAlign) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Vertical Label Align</td>
              <td className="no-wrap" >
                {genLabelVerticalAlignClickButtons( (labelAlign: string) => { callback.changeLabelVerticalAlign(labelAlign) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Edge Line Style</td>
              <td className="no-wrap" >
                {genEdgeLineStyleClickButtons( (edgeLineStyle: LineStyle) => { callback.changeEdgeLineStyle(edgeLineStyle) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Clip Area</td>
              <td className="no-wrap" >
                {genClipAreaClickButtons( (clipArea: ClipArea) => { callback.changeClipArea(clipArea) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Color Set</td>
              <td className="no-wrap" >
                {genColorSetClickButtons( (colorSet: ColorSet) => { callback.changeColorSet(colorSet) } )}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Edge Color Set</td>
              <td className="no-wrap" >
                {genColorSetClickButtons( (edgeColorSet: ColorSet) => { callback.changeEdgeColorSet(edgeColorSet) } )}
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
