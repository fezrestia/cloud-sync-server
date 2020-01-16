import * as React from "react";
import * as d3 from "d3";
import * as $ from "jquery";

export type ReactMouseEvent = React.MouseEvent<HTMLElement, MouseEvent>;
export type ReactInputChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type ReactKeyboardInputEvent = React.KeyboardEvent<HTMLInputElement>;

export namespace D3Node {
  export type SVG = d3.Selection<SVGSVGElement, any, HTMLElement, any>;
  export type G = d3.Selection<SVGGElement, any, HTMLElement, any>;
  export type Polygon = d3.Selection<SVGPolygonElement, any, HTMLElement, any>;
  export type Text = d3.Selection<SVGTextElement, any, HTMLElement, any>;
  export type Path = d3.Selection<SVGPathElement, any, HTMLElement, any>;
  export type Circle = d3.Selection<SVGCircleElement, any, HTMLElement, any>;
}

export type JQueryNode = JQuery<HTMLElement>;

