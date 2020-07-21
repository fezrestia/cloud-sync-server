import * as firebase from "firebase/app";
import "firebase/auth";

/**
 * Firebase config interface.
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

//// AUTO GENERATED CODE FROM HERE.
//

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDuXyonRhnpud9nZxT2vtkrtLRySZd25Wo",
  authDomain: "cloud-sync-service.firebaseapp.com",
  databaseURL: "https://cloud-sync-service.firebaseio.com",
  projectId: "cloud-sync-service",
  storageBucket: "cloud-sync-service.appspot.com",
  messagingSenderId: "222116558624",
  appId: "1:222116558624:web:96a3c12db6310fd86b8945"
};

//
//// AUTO GENERATED CODE TO HERE.

/**
 * Global context object.
 */
export class Context {
  private static INSTANCE: Context|null = null;

  /**
   * Get current global CONTEXT object.
   */
  public static getInstance(): Context {
    if (Context.INSTANCE == null) {
      Context.INSTANCE = new Context();
    }
    return Context.INSTANCE;
  }

  private constructor() {
    console.log("## Context.constructor()");

    firebase.initializeApp(FIREBASE_CONFIG);
  }

  /**
   * Set callback object for Firebase.
   *
   * @authCallback Firebase.Auth.onAuthStateChanged callback
   */
  public setFirebaseCallback(authCallback: (user: firebase.User|null) => void) {
    // Auth state observer.
    firebase.auth().onAuthStateChanged(
        (user: firebase.User|null) => {
          if (user != null) {
            console.log(`Login : ${user.email}`);
          } else {
            console.log("Logout");
          }

          authCallback(user);

        },
        (error: firebase.auth.Error) => {
          console.log(`ERR: AuthStateChanged() : error.code=${error.code}`);
          console.log(`ERR: AuthStateChanged() : error.message=${error.message}`);
        } );

  }

  /**
   * Get static firebase config object.
   */
  public firebaseConfig(): FirebaseConfig {
    return FIREBASE_CONFIG;
  }




}
