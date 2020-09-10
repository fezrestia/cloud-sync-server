import * as React from "react";

import { ReactMouseEvent } from "../TypeDef.ts";
import { ColorSet, ClipArea } from "../Def.ts";
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
  function genClickButton(param: Param, cb: () => void ): React.ReactElement {
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
            cb();
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

export function genClipAreaClickButtons(callback: (clipArea: ClipArea) => void): React.ReactElement[] {
  class Param {
    readonly id: string;
    readonly clipArea: ClipArea;

    constructor(id: string, clipArea: ClipArea) {
      this.id = id;
      this.clipArea = clipArea;
    }
  }

  let buttonKey: number = 0;
  function genClickButton(param: Param, callback: (clipArea: ClipArea) => void ): React.ReactElement {
    const SIZE = 24;
    const CENTER = SIZE / 2;

    let points: string = "";
    switch(param.clipArea) {
      case ClipArea.NONE:
        // fall-through.
      default:
        points = `0,0 ${SIZE},0 ${SIZE},${SIZE} 0,${SIZE} 0,0`;
        break;

      case ClipArea.LEFT_TOP:
        points = `${CENTER},${CENTER} ${CENTER},0 ${SIZE},0 ${SIZE},${SIZE} 0,${SIZE} 0,${CENTER} ${CENTER},${CENTER}`;
        break;

      case ClipArea.RIGHT_TOP:
        points = `0,0 ${CENTER},0 ${CENTER},${CENTER} ${SIZE},${CENTER} ${SIZE},${SIZE} 0,${SIZE} 0,0`
        break;

      case ClipArea.LEFT_BOTTOM:
        points = `0,0 ${SIZE},0 ${SIZE},${SIZE} ${CENTER},${SIZE} ${CENTER},${CENTER} 0,${CENTER} 0,0`
        break;

      case ClipArea.RIGHT_BOTTOM:
        points = `0,0 ${SIZE},0 ${SIZE},${CENTER} ${CENTER},${CENTER} ${CENTER},${SIZE} 0,${SIZE} 0,0`
        break;
    }

    return (
      <div
          key={buttonKey++}
          id={param.id}
          className={"clip-area-selector"}
          onClick={ (e: ReactMouseEvent) => {
            callback(param.clipArea);
            e.stopPropagation();
          } }
      >
        <svg
            width="100%"
            height="100%"
            overflow="visible"
        >
          <polygon
              strokeWidth={2}
              stroke={"darkgray"}
              fill={"lightgray"}
              points={points}
          />
        </svg>
      </div>
    );
  }

  const params: Param[] = [
      //        id,                       ColorSet,
      new Param("clip_area_none",         ClipArea.NONE),
      new Param("clip_area_left_top",     ClipArea.LEFT_TOP),
      new Param("clip_area_right_top",    ClipArea.RIGHT_TOP),
      new Param("clip_area_left_bottom",  ClipArea.LEFT_BOTTOM),
      new Param("clip_area_right_bottom", ClipArea.RIGHT_BOTTOM),
  ];

  const buttons: React.ReactElement[] = [];

  params.forEach( (param: Param) => {
    buttons.push( genClickButton(param, callback) );
  } );

  return buttons;
}

