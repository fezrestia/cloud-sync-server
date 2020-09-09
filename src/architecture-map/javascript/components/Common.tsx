import * as React from "react";

import { ReactMouseEvent } from "../TypeDef.ts";
import { ColorSet } from "../Def.ts";
import { ColorResolver } from "../d3/resolver/ColorResolver";

export function genColorSetClickButtons(callback: (colorSet: ColorSet) => void): React.ReactElement[] {

  class Param {
    readonly id: string;
    readonly colorSet: ColorSet;

    constructor(id: string, colorSet: ColorSet) {
      this.id = id;
      this.colorSet = colorSet;
    }
  }

  let buttonKey: number = 0;
  function genClickButton(param: Param, callback: () => void ): React.ReactElement {
    const resolver: ColorResolver = ColorSet.resolve(param.colorSet);
    const style = {
      border: `2px solid ${resolver.stroke}`,
      backgroundColor: resolver.bg,
    };

    return (
      <div
          key={buttonKey++}
          id={param.id}
          className={"color-set-selector"}
          style={style}
          onClick={ (e: ReactMouseEvent) => {
            callback();
            e.stopPropagation();
          } }
      />
    );
  }

  const params: Param[] = [
      //        id,                     ColorSet,
      new Param("color_set_white",      ColorSet.WHITE),
      new Param("color_set_light_gray", ColorSet.LIGHT_GRAY),
      new Param("color_set_gray",       ColorSet.GRAY),
      new Param("color_set_red",        ColorSet.RED),
      new Param("color_set_orange",     ColorSet.ORANGE),
      new Param("color_set_yellow",     ColorSet.YELLOW),
      new Param("color_set_green",      ColorSet.GREEN),
      new Param("color_set_purple",     ColorSet.PURPLE),
      new Param("color_set_blue",       ColorSet.BLUE),
  ];

  const buttons: React.ReactElement[] = [];

  params.forEach( (param: Param) => {
    buttons.push( genClickButton(param, () => { callback(param.colorSet) }) );
  } );

  return buttons;
}

