export class TraceLog {

  public static IS_DEBUG: boolean = false;

  /**
   * Output debug log to console with local tag.
   * @param tag Local tag.
   * @param msg Log msg.
   */
  public static d(tag: string, msg: string): void {
      console.log(`D/TraceLog: ${tag} : ${msg}`);
  }

  /**
   * Output error log to console with local tag.
   * @param tag Local tag.
   * @param msg Log msg.
   */
  public static e(tag: string, msg: string): void {
      console.log(`E/TraceLog: ${tag} : ${msg}`);
  }

}

