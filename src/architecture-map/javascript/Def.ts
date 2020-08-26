import { ColorResolver } from "./d3/resolver/ColorResolver";

export class Def {
  public static readonly DEG_HORIZONTAL = 0;
  public static readonly DEG_VERTICAL = 270;

  public static readonly SNAP_STEP_PIX = 8;
  public static readonly RADIAL_SNAP_STEP_RAD = Math.PI * 2 / 24; // 15 deg

  public static readonly KEY_VERSION = "version";
  public static readonly VAL_VERSION = "9";

  public static readonly KEY_ARCHITECTURE_MAP = "architecture_map";
  public static readonly KEY_OUT_FRAME = "out_frame";

  public static readonly KEY_UID = "uid";
  public static readonly KEY_CLASS = "class";
  public static readonly KEY_LABEL = "label";
  public static readonly KEY_DIMENS = "dimens";
  public static readonly KEY_X = "x";
  public static readonly KEY_Y = "y";
  public static readonly KEY_WIDTH = "width";
  public static readonly KEY_HEIGHT = "height";
  public static readonly KEY_PIN_X = "pin_x";
  public static readonly KEY_PIN_Y = "pin_y";
  public static readonly KEY_LABEL_ROT_DEG = "label_rot_deg";
  public static readonly KEY_LABEL_ALIGN = "label_align";
  public static readonly KEY_CLIP_AREA = "clip_area";
  public static readonly KEY_COLOR_SET = "color_set";

  public static readonly KEY_FROM_X = "from_x";
  public static readonly KEY_FROM_Y = "from_y";
  public static readonly KEY_TO_X = "to_x";
  public static readonly KEY_TO_Y = "to_y";

  public static readonly KEY_FROM_UID = "from_uid";
  public static readonly KEY_TO_UID = "to_uid";
  public static readonly KEY_FROM_MARKER_TYPE = "from_marker_type";
  public static readonly KEY_TO_MARKER_TYPE = "to_marker_type";

  public static readonly KEY_LINE_STYLE = "line_style";

}

/**
 * ArchMod shape clip area definitions.
 */
export enum ClipArea {
  NONE          = "none",
  LEFT_TOP      = "left_top",
  RIGHT_TOP     = "right_top",
  LEFT_BOTTOM   = "left_bottom",
  RIGHT_BOTTOM  = "right_bottom",
}
export namespace ClipArea {
  export function valueOf(value: string): ClipArea {
    return value as ClipArea;
  }
}

/**
 * Pre-defined ColorResolver instance list.
 */
export enum ColorSet {
  NONE        = "none",
  WHITE       = "white",
  LIGHT_GRAY  = "light_gray",
  GRAY        = "gray",
  ORANGE      = "orange",
  GREEN       = "green",
  BLUE        = "blue",
  YELLOW      = "yellow",
  RED         = "red",
}
export namespace ColorSet {
  export function valueOf(value: string): ColorSet {
    return value as ColorSet;
  }

  export function resolve(colorSet: ColorSet): ColorResolver {
    switch (colorSet) {
      case ColorSet.NONE:       return new ColorResolver("none",           "none",       "none");
      case ColorSet.WHITE:      return new ColorResolver("white",          "white",      "whitesmoke");
      case ColorSet.LIGHT_GRAY: return new ColorResolver("dimgray",        "#AAAAAA",    "dimgray");
      case ColorSet.GRAY:       return new ColorResolver("gainsboro",      "dimgray",    "dimgray");
      case ColorSet.ORANGE:     return new ColorResolver("peachpuff",      "darkorange", "darkorange");
      case ColorSet.GREEN:      return new ColorResolver("palegreen",      "limegreen",  "limegreen");
      case ColorSet.BLUE:       return new ColorResolver("lightskyblue",   "royalblue",  "dodgerblue");
      case ColorSet.YELLOW:     return new ColorResolver("khaki",          "gold",       "gold");
      case ColorSet.RED:        return new ColorResolver("red",            "red",        "red");

      default:                  return ColorSet.resolve(ColorSet.NONE);
    }
  }
}

