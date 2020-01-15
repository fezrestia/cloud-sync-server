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

  public static genTimestamp(): string {
    let now = new Date();

    function convNum2Str(num: number) {
      if (num.toString().length == 1) {
        return `0${num}`;
      } else {
        return num.toString();
      }
    }

    let Y: string = now.getFullYear().toString();
    let M: string = convNum2Str(now.getMonth() + 1);
    let D: string = convNum2Str(now.getDate());

    let h: string = convNum2Str(now.getHours());
    let m: string = convNum2Str(now.getMinutes());
    let s: string = convNum2Str(now.getSeconds());

    return `${Y}-${M}-${D}_${h}${m}${s}`;
  }

}
