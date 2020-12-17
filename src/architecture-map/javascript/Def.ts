import { ColorResolver } from "./d3/resolver/ColorResolver";

export class Def {
  public static readonly DEG_HORIZONTAL = 0;
  public static readonly DEG_VERTICAL = 270;

  public static readonly SNAP_STEP_PIX = 8;
  public static readonly RADIAL_SNAP_STEP_RAD = Math.PI * 2 / 24; // 15 deg

  public static readonly KEY_VERSION = "version";
  public static readonly VAL_VERSION = "12";

  public static readonly KEY_ARCHITECTURE_MAP = "architecture_map";
  public static readonly KEY_OUT_FRAME = "out_frame";

  public static readonly KEY_UID = "uid";
  public static readonly KEY_PARENT_UID = "parent_uid";
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
  public static readonly KEY_LABEL_ALIGN = "label_align"; // Legacy support.
  public static readonly KEY_LABEL_HORIZONTAL_ALIGN = "label_horizontal_align";
  public static readonly KEY_LABEL_VERTICAL_ALIGN = "label_vertical_align";
  public static readonly KEY_CLIP_AREA = "clip_area";
  public static readonly KEY_COLOR_SET = "color_set";
  public static readonly KEY_EDGE_COLOR_SET = "edge_color_set";

  public static readonly KEY_FROM_X = "from_x";
  public static readonly KEY_FROM_Y = "from_y";
  public static readonly KEY_TO_X = "to_x";
  public static readonly KEY_TO_Y = "to_y";

  public static readonly KEY_FROM_UID = "from_uid";
  public static readonly KEY_TO_UID = "to_uid";
  public static readonly KEY_FROM_MARKER_TYPE = "from_marker_type";
  public static readonly KEY_TO_MARKER_TYPE = "to_marker_type";

  public static readonly KEY_LINE_STYLE = "line_style";

  public static readonly DEFAULT_LABEL_HORIZONTAL_ALIGN = "center";
  public static readonly DEFAULT_LABEL_VERTICAL_ALIGN = "middle";

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
  PURPLE      = "purple",
  ALERT_RED   = "alert_red",
}
export namespace ColorSet {
  export function valueOf(value: string): ColorSet {
    return value as ColorSet;
  }

  export function resolve(colorSet: ColorSet): ColorResolver {
    switch (colorSet) {
      //                         bg,             stroke,        bgHighlight,   strokeHighlight, text?,
      case ColorSet.NONE:
        return new ColorResolver("none",       "none",      "none",      "none");
      case ColorSet.WHITE:
        return new ColorResolver("white",      "white",     "gainsboro", "gainsboro");
      case ColorSet.LIGHT_GRAY:
        return new ColorResolver("whitesmoke", "lightgray", "gainsboro", "silver");
      case ColorSet.GRAY:
        return new ColorResolver("silver",     "gray",      "darkgray",  "dimgray");
      case ColorSet.ORANGE:
        return new ColorResolver("#FFE0C1", "#FFC993", "#FFD6AD", "#FFBF7F");
      case ColorSet.GREEN:
        return new ColorResolver("#C1FFC1", "#93FF93", "#ADFFAD", "#7FFF7F");
      case ColorSet.BLUE:
        return new ColorResolver("#C1C1FF", "#9393FF", "#ADADFF", "#7F7FFF");
      case ColorSet.YELLOW:
        return new ColorResolver("#FFFFC1", "#FFFF93", "#FFFFAD", "#FFFF7F");
      case ColorSet.RED:
        return new ColorResolver("#FFC1C1", "#FF9393", "#FFADAD", "#FF7F7F");
      case ColorSet.PURPLE:
        return new ColorResolver("#E0C1FF", "#C993FF", "#D6ADFF", "#BF7FFF");

      case ColorSet.ALERT_RED:
        return new ColorResolver("red", "red", "red", "red");

      default:
        return ColorSet.resolve(ColorSet.NONE);
    }
  }
}

/**
 * Marker type.
 */
export enum MarkerType {
  NONE  = "none",
  ARROW = "arrow",
  RECT  = "rect",
}
export namespace MarkerType {
  export function valueOf(value: string): MarkerType {
    return value as MarkerType;
  }
}

/**
 * Line style.
 */
export enum LineStyle {
  NORMAL = "normal",
  BROKEN = "broken",
  DOTTED = "dotted",
}
export namespace LineStyle {
  export function valueOf(value: string): LineStyle {
    return value as LineStyle;
  }

  export function getStrokeDashArray(lineStyle: LineStyle, strokeWidth: number): string {
    switch(lineStyle) {
      case LineStyle.NORMAL:
        return "";
      case LineStyle.BROKEN:
        return `${strokeWidth * 4} ${strokeWidth * 4}`;
      case LineStyle.DOTTED:
        return `${strokeWidth} ${strokeWidth}`;
      default:
        return "";
    }
  }
}

