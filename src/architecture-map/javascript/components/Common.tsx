import * as React from "react";

import { ReactMouseEvent } from "../TypeDef.ts";
import { ColorSet } from "../Def.ts";

export function genColorSetClickButtons(callback: (colorSet: ColorSet) => void): React.ReactElement[] {

  class Param {
    readonly id: string;
    readonly label: string;
    readonly colorSet: ColorSet;

    constructor(id: string, label: string, colorSet: ColorSet) {
      this.id = id;
      this.label = label;
      this.colorSet = colorSet;
    }
  }

  let buttonKey: number = 0;
  function genClickButton(id: string, label: string, callback: () => void ): React.ReactElement {
    return (
      <button
          key={buttonKey++}
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

  const params: Param[] = [
      //        id,                 label,    ColorSet,
      new Param("color_set_white",  "White",  ColorSet.WHITE),
      new Param("color_set_gray",   "Gray",   ColorSet.GRAY),
      new Param("color_set_orange", "Orange", ColorSet.ORANGE),
      new Param("color_set_green",  "Green",  ColorSet.GREEN),
      new Param("color_set_blue",   "Blue",   ColorSet.BLUE),
      new Param("color_set_yellow", "Yellow", ColorSet.YELLOW),
      new Param("color_set_purple", "Purple", ColorSet.PURPLE),
  ];

  const buttons: React.ReactElement[] = [];

  params.forEach( (param: Param) => {
    buttons.push( genClickButton(param.id, param.label, () => { callback(param.colorSet) }) );
  } );

  return buttons;
}

