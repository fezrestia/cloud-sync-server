import * as React from "react";
import firebase from "firebase/app";
import "firebase/auth";

import "../../css/auth.scss";

import { IS_DEBUG } from "../../../common/js/log";

interface Props {
  currentUser: string|null,
}

interface State {
}

export class LogoutForm extends React.Component<Props, State> {
  private readonly TAG = "LogoutForm";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <div>
        <h4>Logout</h4>

        <table className={"no-border"} ><tbody>
          <tr>
            <td>
              {"CURRENT"}
            </td>
            <td>
              {this.props.currentUser}
            </td>
          </tr>
          <tr>
            <td></td>
            <td>
              <button
                  id="logout"
                  type="button"
                  onClick={ async () => { await this.onLogoutClicked() } }
              >
                {"Logout"}
              </button>
            </td>
          </tr>
        </tbody></table>
      </div>
    );
  }

  private async onLogoutClicked() {
    if (IS_DEBUG) console.log(`onLogoutClicked()`);

    firebase.auth().onAuthStateChanged( (user: firebase.User|null) => {
      if (IS_DEBUG) console.log("Logout succeeded.");

      // Reload to refresh login/logout state.
      (window as any).location.reload();
    } );

    await firebase.auth().signOut();
  }

}

