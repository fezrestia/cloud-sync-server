import * as d3 from "d3";
import * as $ from "jquery";

import { ArchMod } from "../d3/ArchMod";
import { ColorResolver } from "../d3/resolver/ColorResolver";
import { TraceLog } from "../util/TraceLog.ts";

const TAG = "SVG_ROOT";
const ARCHITECTURE_MAP_ID = "architecture_map";
const SVG_ROOT_ID = "svg_root";
const HTML_ROOT_ID = "html_root";

function onArchitectureMapTopLoaded() {
    console.log("## onArchitectureMapTopLoaded()");

    let totalWidth = 640;
    let totalHeight = 640;

    let container = $(`#${ARCHITECTURE_MAP_ID}`);
    let html = $(`#${HTML_ROOT_ID}`);
    html.empty();
    let svg_container = $(`#${SVG_ROOT_ID}`);
    svg_container.empty();

    let svg = d3.select(`#${SVG_ROOT_ID}`).append('svg');

    container.css("width", totalWidth);
    container.css("height", totalHeight);
    svg.attr("width", totalWidth);
    svg.attr("height", totalHeight);
    html.css("width", totalWidth);
    html.css("height", totalHeight);

    html.css("display", "none");








    let archMod = new ArchMod(html, svg, "Test Label");
    archMod.setColorResolver(new ColorResolver("lightskyblue", "royalblue", "dodgerblue"));
    archMod.setXYWH(30, 60, 100, 200);
    archMod.render();


    let {x: a, y: b, width: c, height: d} = archMod.getXYWH();

    console.log(`## a=${a}, b=${b}, w=${c}, h=${d}`);




    svg.on("click", () => {
        if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "on:click");

        archMod.isSelected = false;
        archMod.isEditing = false;

        d3.event.stopPropagation();
    });

}
eval(`window["onArchitectureMapTopLoaded"] = onArchitectureMapTopLoaded;`);

console.log("## DONE");


