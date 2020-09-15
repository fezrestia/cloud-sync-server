import { Context } from "../packs/architecture_map";
import { Element } from "../d3/Element";
import { ArchMod } from "../d3/ArchMod";
import { TraceLog } from "../util/TraceLog";
import { Downloader } from "../util/Downloader";
import { Util } from "../util/Util";

const TAG = "ITX";

export async function downloadStaticHtml(clicked: HTMLInputElement) {
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, "downloadStaticHtml()");

  clicked.disabled = true;

  // Get current HTML contents.
  let contents = "<!DOCTYPE html>\n";
  contents += (document as any).documentElement.outerHTML;
  if (TraceLog.IS_DEBUG) TraceLog.d(TAG, contents);

  // Parse javascript link tag.
  const jsPattern: RegExp = /<script\s+src="(.+\.js)"\s*(><\/script>|\/>)/i;
  const jsResults: string[]|null = contents.match(jsPattern);
  if (jsResults !== null) {
    const jsLine: string = jsResults[0];
    const jsPath: string = jsResults[1];

    let jsUrl: string = "";

    if (jsPath.startsWith("../")) {
      const pathElms: string[] = location.href.split("/");
      pathElms.pop();
      pathElms.pop();
      pathElms.push(jsPath.replace("../", ""));
      jsUrl = pathElms.join("/");
    } else if (jsPath.startsWith("./")) {
      const pathElms: string[] = location.href.split("/");
      pathElms.pop();
      pathElms.push(jsPath.replace("./", ""));
      jsUrl = pathElms.join("/");
    } else if (jsPath.startsWith("/")) {
      jsUrl = `${location.protocol}//${location.host}${jsPath}`;
    } else {
      alert(`ERROR:\nUnexpected JS path format.\njsPath=${jsPath}`);
      return;
    }
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `jsUrl = ${jsUrl}`);

    const jsRes: Response = await fetch(jsUrl);
    if (jsRes.ok) {
      const js: string = await jsRes.text();

      let replacer: string = "";
      replacer += `<script type="text/javascript" >\n`;
      replacer += js;
      replacer += "\n<" + "/script>\n";

      const elms = contents.split(jsLine);

      contents = "";
      contents += elms[0];
      contents += "\n";
      contents += replacer;
      contents += "\n";
      contents += elms[1];

      if (TraceLog.IS_DEBUG) {
        TraceLog.d(TAG, "#### contents = ");
        console.log(contents);
        TraceLog.d(TAG, "####");
      }

    } else {
      alert(`ERROR:\nFailed to load ${jsUrl}`);
      return;
    }
  } else {
    alert(`ERROR:\nFailed to match. jsResults == null.`);
    return;
  }

  // Parse css link tag.
  const cssPattern: RegExp = /<link\s.*href="(.+\.css)(|\?.+)".*(>|><\/link>|\/>)/i;
  const cssResults: string[]|null = contents.match(cssPattern);
  if (cssResults !== null) {
    const cssLine: string = cssResults[0];
    const cssPath: string = cssResults[1];

    // Check.
    if (!cssLine.includes(`rel="stylesheet"`)) {
      alert(`ERROR:\nUnexpected CSS line.\ncssLine=${cssLine}`);
      return;
    }

    let cssUrl: string = "";

    if (cssPath.startsWith("../")) {
      const pathElms: string[] = location.href.split("/");
      pathElms.pop();
      pathElms.pop();
      pathElms.push(cssPath.replace("../", ""));
      cssUrl = pathElms.join("/");
    } else if (cssPath.startsWith("./")) {
      const pathElms: string[] = location.href.split("/");
      pathElms.pop();
      pathElms.push(cssPath.replace("./", ""));
      cssUrl = pathElms.join("/");
    } else if (cssPath.startsWith("/")) {
      cssUrl = `${location.protocol}//${location.host}${cssPath}`;
    } else {
      alert(`ERROR:\nUnexpected CSS path format.\ncssPath=${cssPath}`);
      return;
    }
    if (TraceLog.IS_DEBUG) TraceLog.d(TAG, `cssUrl = ${cssUrl}`);

    const cssRes: Response = await fetch(cssUrl);
    if (cssRes.ok) {
      const css: string = await cssRes.text();

      let replacer: string = "";
      replacer += `<style type="text/css" >\n`;
      replacer += css;
      replacer += "\n</style>\n";

      const elms = contents.split(cssLine);

      contents = "";
      contents += elms[0];
      contents += "\n";
      contents += replacer;
      contents += "\n";
      contents += elms[1];

      if (TraceLog.IS_DEBUG) {
        TraceLog.d(TAG, "#### contents = ");
        console.log(contents);
        TraceLog.d(TAG, "####");
      }

    } else {
      alert(`ERROR:\nFailed to load ${cssUrl}`);
      return;
    }
  } else {
    alert(`ERROR:\nFailed to match. cssResults == null.`);
    return;
  }

  Downloader.downloadText(contents, `InteractiveArchitectureMap_${Util.genTimestamp()}.html`);

  clicked.disabled = false;
};

