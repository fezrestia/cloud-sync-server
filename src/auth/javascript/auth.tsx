import "../css/auth.scss";
import * as $ from "jquery";

import * as firebase from "firebase/app";
import "firebase/auth";

import { Context } from "../../context.ts";

const IS_DEBUG = true;

const ID_NEW_MAIL = "new_mail";
const ID_NEW_PASS = "new_pass";
const ID_NEW_PASS_CONFIRM = "new_pass_confirm";
const ID_NEW_USER_MESSAGE = "new_user_message";

const ID_LOGIN_MAIL = "login_mail";
const ID_LOGIN_PASS = "login_pass";
const ID_LOGIN_MESSAGE = "login_message";

const ID_CURRENT_USER = "current_user";

// Entry point from HTML.
(window as any).onAuthLoaded = () => {
  if (IS_DEBUG) console.log(`onAuthLoaded()`);

  const context: Context = Context.getInstance();

  // Setup firebase.
  context.setFirebaseCallback( (user: firebase.User|null) => {
    if (user != null) {
      const email = user.email;
      if (email != null) {
        showCurrentUser(email);
      } else {
        showCurrentUser("email == null");
      }
    } else {
      console.log("Logout");
      showCurrentUser("N/A");
    }
  } );

}

(window as any).onCreateNewUserClicked = async () => {
  if (IS_DEBUG) console.log(`onCreateNewUserClicked()`);

  let newMail: string|null = getInputString(ID_NEW_MAIL);
  let newPass: string|null = getInputString(ID_NEW_PASS);
  let newPassConfirm: string|null = getInputString(ID_NEW_PASS_CONFIRM);

  if (newMail != null && newPass != null && newPassConfirm != null) {
    if (newPass == newPassConfirm) {
      // Create new user on Firebase.
      const cred: firebase.auth.UserCredential|void = await firebase.auth()
          .createUserWithEmailAndPassword(newMail, newPass)
          .catch( (error: firebase.auth.Error) => {
            const errorCode = error.code;
            const errorMessage = error.message;

            if (IS_DEBUG) {
              console.log(`ERR: errorCode=${errorCode}`);
              console.log(`ERR: errorMessage=${errorMessage}`);
            }

            showMessage(ID_NEW_USER_MESSAGE, `CODE=${errorCode}, MSG=${errorMessage}`);

          } );

      if (IS_DEBUG) console.log("DONE");

      if (cred != undefined) {
        showMessage(ID_NEW_USER_MESSAGE, "OK");
      }

    } else {
      if (IS_DEBUG) console.log("pass and confirm is not matched.");
    }
  } else {
    if (IS_DEBUG) console.log("mail/pass/confirm is null.");
  }

}

(window as any).onLoginUserClicked = async () => {
  if (IS_DEBUG) console.log(`onLoginUserClicked()`);

  let mail: string|null = getInputString(ID_LOGIN_MAIL);
  let pass: string|null = getInputString(ID_LOGIN_PASS);

  if (mail != null && pass != null) {
    // Login user to Firebase.
    const cred: firebase.auth.UserCredential|void = await firebase.auth()
        .signInWithEmailAndPassword(mail, pass)
        .catch( (error: firebase.auth.Error) => {
          const errorCode = error.code;
          const errorMessage = error.message;

          if (IS_DEBUG) {
            console.log(`ERR: errorCode=${errorCode}`);
            console.log(`ERR: errorMessage=${errorMessage}`);
          }

          showMessage(ID_LOGIN_MESSAGE, `CODE=${errorCode}, MSG=${errorMessage}`);

        } );

    if (IS_DEBUG) console.log("DONE");

    if (cred != undefined) {
      showMessage(ID_LOGIN_MESSAGE, "OK");
    }

  } else {
    if (IS_DEBUG) console.log("mail/pass is null.");
  }

}

(window as any).onLogoutClicked = async () => {
  if (IS_DEBUG) console.log(`onLogoutClicked()`);

  await firebase.auth().signOut();

}

function getInputString(inputId: string): string|null {
  const value = $(`#${inputId}`).val();

  if (typeof(value) === "string") {
    if (value.length != 0) {
      return value;
    } else {
      console.log("input value is empty.");
      return null;
    }
  } else {
    console.log("ERR: input value is not string.");
    return null;
  }
}

function showMessage(id: string, msg: string) {
  const elm: JQuery<HTMLElement> = $(`#${id}`);
  if (elm != undefined) {
    elm.text(msg);
  }
}

function showCurrentUser(user: string) {
  const elm: JQuery<HTMLElement> = $(`#${ID_CURRENT_USER}`);
  if (elm != undefined) {
    elm.text(user);
  }
}

