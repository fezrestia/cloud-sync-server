import * as React from "react";

export class Util {
  public static convertCrLf2Br(crlf: string): JSX.Element {
    const lines: JSX.Element[] = crlf.split("\n").map(
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
    const now = new Date();

    function convNum2Str(num: number) {
      if (num.toString().length === 1) {
        return `0${num}`;
      } else {
        return num.toString();
      }
    }

    const Y: string = now.getFullYear().toString();
    const M: string = convNum2Str(now.getMonth() + 1);
    const D: string = convNum2Str(now.getDate());

    const h: string = convNum2Str(now.getHours());
    const m: string = convNum2Str(now.getMinutes());
    const s: string = convNum2Str(now.getSeconds());

    return `${Y}-${M}-${D}_${h}${m}${s}`;
  }

  public static uniqArray(array: any[]): any[] {
    const uniqElements = new Set();
    array.forEach( (element) => {
      uniqElements.add(element);
    } );
    return Array.from(uniqElements);
  }

  public static escapeHtml(html: string): string {
    html = html.replace(/&/gi, "&amp;");
    html = html.replace(/>/gi, "&gt;");
    html = html.replace(/</gi, "&lt;");
    html = html.replace(/"/gi, "&quot;");
    html = html.replace(/'/gi, "&#x27;");
    html = html.replace(/`/gi, "&#x60;");
    return html;
  }

  public static async timeslice<T>(proc: () => T): Promise<T> {
    return new Promise( (resolve, reject) => {
      setTimeout( () => {
        const result = proc();
        resolve(result);
      } );
    } );
  }
}
