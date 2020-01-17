import { D3Node } from "../TypeDef.ts";
import { TraceLog } from "./TraceLog.ts";

export class Downloader {
  public static readonly TAG = "Downloader";

  /**
   * Download string content as CSV.
   *
   * @param csv CSV string.
   * @param defaultFileName Download target default file name.
   */
  public static downloadCsv(csv: string, defaultFileName: string): void {
    // Gen BLOB.
    let BOM = new Uint8Array([0xEF, 0XBB, 0xBF]);
    let blob = new Blob([BOM, csv], { type: "text/csv" });

    Downloader.doDownloadBlob(blob, defaultFileName);
  }

  /**
   * Download string contents as JSON.
   *
   * @parm json JSON string.
   * @param fileNameBase Download target file name without extension.
   */
  public static downloadJson(json: string, fileNameBase: string): void {
    // Gen BLOB.
    let blob = new Blob([json], { type: "application/json" });

    Downloader.doDownloadBlob(blob, `${fileNameBase}.json`);
  }

  private static doDownloadBlob(blob: Blob, filename: string) {
    let url = window.URL.createObjectURL(blob);
    Downloader.doDownloadUrl(url, filename);
  }

  private static doDownloadUrl(url: string, filename: string) {
    const anchor: any = document.createElement("a");
    anchor.download = filename;
    anchor.href = url;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.parentNode.removeChild(anchor);
  }

  /**
   * Download SVG node as SVG image file(.svg).
   * @param svg
   * @param fileNameBase File name without extension.
   */
  public static downloadSvgAsSvg(svg: D3Node.SVG, fileNameBase: string) {
    let serializedSvg: string = Downloader.serializeSvg(svg);

    let xml: string = [
      '<?xml version="1.0" standalone="no"?>',
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
      serializedSvg,
    ].join("");

    let blob = new Blob([xml], { "type" : "text/xml" });

    Downloader.doDownloadBlob(blob, `${fileNameBase}.svg`);
  }

  private static serializeSvg(svg: D3Node.SVG): string {
    let svgNode: SVGSVGElement|null = svg
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("version", "1.1")
        .node();
    if (svgNode == null) {
      TraceLog.e(Downloader.TAG, "Util.downloadSvgAsSvg() : svgNode == null")
      return "";
    }

    let xmlSerializer = new XMLSerializer();
    let serialized: string = xmlSerializer.serializeToString(svgNode);

    return serialized;
  }

  /**
   * Download SVG node as PNG image file(.png).
   * @param svg
   * @param width
   * @param height
   * @param fileNameBase File name without extension.
   */
  public static downloadSvgAsPng(svg: D3Node.SVG, width: number, height: number, fileNameBase: string) {
    let serializedSvg: string = Downloader.serializeSvg(svg);
    let dataUri: string = 'data:image/svg+xml;utf8,' + encodeURIComponent(serializedSvg);

    let img = new Image();
    img.src = dataUri;

    let canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.setAttribute("width", String(width));
    canvas.setAttribute("height", String(height));
    canvas.setAttribute("display", "none");
    document.body.appendChild(canvas);
    let context = canvas.getContext("2d") as CanvasRenderingContext2D;

    function onLoadCallback() {
      context.drawImage(img, 0, 0);
      let url = canvas.toDataURL("image/png");
      Downloader.doDownloadUrl(url, `${fileNameBase}.png`);

      document.body.removeChild(canvas);
    }

    img.addEventListener("load", onLoadCallback, false);
  }

}
