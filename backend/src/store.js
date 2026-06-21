import admin from "firebase-admin";
import crypto from "node:crypto";

let db = null;

export async function initializeStore() {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (!FIREBASE_PROJECT_ID ||
      !FIREBASE_CLIENT_EMAIL ||
      !FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase credentials missing.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  db = admin.firestore();
  console.log("Firestore connected.");
}

export async function save(collection, id, data) {
  const payload = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(collection)
    .doc(id)
    .set(payload, { merge: true });

  return payload;
}

export async function get(collection, id) {
  const snapshot = await db.collection(collection)
    .doc(id)
    .get();

  return snapshot.exists ? snapshot.data() : null;
}

export async function list(collection, limit = 100) {
  const snapshot = await db.collection(collection)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function append(collection, data) {
  const payload = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  };

  await db.collection(collection)
    .doc(payload.id)
    .set(payload);

  return payload;
}

export function usingFirestore() {
  return true;
}