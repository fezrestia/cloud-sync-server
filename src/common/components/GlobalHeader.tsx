import * as React from "react";

import "../css/GlobalHeader.css";

interface Props {
  title: string|null,
  login_user: string|null,
}

interface State {
}

export class GlobalHeader extends React.Component<Props, State> {
  private readonly TAG = "GlobalHeader";

  constructor(props: Props) {
    super(props);

    this.state = {
    };
  }

  render() {
    let title: React.ReactElement;
    if (this.props.title === null) {
      title = (
        <span>
          <a href="/entry.html" className="header-link" >ROOT</a>
        </span>
      );
    } else {
      title = (
        <span>
          <a href="/entry.html" className="header-link" >ROOT</a>
          {" : "}
          <span>{this.props.title}</span>
        </span>
      );
    }

    let login: React.ReactElement;
    if (this.props.login_user === null) {
      login = (
        <a href="/auth/login.html" className="header-link header-login" >LOGIN</a>
      );
    } else {
      login = (
        <span className="header-link header-login" >LOGIN : {this.props.login_user}</span>
      );
    }

    return (
      <header className="global-header" >
        {title}
        <nav className="header-nav" >
          {login}
        </nav>
      </header>
    );
  }
}

