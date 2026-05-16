import {
  createUserWithEmailAndPassword,
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { db, app } from "../firebase/config.js";

const USERS_PAGE_SIZE = 10;

export async function getUsersPage(lastVisible = null) {
  const constraints = [orderBy("displayName"), limit(USERS_PAGE_SIZE)];

  if (lastVisible) {
    constraints.splice(1, 0, startAfter(lastVisible));
  }

  const usersQuery = query(collection(db, "users"), ...constraints);
  const snapshot = await getDocs(usersQuery);

  return {
    users: snapshot.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data()
    })),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === USERS_PAGE_SIZE
  };
}

export async function createUserWithProfile(profile) {
  const secondaryApp = initializeApp(app.options, `secondary-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  let uid;
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, profile.email.trim().toLowerCase(), profile.password);
    uid = credential.user.uid;
    await secondaryAuth.signOut();
  } finally {
    await secondaryApp.delete();
  }

  await upsertUserProfile(uid, profile);
  return uid;
}

export async function upsertUserProfile(uid, profile) {
  const now = serverTimestamp();
  const userRef = doc(db, "users", uid);

  await setDoc(userRef, {
    uid,
    email: profile.email.trim().toLowerCase(),
    displayName: profile.displayName.trim(),
    role: profile.role,
    active: profile.active,
    createdAt: now,
    updatedAt: now
  }, { merge: true });
}

export async function updateUserProfile(uid, changes) {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    ...changes,
    updatedAt: serverTimestamp()
  });
}
