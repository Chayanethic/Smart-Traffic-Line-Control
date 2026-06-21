import admin from "firebase-admin";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.LOCAL_DATA_FILE || path.join(directory, "..", "data", "stcs-data.json");
let db = null;
let local = { documents: {}, collections: {} };

export async function initializeStore() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
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
    console.log("Firestore persistence enabled.");
    return;
  }

  try {
    local = JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch {
    await flush();
  }
  console.warn(`Firebase Admin credentials not found. Persistent local store: ${dataFile}`);
}

async function flush() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(local, null, 2));
}

export async function save(collection, id, data) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  if (db) await db.collection(collection).doc(id).set(payload, { merge: true });
  else {
    local.documents[collection] ||= {};
    local.documents[collection][id] = { ...(local.documents[collection][id] || {}), ...payload };
    await flush();
  }
  return payload;
}

export async function get(collection, id) {
  if (db) {
    const snapshot = await db.collection(collection).doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }
  return local.documents[collection]?.[id] || null;
}

export async function list(collection, limit = 100) {
  if (db) {
    const snapshot = await db.collection(collection).orderBy("createdAt", "desc").limit(limit).get();
    return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  }
  return (local.collections[collection] || []).slice(-limit).reverse();
}

export async function append(collection, data) {
  const payload = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
  if (db) await db.collection(collection).doc(payload.id).set(payload);
  else {
    local.collections[collection] ||= [];
    local.collections[collection].push(payload);
    await flush();
  }
  return payload;
}

export function usingFirestore() {
  return Boolean(db);
}
