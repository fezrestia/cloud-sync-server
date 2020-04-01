import "../css/sim_stats.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { LatestSimStats } from "./components/LatestSimStats";
import { asyncGetHttp } from "../../common/js/http";

const GET_LATEST_SIM_STATS_URL = "https://asia-northeast1-cloud-sync-functions.cloudfunctions.net/httpsGetLatestSimStats";

(window as any).onSimStatsTotalLoaded = () => {
  console.log("## onSimStatsTotalLoaded()");

  // Initialize latest stats indicator.
  renderLatestSimStats(-1, -1, -1);

  // Get latest stats.
  asyncGetHttp(GET_LATEST_SIM_STATS_URL).then(
      (res: string) => {
        console.log(`## latest_sim_stats = ${res}`);
        // OK.
        const json = JSON.parse(res);
        renderLatestSimStats(
            json.month_used_dcm,
            json.month_used_nuro,
            json.month_used_zero_sim);
      },
      (why: string) => {
        console.log(`## Failed to load latest_sim_stats = ${why}`);
        // NG, NOP.
      } );

};

function renderLatestSimStats(dcmMonthUsed: number, nuroMonthUsed: number, zeroSimMonthUsed: number) {
  ReactDOM.render(
      <LatestSimStats
          dcmMonthUsed={dcmMonthUsed}
          nuroMonthUsed={nuroMonthUsed}
          zeroSimMonthUsed={zeroSimMonthUsed}
      />,
      document.getElementById("latest_indicator_root"));
}

