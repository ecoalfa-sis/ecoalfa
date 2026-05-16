import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch
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

export async function getPatientById(patientId) {
  const patientRef = doc(db, "patients", patientId);
  const patientSnap = await getDoc(patientRef);

  if (!patientSnap.exists()) {
    return null;
  }

  return {
    id: patientSnap.id,
    ...patientSnap.data()
  };
}

export async function getPatientByDocument(documentNumber) {
  const patientsQuery = query(
    collection(db, "patients"),
    where("documentNumber", "==", documentNumber.trim()),
    limit(1)
  );
  const snapshot = await getDocs(patientsQuery);

  if (snapshot.empty) {
    return null;
  }

  const patientDoc = snapshot.docs[0];
  return {
    id: patientDoc.id,
    ...patientDoc.data()
  };
}

export async function linkPatientToAuth(patientId, authUid, email) {
  await updateDoc(doc(db, "patients", patientId), {
    authUid,
    email,
    source: "linked",
    linkedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function mergePatientRecords(sourcePatientId, targetPatientId) {
  const sourceRecordsQuery = query(
    collection(db, "patients", sourcePatientId, "clinicalRecords"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(sourceRecordsQuery);

  const batch = [];
  snapshot.docs.forEach((recordDoc) => {
    const recordData = recordDoc.data();
    batch.push(
      addDoc(collection(db, "patients", targetPatientId, "clinicalRecords"), {
        ...recordData,
        mergedFrom: sourcePatientId,
        mergedAt: serverTimestamp()
      })
    );
  });

  await Promise.all(batch);
  return batch.length;
}

export async function upsertPatient(patientId, patient) {
  const firstName = patient.firstName?.trim() || "";
  const middleName = patient.middleName?.trim() || "";
  const firstLastName = patient.firstLastName?.trim() || "";
  const secondLastName = patient.secondLastName?.trim() || "";
  const fullName = patient.fullName?.trim() || [firstName, middleName, firstLastName, secondLastName].filter(Boolean).join(" ");

  const payload = {
    documentType: patient.documentType || "CC",
    documentNumber: patient.documentNumber.trim(),
    firstName,
    middleName,
    firstLastName,
    secondLastName,
    fullName,
    email: patient.email?.trim().toLowerCase() || "",
    phone: patient.phone?.trim() || "",
    address: patient.address?.trim() || "",
    neighborhood: patient.neighborhood?.trim() || "",
    municipality: patient.municipality?.trim() || "",
    gender: patient.gender || "Prefiero no decirlo",
    customGender: patient.customGender?.trim() || "",
    birthDate: patient.birthDate || "",
    eps: patient.eps?.trim() || "",
    bloodType: patient.bloodType || "",
    emergencyContactName: patient.emergencyContactName?.trim() || "",
    emergencyContactPhone: patient.emergencyContactPhone?.trim() || "",
    allergies: patient.allergies?.trim() || "",
    background: patient.background?.trim() || "",
    source: patient.source || "manual",
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
    consultationDate: record.consultationDate || new Date().toISOString().slice(0, 10),
    doctorName: record.doctorName?.trim() || "",
    reason: record.reason.trim(),
    currentIllness: record.currentIllness.trim(),
    personalHistory: record.personalHistory?.trim() || "",
    familyHistory: record.familyHistory?.trim() || "",
    surgicalHistory: record.surgicalHistory?.trim() || "",
    pharmacologicalHistory: record.pharmacologicalHistory?.trim() || "",
    allergies: record.allergies?.trim() || "",
    gynecoObstetricHistory: record.gynecoObstetricHistory?.trim() || "",
    systemsReview: record.systemsReview.trim(),
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
    diagnosis: record.diagnosis.trim(),
    cie10: record.cie10?.trim() || "",
    treatmentPlan: record.treatmentPlan?.trim() || "",
    prescription: record.prescription.trim(),
    recommendations: record.recommendations?.trim() || "",
    nextControl: record.nextControl || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
