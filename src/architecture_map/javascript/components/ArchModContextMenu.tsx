import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ClipArea } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { ColorResolver } from "../d3/resolver/ColorResolver.ts";

interface Props {
  idLabel: string,
  callback: ArchModContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
}

export interface ArchModContextMenuCallback {
  onOutsideClicked(): void;
  onLabelRotDegChanged(rotDeg: number): void;
  onClipAreaChanged(clipArea: ClipArea): void;
  onColorSetChanged(colorResolver: ColorResolver): void;

}

export class ArchModContextMenu extends React.Component<Props, State> {
  private readonly TAG = "ArchModContextMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  private onBackgroundClicked() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onBackgroundClicked()");
    this.props.callback.onOutsideClicked();
  }

  private onContextMenuClicked() {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
    // NOP.
  }

  private onLabelRotDegChanged(rotDeg: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `onLabelRotDegChanged() : rotDeg=${rotDeg}`);
    this.props.callback.onLabelRotDegChanged(rotDeg);
  }

  private onClipAreaChanged(clipArea: ClipArea) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `onClipAreaChanged() : ${clipArea}`);
    this.props.callback.onClipAreaChanged(clipArea);
  }

  private onColorSetChanged(colorResolver: ColorResolver) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `onColorSetChanged() : ${colorResolver}`);
    this.props.callback.onColorSetChanged(colorResolver);
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
        this.onBackgroundClicked();
        e.stopPropagation();
    };

    let handleContextMenuClick = (e: ReactMouseEvent) => {
        this.onContextMenuClicked();
        e.stopPropagation();
    };

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
              <td className="no-wrap" >{this.props.idLabel}</td>
            </tr>
            <tr>
              <td className="no-wrap" >Label Direction</td>
              <td className="no-wrap" >
                {this.genClickButton("Horizontal",  () => { this.onLabelRotDegChanged(Def.DEG_HORIZONTAL) })}
                {this.genClickButton("Vertical",    () => { this.onLabelRotDegChanged(Def.DEG_VERTICAL) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Clip Area</td>
              <td className="no-wrap" >
                {this.genClickButton("None",          () => { this.onClipAreaChanged(ClipArea.NONE) })}
                {this.genClickButton("Left-Top",      () => { this.onClipAreaChanged(ClipArea.LEFT_TOP) })}
                {this.genClickButton("Right-Top",     () => { this.onClipAreaChanged(ClipArea.RIGHT_TOP) })}
                {this.genClickButton("Left-Bottom",   () => { this.onClipAreaChanged(ClipArea.LEFT_BOTTOM) })}
                {this.genClickButton("Right-Bottom",  () => { this.onClipAreaChanged(ClipArea.RIGHT_BOTTOM) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >Color Set</td>
              <td className="no-wrap" >
                {this.genClickButton("Gray",    () => { this.onColorSetChanged(ColorSet.GRAY) })}
                {this.genClickButton("Orange",  () => { this.onColorSetChanged(ColorSet.ORANGE) })}
                {this.genClickButton("Green",   () => { this.onColorSetChanged(ColorSet.GREEN) })}
                {this.genClickButton("Blue",    () => { this.onColorSetChanged(ColorSet.BLUE) })}
                {this.genClickButton("Yellow",  () => { this.onColorSetChanged(ColorSet.YELLOW) })}
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
