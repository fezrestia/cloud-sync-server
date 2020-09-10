import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";
import { ReactMouseEvent } from "../TypeDef.ts";
import { Def } from "../Def.ts";
import { ColorSet } from "../Def.ts";
import { MarkerType } from "../d3/Marker";
import { LineStyle } from "../d3/Line";
import { genColorSetClickButtons, genZOrderClickButtons } from "./Common";

interface Props {
  callback: LineContextMenuCallback,
  leftPix: number,
  topPix: number,
}

interface State {
}

export interface LineContextMenuCallback {
  close(): void;
  changeLineStyle(lineStyle: LineStyle): void;
  changeFromMarkerType(markerType: MarkerType): void;
  changeToMarkerType(markerType: MarkerType): void;
  changeColorSet(colorSet: ColorSet): void;
  moveToFrontEnd(): void;
  moveToBackEnd(): void;

}

export class LineContextMenu extends React.Component<Props, State> {
  private readonly TAG = "LineContextMenu";

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

    const menuStyle = {
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
              <td className="no-wrap" >Line Style</td>
              <td>
                {this.genClickButton("line_style_normal", "Normal", () => { callback.changeLineStyle(LineStyle.NORMAL) })}
                {this.genClickButton("line_style_broken", "Broken", () => { callback.changeLineStyle(LineStyle.BROKEN) })}
                {this.genClickButton("line_style_dotted", "Dotted", () => { callback.changeLineStyle(LineStyle.DOTTED) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >FROM Marker</td>
              <td>
                {this.genClickButton("from_marker_type_none",   "None",   () => { callback.changeFromMarkerType(MarkerType.NONE) })}
                {this.genClickButton("from_marker_type_arrow",  "Arrow",  () => { callback.changeFromMarkerType(MarkerType.ARROW) })}
                {this.genClickButton("from_marker_type_rect",   "Rect",   () => { callback.changeFromMarkerType(MarkerType.RECT) })}
              </td>
            </tr>
            <tr>
              <td className="no-wrap" >TO Marker</td>
              <td>
                {this.genClickButton("to_marker_type_none",   "None",   () => { callback.changeToMarkerType(MarkerType.NONE) })}
                {this.genClickButton("to_marker_type_arrow",  "Arrow",  () => { callback.changeToMarkerType(MarkerType.ARROW) })}
                {this.genClickButton("to_marker_type_rect",   "Rect",   () => { callback.changeToMarkerType(MarkerType.RECT) })}
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
