import * as React from "react";

export class Util {
  public static convertCrLf2Br(crlf: string): JSX.Element {
    let lines: JSX.Element[] = crlf.split("\n").map(
        (line: string, i: number) => {
          return (
              <span key={i} >{line}<br /></span>
          );
        }
    );

    return (
        <div>
          {lines}
        </div>
    );
  }
}
