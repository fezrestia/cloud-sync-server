import * as React from "react";

import { TraceLog } from "../util/TraceLog.ts";

import loading_spinner_icon from "../../image/loading_spinner_icon.png";

interface Props {
}

interface State {
}

export class LoadingIndicator extends React.Component<Props, State> {
  private readonly TAG = "LoadingIndicator";

  private refImg: HTMLImageElement|null = null;

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
        this.refImg.src = loading_spinner_icon;
      } else {
        reject();
      }
    } );
  }
}

