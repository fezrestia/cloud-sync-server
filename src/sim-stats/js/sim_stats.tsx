import * as $ from "jquery";
import * as React from "react";
import * as ReactDOM from "react-dom";
import firebase from "firebase";
import "firebase/auth";
import "firebase/functions";

import "../css/sim_stats.scss";
import { LatestSimStats } from "./components/LatestSimStats";
import { asyncGetHttp } from "../../common/js/http";
import { Context } from "../../context";

const GET_LATEST_SIM_STATS_URL = "https://asia-northeast1-cloud-sync-service.cloudfunctions.net/httpsGetLatestSimStats";

const SRV_DCM = "dcm";
const SRV_NURO = "nuro";
const SRV_ZEROSIM = "zerosim";

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

  // Firebase.
  const context: Context = Context.getInstance();
  context.setFirebaseCallback( (user: firebase.User|null) => {
    if (user != null) {
      $(`#update_${SRV_DCM}_stats`).prop("disabled", false);
      $(`#update_${SRV_NURO}_stats`).prop("disabled", false);
      $(`#update_${SRV_ZEROSIM}_stats`).prop("disabled", false);
    } else {
      $(`#update_${SRV_DCM}_stats`).prop("disabled", true);
      $(`#update_${SRV_NURO}_stats`).prop("disabled", true);
      $(`#update_${SRV_ZEROSIM}_stats`).prop("disabled", true);
    }
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

(window as any).onUpdateDcmStatsClicked = async () => {
  console.log("## onUpdateDcmStatsClicked()");
  $(`#update_${SRV_DCM}_stats`).prop("disabled", true);
  await requestUpdateSimStats(SRV_DCM);
}

(window as any).onUpdateNuroStatsClicked = async () => {
  console.log("## onUpdateNuroStatsClicked()");
  $(`#update_${SRV_NURO}_stats`).prop("disabled", true);
  await requestUpdateSimStats(SRV_NURO);
}

(window as any).onUpdateZeroSimStatsClicked = async () => {
  console.log("## onUpdateZeroSimStatsClicked()");
  $(`#update_${SRV_ZEROSIM}_stats`).prop("disabled", true);
  await requestUpdateSimStats(SRV_ZEROSIM);
}

async function requestUpdateSimStats(srv: string) {
  const callUpdateSimStats = firebase.app()
      .functions("asia-northeast1")
      .httpsCallable("callUpdateSimStats");

  const params = {
    service: srv,
  };

  await callUpdateSimStats(params)
      .then( (result: any) => {
        console.log("## result");
        console.log(result);

        let msg: string;

        const isError = result.data.is_error;
        if (!isError) {
          msg = "OK";
        } else {
          msg = result.data.message;
        }

        $(`#update_${srv}_stats_res`).text(msg);
      } )
      .catch( (error: any) => {
        console.log("## error");
        console.log(error);

        $(`#update_${srv}_stats_res`).text(JSON.stringify(error));
      } );

  $(`#update_${srv}_stats`).prop("disabled", false);

  console.log("DONE");
}
