import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";

import loading_spinner_icon from "architecture-map/image/loading_spinner_icon.png";

interface Props {
}

interface State {
}

export class LoadingIndicator extends React.Component<Props, State> {
  private readonly TAG = "LoadingIndicator";

  private refImg: HTMLImageElement|null = null;

  private static readonly LOADING_ICON = "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";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <div
          id={"loading_indicator"}
      >
        <img
            id={"loading_spinner_icon"}
            ref={ (img: HTMLImageElement) => { this.refImg = img } }
        />
      </div>
    );
  }

  public async shown(): Promise<void> {
    if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "shown()");

    return new Promise( (resolve: () => void, reject: () => void) => {
      if (this.refImg != null) {
        this.refImg.addEventListener("load", () => {
          if (TraceLog.IS_DEBUG) TraceLog.d(this.TAG, "shown() : DONE");
          resolve();
        } );

        // WORKAROUND:
        //   Use BASE64 encoded PNG image instead of URL
        //   to support offline mode on one HTML package.
//        this.refImg.src = loading_spinner_icon;
        this.refImg.src = `data:image/png;base64,${LoadingIndicator.LOADING_ICON}`;

      } else {
        reject();
      }
    } );
  }
}

