import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase/config.js";

const PATIENTS_PAGE_SIZE = 15;
const RECORDS_PAGE_SIZE = 10;

export async function getPatientsPage(lastVisible = null) {
  const constraints = [orderBy("fullName"), limit(PATIENTS_PAGE_SIZE)];

  if (lastVisible) {
    constraints.splice(1, 0, startAfter(lastVisible));
  }

  const patientsQuery = query(collection(db, "patients"), ...constraints);
  const snapshot = await getDocs(patientsQuery);

  return {
    patients: snapshot.docs.map((patientDoc) => ({
      id: patientDoc.id,
      ...patientDoc.data()
    })),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === PATIENTS_PAGE_SIZE
  };
}

export async function searchPatientsByDocument(documentNumber) {
  const patientsQuery = query(
    collection(db, "patients"),
    where("documentNumber", "==", documentNumber.trim()),
    limit(10)
  );
  const snapshot = await getDocs(patientsQuery);

  return snapshot.docs.map((patientDoc) => ({
    id: patientDoc.id,
    ...patientDoc.data()
  }));
}

export async function upsertPatient(patientId, patient) {
  const firstName = patient.firstName?.trim() || "";
  const secondName = patient.secondName?.trim() || "";
  const firstLastName = patient.firstLastName?.trim() || "";
  const secondLastName = patient.secondLastName?.trim() || "";
  const fullName = patient.fullName?.trim() || [firstName, secondName, firstLastName, secondLastName].filter(Boolean).join(" ");

  const payload = {
    documentType: patient.documentType || "CC",
    documentNumber: patient.documentNumber.trim(),
    firstName,
    secondName,
    firstLastName,
    secondLastName,
    fullName,
    phone: patient.phone?.trim() || "",
    email: patient.email?.trim().toLowerCase() || "",
    birthDate: patient.birthDate || "",
    gender: patient.gender || "Prefiero no decirlo",
    address: patient.address?.trim() || "",
    neighborhood: patient.neighborhood?.trim() || "",
    municipality: patient.municipality?.trim() || "",
    eps: patient.eps?.trim() || "",
    bloodType: patient.bloodType || "",
    occupation: patient.occupation?.trim() || "",
    emergencyContactName: patient.emergencyContactName?.trim() || "",
    emergencyContactPhone: patient.emergencyContactPhone?.trim() || "",
    background: patient.background?.trim() || "",
    updatedAt: serverTimestamp()
  };

  if (patientId) {
    await updateDoc(doc(db, "patients", patientId), payload);
    return patientId;
  }

  const patientRef = await addDoc(collection(db, "patients"), {
    ...payload,
    createdAt: serverTimestamp()
  });

  return patientRef.id;
}

export async function getClinicalRecords(patientId, lastVisible = null) {
  const constraints = [orderBy("createdAt", "desc"), limit(RECORDS_PAGE_SIZE)];

  if (lastVisible) {
    constraints.splice(1, 0, startAfter(lastVisible));
  }

  const recordsQuery = query(collection(db, "patients", patientId, "clinicalRecords"), ...constraints);
  const snapshot = await getDocs(recordsQuery);

  return {
    records: snapshot.docs.map((recordDoc) => ({
      id: recordDoc.id,
      ...recordDoc.data()
    })),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === RECORDS_PAGE_SIZE
  };
}

export async function createClinicalRecord(patientId, record) {
  await addDoc(collection(db, "patients", patientId, "clinicalRecords"), {
    reason: record.reason?.trim() || "",
    currentIllness: record.currentIllness?.trim() || "",
    personalHistory: record.personalHistory?.trim() || "",
    familyHistory: record.familyHistory?.trim() || "",
    allergies: record.allergies?.trim() || "",
    currentMedications: record.currentMedications?.trim() || "",
    vitalSigns: {
      bloodPressure: record.bloodPressure?.trim() || "",
      heartRate: record.heartRate?.trim() || "",
      respiratoryRate: record.respiratoryRate?.trim() || "",
      temperature: record.temperature?.trim() || "",
      oxygenSaturation: record.oxygenSaturation?.trim() || "",
      weight: record.weight?.trim() || "",
      height: record.height?.trim() || ""
    },
    physicalExam: record.physicalExam?.trim() || "",
    systemsReview: record.systemsReview?.trim() || "",
    diagnosis: record.diagnosis?.trim() || "",
    cie10: record.cie10?.trim() || "",
    treatmentPlan: record.treatmentPlan?.trim() || "",
    prescription: record.prescription?.trim() || "",
    recommendations: record.recommendations?.trim() || "",
    followUp: record.followUp?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
