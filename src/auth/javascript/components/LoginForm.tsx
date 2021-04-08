import * as React from "react";
import firebase from "firebase/app";
import "firebase/auth";

import "../../css/auth.scss";

import { IS_DEBUG } from "../../../common/js/log";
import { getText, setText } from "../../../common/js/html_handler";

const ID_LOGIN_MAIL = "login_mail";
const ID_LOGIN_PASS = "login_pass";
const ID_LOGIN_MSG = "login_msg";

interface Props {
}

interface State {
}

export class LoginForm extends React.Component<Props, State> {
  private readonly TAG = "LoginForm";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <div>
        <h4><strong>Login</strong></h4>

        <table className={"no-border"} ><tbody>
          <tr>
            <td>
              {"MAIL"}
            </td>
            <td>
              <input id={ID_LOGIN_MAIL} type="email" />
            </td>
          </tr>
          <tr>
            <td>
              {"PASS"}
            </td>
            <td>
              <input id={ID_LOGIN_PASS} type="password" />
            </td>
          </tr>
          <tr>
            <td></td>
            <td>
              <button
                  id="login_user"
                  type="button"
                  onClick={ async () => { await this.onLoginClicked() } }
              >
                {"Login"}
              </button>
            </td>
          </tr>
          <tr>
            <td></td>
            <td>
              <span id={ID_LOGIN_MSG} />
            </td>
          </tr>
        </tbody></table>
      </div>
    );
  }

  private async onLoginClicked() {
    if (IS_DEBUG) console.log(`onLoginClicked()`);

    const mail: string|null = getText(ID_LOGIN_MAIL);
    const pass: string|null = getText(ID_LOGIN_PASS);

    if (mail != null && pass != null) {
      // Login user to Firebase.
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred: firebase.auth.UserCredential|void = await firebase.auth()
          .signInWithEmailAndPassword(mail, pass)
          .catch( (error: firebase.auth.Error) => {
            const errorCode = error.code;
            const errorMessage = error.message;

            if (IS_DEBUG) {
              console.log(`ERR: errorCode=${errorCode}`);
              console.log(`ERR: errorMessage=${errorMessage}`);
            }

            setText(ID_LOGIN_MSG, `CODE=${errorCode}, MSG=${errorMessage}`);

          } );

      if (IS_DEBUG) console.log("DONE");

      if (cred !== undefined) {
        if (IS_DEBUG) console.log("OK");

        // Reload to refresh login/logout state.
        (window as any).location.reload();
      }

    } else {
      if (IS_DEBUG) console.log("mail/pass is null.");
    }
  }

}

