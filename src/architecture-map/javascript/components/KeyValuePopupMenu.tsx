import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { ReactKeyboardTextAreaEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";

interface Props {
  parentLabel: string,
  label: string,
  callback: KeyValuePopupMenuCallback,
  leftPix: number,
  topPix: number,
  keyValueList: { key: string, value: any }[],
}

interface State {
}

export interface KeyValuePopupMenuCallback {
  close(): void;

}

export class KeyValuePopupMenu extends React.Component<Props, State> {
  private readonly TAG = "KeyValuePopupMenu";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    const style = {
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

    const handleKeyDownUp = (e: ReactKeyboardTextAreaEvent) => {
      if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "onKeyDown/Up()");
      e.stopPropagation();
      // NOP.
    }

    const callback = this.props.callback;

    const contentTrs: any[] = [];
    contentTrs.push(
        <tr key={-1} >
          <td className="no-wrap" ><strong>{"Details"}</strong></td>
          <td></td>
        </tr>
    );
    this.props.keyValueList.forEach( (content: { key: string, value: any }, index: number) => {
      if (Array.isArray(content.value)) {
        const rowspan = content.value.length;

        content.value.forEach( (val: string, rowCount: number) => {
          if (rowCount == 0) {
            contentTrs.push(
              <tr key={`${index}-${rowCount}`} >
                <td className="no-wrap" rowSpan={rowspan} >{content.key}</td>
                <td className="no-wrap" >{val}</td>
              </tr>
            );
          } else {
            contentTrs.push(
              <tr key={`${index}-${rowCount}`} >
                <td className="no-wrap" >{val}</td>
              </tr>
            );
          }
        } );
      } else {
        contentTrs.push(
          <tr key={index} >
            <td className="no-wrap" >{content.key}</td>
            <td className="no-wrap" >{content.value}</td>
          </tr>
        );
      }
    } );

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
            style={style}
            onClick={ handleContextMenuClick }
        >
          <table className="context-menu-contents" ><tbody>
            {contentTrs}
          </tbody></table>
        </div>
      </div>
    );
  }
}
