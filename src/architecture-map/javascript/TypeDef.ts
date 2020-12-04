import * as React from "react";
import * as d3 from "d3";
import * as $ from "jquery";

export type ReactMouseEvent = React.MouseEvent<HTMLElement, MouseEvent>;
export type ReactInputChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type ReactTextAreaChangeEvent = React.ChangeEvent<HTMLTextAreaElement>;
export type ReactKeyboardInputEvent = React.KeyboardEvent<HTMLInputElement>;
export type ReactKeyboardTextAreaEvent = React.KeyboardEvent<HTMLTextAreaElement>;

export namespace D3Node {
  export type SVG = d3.Selection<SVGSVGElement, any, HTMLElement, any>;
  export type G = d3.Selection<SVGGElement, any, HTMLElement, any>;
  export type Polygon = d3.Selection<SVGPolygonElement, any, HTMLElement, any>;
  export type Text = d3.Selection<SVGTextElement, any, HTMLElement, any>;
  export type Path = d3.Selection<SVGPathElement, any, HTMLElement, any>;
  export type Circle = d3.Selection<SVGCircleElement, any, HTMLElement, any>;
  export type Defs = d3.Selection<SVGDefsElement, any, HTMLElement, any>;
  export type Marker = d3.Selection<SVGMarkerElement, any, HTMLElement, any>;
}

export namespace D3Event {
  export type Drag = d3.D3DragEvent<any, any, any>;
}

export type JQueryNode = JQuery<HTMLElement>;

