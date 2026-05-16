import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase/config.js";

const INVENTORY_PAGE_SIZE = 15;
const MOVEMENTS_PAGE_SIZE = 10;

export const MOVEMENT_TYPES = {
  IN: "entrada",
  OUT: "salida",
  ADJUSTMENT: "ajuste"
};

export async function getInventoryPage(lastVisible = null) {
  const constraints = [orderBy("name"), limit(INVENTORY_PAGE_SIZE)];

  if (lastVisible) {
    constraints.splice(1, 0, startAfter(lastVisible));
  }

  const inventoryQuery = query(collection(db, "inventory"), ...constraints);
  const snapshot = await getDocs(inventoryQuery);

  return {
    medicines: snapshot.docs.map((medicineDoc) => ({
      id: medicineDoc.id,
      ...medicineDoc.data()
    })),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === INVENTORY_PAGE_SIZE
  };
}

export async function upsertMedicine(medicineId, medicine) {
  const payload = {
    name: medicine.name.trim(),
    activeIngredient: medicine.activeIngredient?.trim() || "",
    sanitaryRegistry: medicine.sanitaryRegistry?.trim() || "",
    laboratory: medicine.laboratory?.trim() || "",
    lot: medicine.lot?.trim() || "",
    expirationDate: medicine.expirationDate || "",
    potency: medicine.potency.trim(),
    presentation: medicine.presentation.trim(),
    concentration: medicine.concentration?.trim() || "",
    storageConditions: medicine.storageConditions?.trim() || "",
    location: medicine.location?.trim() || "",
    supplier: medicine.supplier?.trim() || "",
    stock: Number(medicine.stock || 0),
    salePrice: Number(medicine.salePrice || 0),
    purchasePrice: Number(medicine.purchasePrice || 0),
    minStock: Number(medicine.minStock || 0),
    updatedAt: serverTimestamp()
  };

  if (medicineId) {
    await updateDoc(doc(db, "inventory", medicineId), payload);
    return medicineId;
  }

  const medicineRef = await addDoc(collection(db, "inventory"), {
    ...payload,
    createdAt: serverTimestamp()
  });

  return medicineRef.id;
}

export async function registerInventoryMovement(medicineId, movement) {
  const quantity = Number(movement.quantity || 0);
  const signedQuantity = movement.type === MOVEMENT_TYPES.OUT ? quantity * -1 : quantity;
  const batch = writeBatch(db);
  const medicineRef = doc(db, "inventory", medicineId);
  const movementRef = doc(collection(db, "inventory", medicineId, "movements"));

  batch.update(medicineRef, {
    stock: increment(signedQuantity),
    updatedAt: serverTimestamp()
  });

  batch.set(movementRef, {
    type: movement.type,
    quantity,
    signedQuantity,
    note: movement.note.trim(),
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

export async function getMedicineMovements(medicineId, lastVisible = null) {
  const constraints = [orderBy("createdAt", "desc"), limit(MOVEMENTS_PAGE_SIZE)];

  if (lastVisible) {
    constraints.splice(1, 0, startAfter(lastVisible));
  }

  const movementsQuery = query(collection(db, "inventory", medicineId, "movements"), ...constraints);
  const snapshot = await getDocs(movementsQuery);

  return {
    movements: snapshot.docs.map((movementDoc) => ({
      id: movementDoc.id,
      ...movementDoc.data()
    })),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === MOVEMENTS_PAGE_SIZE
  };
}
