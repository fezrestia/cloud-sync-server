import * as React from "react";
import firebase from "firebase/app";
import "firebase/auth";
import "firebase/functions";

import "../../css/auth.scss";

import { IS_DEBUG } from "../../../common/js/log";
import { getText, setText } from "../../../common/js/html_handler";

const ID_NEW_MAIL = "new_mail";
const ID_NEW_PASS = "new_pass";
const ID_NEW_PASS_CONFIRM = "new_pass_confirm";
const ID_NEW_USER_MESSAGE = "new_user_message";

interface Props {
}

interface State {
}

export class NewUserForm extends React.Component<Props, State> {
  private readonly TAG = "NewUserForm";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <div id="div_create_new_user" >
        <h4><strong>Create New User</strong></h4>

        <table className={"no-border"} ><tbody>
          <tr>
            <td>
              {"MAIL"}
            </td>
            <td>
              <input id="new_mail" type="email" ></input>
            </td>
          </tr>
          <tr>
            <td>
              {"PASS"}
            </td>
            <td>
              <input id="new_pass" type="password" ></input>
              <br />
              <input id="new_pass_confirm" type="password" ></input> (confirm)
            </td>
          </tr>
          <tr>
            <td>,</td>
            <td>
              <button
                  id="create_new_user"
                  type="button"
                  onClick={ async () => { await this.onNewUserClicked() } }
              >
                {"Create"}
              </button>
            </td>
          </tr>
          <tr>
            <td></td>
            <td>
              <span id="new_user_message" />
            </td>
          </tr>
        </tbody></table>

      </div>
    );
  }

  private async onNewUserClicked() {
    if (IS_DEBUG) console.log(`onNewUserClicked()`);

    const newMail: string|null = getText(ID_NEW_MAIL);
    const newPass: string|null = getText(ID_NEW_PASS);
    const newPassConfirm: string|null = getText(ID_NEW_PASS_CONFIRM);

    if (newMail != null && newPass != null && newPassConfirm != null) {
      if (newPass === newPassConfirm) {

        const callCreateNewUser = firebase.app()
            .functions("asia-northeast1")
            .httpsCallable("callCreateNewUser");

        const params = {
          mail: newMail,
          pass: newPass,
        };

        await callCreateNewUser(params)
            .then( (result: any) => {
              if (IS_DEBUG) {
                console.log("## result");
                console.log(result);
              }

              let msg: string;

              const isError = result.data.is_error;
              if (!isError) {
                msg = "OK";
              } else {
                msg = result.data.message;
              }

              setText(ID_NEW_USER_MESSAGE, msg);
            } )
            .catch( (error: any) => {
              if (IS_DEBUG) {
                console.log("## error");
                console.log(error);
              }

              setText(ID_NEW_USER_MESSAGE, JSON.stringify(error));
            } );

        if (IS_DEBUG) console.log("DONE");

      } else {
        if (IS_DEBUG) console.log("pass and confirm is not matched.");
      }
    } else {
      if (IS_DEBUG) console.log("mail/pass/confirm is null.");
    }
  }

}

