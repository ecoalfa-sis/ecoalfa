import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase/config.js";

export async function getDoctors() {
  const doctorsQuery = query(collection(db, "doctors"), orderBy("fullName"));
  const snapshot = await getDocs(doctorsQuery);

  return snapshot.docs.map((doctorDoc) => ({
    id: doctorDoc.id,
    ...doctorDoc.data()
  }));
}

export async function createDoctor(doctor) {
  await addDoc(collection(db, "doctors"), {
    fullName: doctor.fullName.trim(),
    documentType: doctor.documentType || "CC",
    documentNumber: doctor.documentNumber.trim(),
    professionalCard: doctor.professionalCard.trim(),
    specialty: doctor.specialty.trim(),
    phone: doctor.phone.trim(),
    email: doctor.email.trim().toLowerCase(),
    address: doctor.address.trim(),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
