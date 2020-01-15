export class Downloader {

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

    Downloader.doDownload(blob, defaultFileName);
  }

  /**
   * Download string contents as JSON.
   *
   * @parm json JSON string.
   * @param defaultFileName Download target default file name.
   */
  public static downloadJson(json: string, defaultFileName: string): void {
    // Gen BLOB.
    let blob = new Blob([json], { type: "application/json" });

    Downloader.doDownload(blob, defaultFileName);
  }

  private static doDownload(blob: Blob, filename: string) {
    const anchor: any = document.createElement("a");
    anchor.download = filename;
    anchor.href = window.URL.createObjectURL(blob);

    document.body.appendChild(anchor);
    anchor.click();
    anchor.parentNode.removeChild(anchor);
  }

}
