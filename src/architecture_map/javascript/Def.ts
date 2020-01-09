import { ColorResolver } from "./d3/resolver/ColorResolver";

export class Def {
  public static readonly DEG_HORIZONTAL = 0;
  public static readonly DEG_VERTICAL = 270;

  public static readonly SNAP_STEP_PIX = 8;
}

/**
 * ArchMod shape clip area definitions.
 */
export const enum ClipArea {
  NONE,
  LEFT_TOP,
  RIGHT_TOP,
  LEFT_BOTTOM,
  RIGHT_BOTTOM,
}

/**
 * Pre-defined ColorResolver instance list.
 */
export class ColorSet {
  static readonly NONE        = new ColorResolver("none",           "none",       "none");
  static readonly WHITE       = new ColorResolver("whitesmoke",     "white",      "white");
  static readonly LIGHT_GRAY  = new ColorResolver("dimgray",        "#AAAAAA",    "dimgray");
  static readonly GRAY        = new ColorResolver("gainsboro",      "dimgray",    "dimgray");
  static readonly ORANGE      = new ColorResolver("peachpuff",      "darkorange", "darkorange");
  static readonly GREEN       = new ColorResolver("palegreen",      "limegreen",  "limegreen");
  static readonly BLUE        = new ColorResolver("lightskyblue",   "royalblue",  "dodgerblue");
  static readonly YELLOW      = new ColorResolver("khaki",          "gold",       "gold");
}

