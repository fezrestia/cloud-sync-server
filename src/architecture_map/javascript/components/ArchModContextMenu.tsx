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
    onLabelRotDegChanged(rotDeg: number): void;

}

export class ArchModContextMenu extends React.Component<Props, State> {
  private readonly TAG = "ArchModContextMenu";

  private static readonly DEG_HORIZONTAL = 0;
  private static readonly DEG_VERTICAL = 270;

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

  private onLabelRotDegChanged(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, rotDeg: number) {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, `onLabelRotDegChanged() : rotDeg=${rotDeg}`);
    this.props.callback.onLabelRotDegChanged(rotDeg);
    e.stopPropagation();
  }

  render() {

    let menuStyle = {
        left: this.props.leftPix,
        top: this.props.topPix,
    };

    let labelHorizontalCallback = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        this.onLabelRotDegChanged(e, ArchModContextMenu.DEG_HORIZONTAL);
    };
    let labelVerticalCallback = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        this.onLabelRotDegChanged(e, ArchModContextMenu.DEG_VERTICAL);
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
              <td className="no-wrap" >Label Direction</td>
              <td className="no-wrap" >
                <button onClick={ labelHorizontalCallback } >Horizontal</button>
                <button onClick={ labelVerticalCallback } >Vertical</button>
              </td>
            </tr>
          </tbody></table>
        </div>
      </div>
    );
  }
}
