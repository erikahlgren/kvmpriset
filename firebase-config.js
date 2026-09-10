// 1) Firebase console → Project settings → Your apps → the </> web app → paste its config below.
// 2) Deploy, open the site once, copy the "Ditt ID" shown in the host panel, send it to Claude.
// 3) Claude will give you exact Firestore security rules naming that ID — paste those into
//    Firestore → Rules and publish. Until then, HOST_UID stays empty and host actions will fail.
var FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
