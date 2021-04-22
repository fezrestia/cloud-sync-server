import * as React from "react";
import * as ReactDOM from "react-dom";

import { IS_DEBUG } from "../../common/js/log";
import { Context } from "../../context";
import { GlobalHeader } from "../../common/components/GlobalHeader";
import { LoginForm } from "./components/LoginForm";
import { LogoutForm } from "./components/LogoutForm";
import { NewUserForm } from "./components/NewUserForm";

const ID_GLOBAL_HEADER = "global_header";
const ID_LOGIN_FORM = "login_form";
const ID_LOGOUT_FORM = "logout_form";
const ID_NEW_USER_FORM = "new_user_form";

// Entry point from HTML.
(window as any).onAuthDomLoaded = async () => {
  if (IS_DEBUG) console.log(`onAuthDomLoaded()`);

  const context: Context = await Context.getInstanceAsync();
  const user: string|null = context.getCurrentUserEmail();

  ReactDOM.render(
      <GlobalHeader
          title={"Login/Logout"}
          login_user={user}
      />,
      document.getElementById(ID_GLOBAL_HEADER));

  if (user == null) {
    // Not login.

    ReactDOM.render(
        <LoginForm
        />,
        document.getElementById(ID_LOGIN_FORM));
  } else {
    // Already login.

    ReactDOM.render(
        <LogoutForm
          currentUser={user}
        />,
        document.getElementById(ID_LOGOUT_FORM));

    ReactDOM.render(
        <NewUserForm
        />,
        document.getElementById(ID_NEW_USER_FORM));
  }

}

