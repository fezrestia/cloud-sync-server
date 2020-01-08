import * as React from "react";
import * as d3 from "d3";
import * as $ from "jquery";

export type ReactMouseEvent = React.MouseEvent<HTMLElement, MouseEvent>;

export namespace D3Node {
  export type SVG = d3.Selection<SVGSVGElement, any, HTMLElement, any>;
  export type G = d3.Selection<SVGGElement, any, HTMLElement|null, any>;
  export type Polygon = d3.Selection<SVGPolygonElement, any, HTMLElement|null, any>;
  export type Text = d3.Selection<SVGTextElement, any, HTMLElement|null, any>;
}

export type JQueryNode = JQuery<HTMLElement>;

