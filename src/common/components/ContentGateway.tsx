import * as React from "react";

import "../css/ContentGateway.css";

interface Props {
}

interface State {
}

export class ContentGateway extends React.Component<Props, State> {
  private readonly TAG = "ContentGateway";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (
      <table className="no-border content-gateway" ><tbody>
        <tr>
          <td>
            <strong>{"Auth : "}</strong>
          </td>
          <td>
            <a href="/auth/login.html" >{"Login/Logout"}</a>
          </td>
        </tr>
        <tr>
          <td>
            <strong>{"Service : "}</strong>
          </td>
          <td>
            <a href="https://itx.fezrestia.link" >{"Cloud Sync Service"}</a>
          </td>
        </tr>
        <tr>
          <td>
            <strong>{"SVG Diagram : "}</strong>
          </td>
          <td>
            <a href="/architecture_map/edit.html" >{"EDIT"}</a>
            <br></br>
            <a href="/architecture_map/view.html" >{"VIEW"}</a>
          </td>
        </tr>
        <tr>
          <td>
            <strong>{"SIM Stats : "}</strong>
          </td>
          <td>
            <a href="/sim_stats/total.html" >{"Total Stats"}</a>
          </td>
        </tr>
      </tbody></table>
    );
  }
}

