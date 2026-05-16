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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../firebase/config.js";

export const APPOINTMENT_STATUSES = [
  "Solicitada",
  "Programada",
  "Confirmada",
  "En Sala de Espera",
  "Atendida",
  "Cancelada"
];

export async function getAppointmentsByDate(dateKey, lastVisible = null) {
  const constraints = [
    where("dateKey", "==", dateKey)
  ];

  const appointmentsQuery = query(collection(db, "appointments"), ...constraints);
  const snapshot = await getDocs(appointmentsQuery);

  return {
    appointments: snapshot.docs.map((appointmentDoc) => ({
      id: appointmentDoc.id,
      ...appointmentDoc.data()
    })).sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))),
    lastVisible: snapshot.docs.at(-1) || null,
    hasMore: false
  };
}

export async function createAppointment(appointment) {
  await addDoc(collection(db, "appointments"), {
    ...appointment,
    status: appointment.status || "Programada",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateAppointment(appointmentId, changes, user = null) {
  const appointmentRef = doc(db, "appointments", appointmentId);
  const updateData = {
    ...changes,
    updatedAt: serverTimestamp()
  };
  
  if (user) {
    updateData.lastModifiedBy = {
      uid: user.uid,
      name: user.displayName || user.email,
      timestamp: serverTimestamp()
    };
  }
  
  await updateDoc(appointmentRef, updateData);
}

export async function updateAppointmentStatus(appointmentId, newStatus, user) {
  const appointmentRef = doc(db, "appointments", appointmentId);
  const appointmentSnap = await getDoc(appointmentRef);
  
  if (!appointmentSnap.exists()) {
    throw new Error("Cita no encontrada");
  }
  
  const updateData = {
    status: newStatus,
    updatedAt: serverTimestamp(),
    lastModifiedBy: {
      uid: user.uid,
      name: user.displayName || user.email,
      timestamp: serverTimestamp()
    }
  };
  
  const now = new Date();
  const timeString = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  
  if (newStatus === "En Sala de Espera" && !appointmentSnap.data().arrivalTime) {
    updateData.arrivalTime = timeString;
    updateData.room = "Sala Principal";
  }
  
  if (newStatus === "Atendida" && !appointmentSnap.data().attendedTime) {
    updateData.attendedTime = timeString;
  }
  
  await updateDoc(appointmentRef, updateData);
}

export async function getPatients(searchTerm = "") {
  const patientsQuery = query(
    collection(db, "patients"),
    orderBy("fullName"),
    limit(50)
  );
  const snapshot = await getDocs(patientsQuery);
  
  const patients = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    return patients.filter((p) => 
      (p.fullName && p.fullName.toLowerCase().includes(term)) ||
      (p.documentNumber && p.documentNumber.includes(term))
    );
  }
  
  return patients;
}

export async function getDoctorsByRole() {
  const doctorsQuery = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    where("active", "==", true),
    orderBy("displayName"),
    limit(50)
  );
  const snapshot = await getDocs(doctorsQuery);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}
