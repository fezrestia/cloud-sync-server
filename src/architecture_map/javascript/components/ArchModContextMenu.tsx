import * as React from "react";
import { TraceLog } from "../util/TraceLog.ts";

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
    onRotateLabel(direction: string): void;

}

export class ArchModContextMenu extends React.Component<Props, State> {
  private readonly TAG = "ArchModContextMenu";
  public static readonly ROT_CW = "cw";
  public static readonly ROT_CCW = "ccw";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  private onBackgroundClicked(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onBackgroundClicked()");
    this.props.callback.onOutsideClicked();
    e.stopPropagation();
  }

  private onContextMenuClicked(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onContextMenuClicked()");
    // NOP.
    e.stopPropagation();
  }

  private onRotLabelCwClicked(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onRotLabelCwClicked()");
    this.props.callback.onRotateLabel(ArchModContextMenu.ROT_CW);
    e.stopPropagation();
  }

  private onRotLabelCcwClicked(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onRotLabelCcwClicked()");
    this.props.callback.onRotateLabel(ArchModContextMenu.ROT_CCW);
    e.stopPropagation();
  }

  render() {

    let menuStyle = {
        left: this.props.leftPix,
        top: this.props.topPix,
    };

    return (
      <div className="layer-parent match-parent" >
        {/* Background layer. */}
        <div
            className="layer-child match-parent"
            onClick={ (e) => this.onBackgroundClicked(e) }
        >
        </div>

        {/* Context menu body. */}
        <div
            className="layer-child background-gray"
            style={menuStyle}
            onClick={ (e) => this.onContextMenuClicked(e) }
        >
          <table className="context-menu-contents" ><tbody>
            <tr>
              <td className="no-wrap" >Module ID Label</td>
              <td className="no-wrap" >{this.props.idLabel}</td>
            </tr>
            <tr>
              <td className="no-wrap" >Rotate Label</td>
              <td className="no-wrap" >
                <button onClick={ (e) => this.onRotLabelCwClicked(e) } >CW</button>
                <button onClick={ (e) => this.onRotLabelCcwClicked(e) } >CCW</button>
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
