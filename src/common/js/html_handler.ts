import * as $ from "jquery";

import { IS_DEBUG } from "./log";

export function getText(id: string): string|null {
  const value = $(`#${id}`).val();

  if (typeof(value) === "string") {
    if (value.length !== 0) {
      return value;
    } else {
      if (IS_DEBUG) console.log("input value is empty.");
      return null;
    }
  } else {
    console.log("ERR: input value is not string.");
    return null;
  }
}

export function setText(id: string, text: string) {
  const elm: JQuery<HTMLElement> = $(`#${id}`);
  if (elm !== undefined) {
    elm.text(text);
  }
}

