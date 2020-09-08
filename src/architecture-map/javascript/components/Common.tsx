import * as React from "react";

import { ReactMouseEvent } from "../TypeDef.ts";
import { ColorSet } from "../Def.ts";

export function genColorSetClickButtons(callback: (colorSet: ColorSet) => void): any[] {

  function genClickButton(index: number, id: string, label: string, callback: () => void ): any {
    return (
      <button
          key={index}
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

  const colors = [
  //   id,                 label,    ColorSet,
      ["color_set_white",  "White",  ColorSet.WHITE],
      ["color_set_gray",   "Gray",   ColorSet.GRAY],
      ["color_set_orange", "Orange", ColorSet.ORANGE],
      ["color_set_green",  "Green",  ColorSet.GREEN],
      ["color_set_blue",   "Blue",   ColorSet.BLUE],
      ["color_set_yellow", "Yellow", ColorSet.YELLOW],
      ["color_set_purple", "Purple", ColorSet.PURPLE],
  ];

  const buttons: any[] = [];

  colors.forEach( (color, index: number) => {
    buttons.push( genClickButton(index, color[0], color[1], () => { callback(color[2] as ColorSet) }) );
  } );

  return buttons;
}

