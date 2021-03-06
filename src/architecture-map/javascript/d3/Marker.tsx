import { D3Node } from "../TypeDef";
import { ColorSet, MarkerType, LineStyle } from "../Def";

export class Marker {
  public static readonly TAG = "Marker";

  private static readonly DEFAULT_WIDTH = 4;
  private static readonly MARKER_SIZE = 4;
  private static readonly MARKER_ID_ARROW = "arrow_marker";
  private static readonly MARKER_ID_RECT = "rect_marker";

  private static genArrowId(colorSet: ColorSet, isHighlight: boolean): string {
    if (isHighlight) {
      return `${Marker.MARKER_ID_ARROW}_${colorSet}_highlight`;
    } else {
      return `${Marker.MARKER_ID_ARROW}_${colorSet}`;
    }
  }

  private static genRectId(colorSet: ColorSet, isHighlight: boolean): string {
    if (isHighlight) {
      return `${Marker.MARKER_ID_RECT}_${colorSet}_highlight`;
    } else {
      return `${Marker.MARKER_ID_RECT}_${colorSet}`;
    }
  }

  private static genMarkerId(
      markerType: MarkerType,
      colorSet: ColorSet,
      isHighlight: boolean): string|null {
    switch (markerType) {
      case MarkerType.ARROW:
        return Marker.genArrowId(colorSet, isHighlight);

      case MarkerType.RECT:
        return Marker.genRectId(colorSet, isHighlight);

      default:
        return null;
    }
  }

  /**
   * Prepare necessary Marker defs.
   *
   * @param svg
   * @param colorSet
   */
  public static prepareMarkers(
      svg: D3Node.SVG,
      colorSet: ColorSet) {
    const colorResolver = ColorSet.resolve(colorSet);

    let defs = svg.select("defs") as D3Node.Defs;
    if (defs.empty()) {
      defs = svg.append("defs");
    }

    // Arrow markers.
    const arrowMap = [
      [Marker.genArrowId(colorSet, false),  colorResolver.bg],          // Normal
      [Marker.genArrowId(colorSet, true),   colorResolver.bgHighlight], // Highlight
    ];
    arrowMap.forEach( (idAndColor) => {
      const id = idAndColor[0];
      const color = idAndColor[1];

      let arrowMarker = defs.select(`#${id}`) as D3Node.Marker;
      if (arrowMarker.empty()) {
        arrowMarker = defs.append("marker")
            .attr("id", id)
            .attr("viewBox", `0, 0, ${Marker.MARKER_SIZE}, ${Marker.MARKER_SIZE}`)
            .attr("refX", Marker.MARKER_SIZE)
            .attr("refY", Marker.MARKER_SIZE / 2)
            .attr("markerWidth", Marker.MARKER_SIZE)
            .attr("markerHeight", Marker.MARKER_SIZE)
            .attr("orient", "auto-start-reverse")
            .attr("markerUnits", "strokeWidth");
        const d = Marker.MARKER_SIZE;
        const l = Marker.DEFAULT_WIDTH;
        const a = 1.118; // root(5)/2
        arrowMarker.append("path")
            .attr("d", `M ${d},${d / 2} 0,${d} 0,${d - a * l} ${d - 2 * a * l},${d / 2} 0,${a * l} 0,0 Z`)
            .attr("fill", color);
      }

    } );

    // Rect markers.
    const rectMap = [
      [Marker.genRectId(colorSet, false), colorResolver.bg],          // Normal
      [Marker.genRectId(colorSet, true),  colorResolver.bgHighlight], // Highlight
    ];
    rectMap.forEach( (idAndColor) => {
      const id = idAndColor[0];
      const color = idAndColor[1];

      let rectMarker = defs.select(`#${id}`) as D3Node.Marker;
      if (rectMarker.empty()) {
        const rectSize = Marker.MARKER_SIZE * 3 / 4;
        rectMarker = defs.append("marker")
            .attr("id", id)
            .attr("viewBox", `0, 0, ${rectSize}, ${rectSize}`)
            .attr("refX", rectSize / 2)
            .attr("refY", rectSize / 2)
            .attr("markerWidth", rectSize)
            .attr("markerHeight", rectSize)
            .attr("orient", "0")
            .attr("markerUnits", "strokeWidth");
        const d = rectSize;
        rectMarker.append("path")
            .attr("d", `M 0,0 0,${d} ${d},${d} ${d},0 Z`)
            .attr("fill", color);
      }

    } );

  }

  /**
   * Update Marker state.
   *
   * @param path
   * @param lineStyle
   * @param fromMarkerType
   * @param toMarkerType
   * @param colorSet
   * @param isHighlight
   * @param isHighSpeedRenderingMode
   */
  public static updateMarkers(
      path: D3Node.Path,
      lineStyle: LineStyle,
      fromMarkerType: MarkerType,
      toMarkerType: MarkerType,
      colorSet: ColorSet,
      isHighlight: boolean,
      isHighSpeedRenderingMode: boolean) {
    const fromMarkerId = Marker.genMarkerId(fromMarkerType, colorSet, isHighlight);
    if (fromMarkerId != null) {
      path.attr("marker-start", `url(#${fromMarkerId})`);
    } else {
      path.attr("marker-start", null);
    }

    const toMarkerId = Marker.genMarkerId(toMarkerType, colorSet, isHighlight);
    if (toMarkerId != null) {
      path.attr("marker-end", `url(#${toMarkerId})`);
    } else {
      path.attr("marker-end", null);
    }

    if (!isHighSpeedRenderingMode) {
      const endGap = Number(path.attr("stroke-width"));
      const lineLen = path.node()!.getTotalLength() - endGap * 2;

      switch(lineStyle) {
        case LineStyle.NORMAL:
          path.attr("stroke-dasharray", `0 ${endGap} ${lineLen} ${endGap}`);
          path.attr("stroke-dashoffset", 0);
          break;

        case LineStyle.BROKEN:
          // fall-through.
        case LineStyle.DOTTED:

          // TODO: Consider terminator marker offset with broken/dotted line.

          break;
      }

    }

  }

}
