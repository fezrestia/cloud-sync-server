import * as React from "react";
import * as ReactDOM from "react-dom";
import firebase from "firebase/app";
import "firebase/auth";

import "./entry.scss";
import { Context } from "./context.ts";
import { GlobalHeader } from "./common/components/GlobalHeader";
import { ContentGateway } from "./common/components/ContentGateway";

const GLOBAL_HEADER_ID = "global_header";
const CONTENT_GATEWAY_ID = "content_gateway";

(window as any).onEntryDomLoaded = async () => {
  const context: Context = await Context.getInstanceAsync();
  const user: string|null = context.getCurrentUserEmail();

  ReactDOM.render(
      <GlobalHeader
          title={null}
          login_user={user}
      />,
      document.getElementById(GLOBAL_HEADER_ID));

  if (user != null) {
    ReactDOM.render(
        <ContentGateway />,
        document.getElementById(CONTENT_GATEWAY_ID));
  }

}

