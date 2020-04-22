import * as React from "react";

interface Props {
  dcmMonthUsed: number,
  nuroMonthUsed: number,
  zeroSimMonthUsed: number,
}

interface State {
}

const LOADING = "loading...";

export class LatestSimStats extends React.Component<Props, State> {
  private readonly TAG = "LatestSimStats";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    const p = this.props;

    const dcmMonthUsed = p.dcmMonthUsed === -1 ? LOADING : `${p.dcmMonthUsed} MB`;
    const nuroMonthUsed = p.nuroMonthUsed === -1 ? LOADING : `${p.nuroMonthUsed} MB`;
    const zeroSimMonthUsed = p.zeroSimMonthUsed === -1 ? LOADING : `${p.zeroSimMonthUsed} MB`;

    return (
      <div>
        <strong>Latest Stats</strong>
        <table className="no-border" >
          <tbody>
            <tr>
              <td>DCM</td>
              <td>{dcmMonthUsed}</td>
            </tr>
            <tr>
              <td>Nuro</td>
              <td>{nuroMonthUsed}</td>
            </tr>
            <tr>
              <td>Zero SIM</td>
              <td>{zeroSimMonthUsed}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

