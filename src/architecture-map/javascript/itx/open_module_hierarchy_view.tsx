import { Context } from "../packs/architecture_map";
import { Element } from "../d3/Element";
import { ArchMod } from "../d3/ArchMod";
import { TraceLog } from "../util/TraceLog";

const TAG = "ITX";

const CSS = `
  ul, #module_hierarchy {
    list-style-type: none;
  }

  #module_hierarchy {
    margin: 0;
    padding: 0;
  }

  .caret {
    user-select: none;
    color: dimgray;
    display: inline-block;
    margin-right: 6px;
  }

  .caret-opened {
    transform: rotate(90deg);
  }

  .nest {
    display: block;
  }

  .nest-hidden {
    display: none;
  }
`;

const JAVASCRIPT = `
  var toggles = document.getElementsByClassName("caret");

  var i;
  for (i = 0; i < toggles.length; i++) {
    toggles[i].addEventListener("click", function() {
      this.parentElement.querySelector(".nest").classList.toggle("nest-hidden");
      this.classList.toggle("caret-opened");
    } );
  }
`;

const HTML_CONTENT_PLACEHOLDER = "<!-- HTML CONTENT PLACEHOLDER -->";

const HTML = `
  <html>
    <head>
      <title>Module Hierarchy</title>

      <style type="text/css" >
        ${CSS}
      </style>

    </head>
    <body>

      <ul id="module_hierarchy" >
        ${HTML_CONTENT_PLACEHOLDER}
      </ul>

      <script type="text/javascript" >
        ${JAVASCRIPT}
      </script>

    </body>
  </html>
`;

export function openModuleHierarchyViewWindow(context: Context, screenX: number, screenY: number) {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "openModuleHierarchyViewWindow()");

  type Nd = { [key: string]: {} };

  const root: Nd = {};

  context.forEachAllElements( (element: Element) => {
    if (element.TAG === ArchMod.TAG) {
      const archMod: ArchMod = element as ArchMod;

      // Create single hierarchy.
      const hierarchy: ArchMod[] = [archMod];
      let parentUid: number|null = archMod.parentUid;
      while(parentUid !== null) {
        const parentArchMod = context.queryElementUid(parentUid) as ArchMod;
        hierarchy.unshift(parentArchMod);
        parentUid = parentArchMod.parentUid;
      }

      // Register to root node.
      let curNd: Nd = root;
      hierarchy.forEach( (mod: ArchMod) => {
        const curChildren: Nd = curNd[mod.label];
        if (curChildren === undefined) {
          curNd[mod.label] = {};
        }
        curNd = curNd[mod.label];
      } );
    }
  } );

  if (TraceLog.IS_DEBUG) {
    TraceLog.d(TAG, "root =");
    console.log(root);
  }

  // Render root node to HTML.
  function getNestedUlLi(nd: Nd): string {
    const content: string[] = [];

    Object.keys(nd).forEach( (key: string) => {
      const children = nd[key];
      if (Object.keys(children).length === 0) {
        // No child.
        content.push(`<li>${key}</li>`);
      } else {
        // Has child.
        const childrenContent = getNestedUlLi(children);
        content.push(`<li><span class="caret caret-opened" >\u25B6</span>${key}`);
        content.push(`<ul class="nest" >`);
        content.push(childrenContent);
        content.push(`</ul>`);
        content.push(`</li>`);
      }
    } );

    return content.join("\n");
  }

  const contentNode: Nd = { "<strong>Module Hierarchy</strong>": root };

  const contentInjection = getNestedUlLi(contentNode);

  const injectedHtml = HTML.replace(HTML_CONTENT_PLACEHOLDER, contentInjection);

  // Open new window.
  const newWin: WindowProxy|null = window.open(
      "", // dummy content.
      "Module Hierarchy",
      `left=${screenX},top=${screenY},width=300,height=600,menubar=no,toolbar=no,location=no,status=no`);
  if (newWin !== null) {
    newWin.document.open();
    newWin.document.write(injectedHtml);
    newWin.document.close();
  } else {
    TraceLog.e(TAG, "Cann not open new window.");
  }
};

