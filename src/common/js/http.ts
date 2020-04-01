/**
 * Async HTTP(S) GET request.
 *
 * @param url
 * @return Response string, or null if failed.
 */
export async function asyncGetHttp(url: string): Promise<string> {
  return new Promise<string>( (resolve: (res: string) => void, reject: (why: string) => void) => {
    console.log("## asyncGetHttp()");

    const request = new XMLHttpRequest();
    request.open("GET", url);

    request.onload = () => {
      if (request.status != 200) {
        // NG.
        console.log(`## asyncGetHttp() : onload.error = ${request.status}/${request.statusText}`);
        reject(request.statusText);
      } else {
        // OK.
        console.log(`## asyncGetHttp() : onload.ok = ${request.response}`);
        resolve(request.response);
      }
    };

    request.onerror = () => {
      console.log("## asyncGetHttp() : Request Failed");
      reject("Request Failed");
    };

    request.send();
  } );
}

