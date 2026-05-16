import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { ROLES } from "../auth/roles.js";
import { db } from "../firebase/config.js";

const KPI_LIMIT = 50;

export async function getDashboardKpis(role) {
  let inventory = { lowStock: [] };
  try {
    inventory = await getInventorySnapshot();
  } catch (error) {
    console.warn("No se pudo cargar inventario:", error.message);
  }

  if (role !== ROLES.ADMIN) {
    return {
      dailyIncome: 0,
      monthlyIncome: 0,
      attendedAppointments: 0,
      topMedicines: [],
      lowStock: inventory.lowStock,
      incomeByDay: buildEmptyIncomeByDay(),
      pendingAppointments: [],
      limited: true
    };
  }

  const [invoices, attendedAppointments, pendingAppointments] = await Promise.all([
    getRecentInvoices(),
    getAttendedAppointments(),
    getPendingAppointmentsToday()
  ]);

  return {
    dailyIncome: sumInvoicesByDate(invoices, getTodayKey()),
    monthlyIncome: sumInvoicesByMonth(invoices, getCurrentMonthKey()),
    attendedAppointments: attendedAppointments.length,
    topMedicines: getTopMedicines(invoices),
    lowStock: inventory.lowStock,
    incomeByDay: getIncomeByDay(invoices),
    pendingAppointments,
    limited: false
  };
}

async function getRecentInvoices() {
  const invoicesQuery = query(
    collection(db, "invoices"),
    orderBy("createdAt", "desc"),
    limit(KPI_LIMIT)
  );
  const snapshot = await getDocs(invoicesQuery);

  return snapshot.docs.map((invoiceDoc) => ({
    id: invoiceDoc.id,
    ...invoiceDoc.data()
  }));
}

async function getAttendedAppointments() {
  const appointmentsQuery = query(
    collection(db, "appointments"),
    where("status", "==", "Atendida"),
    limit(KPI_LIMIT)
  );
  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((appointmentDoc) => ({
    id: appointmentDoc.id,
    ...appointmentDoc.data()
  }));
}

async function getPendingAppointmentsToday() {
  const today = getTodayKey();
  const appointmentsQuery = query(
    collection(db, "appointments"),
    where("date", "==", today),
    where("status", "in", ["Programada", "Confirmada", "En espera"]),
    orderBy("time", "asc"),
    limit(20)
  );
  const snapshot = await getDocs(appointmentsQuery);

  return snapshot.docs.map((appointmentDoc) => ({
    id: appointmentDoc.id,
    ...appointmentDoc.data()
  }));
}

async function getInventorySnapshot() {
  const inventoryQuery = query(
    collection(db, "inventory"),
    orderBy("name"),
    limit(KPI_LIMIT)
  );
  const snapshot = await getDocs(inventoryQuery);
  const medicines = snapshot.docs.map((medicineDoc) => ({
    id: medicineDoc.id,
    ...medicineDoc.data()
  }));

  return {
    lowStock: medicines.filter((medicine) => Number(medicine.stock || 0) <= Number(medicine.minStock || 0))
  };
}

function sumInvoicesByDate(invoices, dateKey) {
  return invoices
    .filter((invoice) => getTimestampDateKey(invoice.createdAt) === dateKey)
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);
}

function sumInvoicesByMonth(invoices, monthKey) {
  return invoices
    .filter((invoice) => getTimestampDateKey(invoice.createdAt).startsWith(monthKey))
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);
}

function getTopMedicines(invoices) {
  const totals = new Map();

  invoices.forEach((invoice) => {
    (invoice.items || [])
      .filter((item) => item.type === "medicine")
      .forEach((item) => {
        const current = totals.get(item.name) || 0;
        totals.set(item.name, current + Number(item.quantity || 0));
      });
  });

  return [...totals.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

function getIncomeByDay(invoices) {
  const days = buildEmptyIncomeByDay();

  invoices.forEach((invoice) => {
    const dateKey = getTimestampDateKey(invoice.createdAt);

    if (dateKey in days) {
      days[dateKey] += Number(invoice.total || 0);
    }
  });

  return days;
}

function buildEmptyIncomeByDay() {
  return Array.from({ length: 7 }).reduce((days, _, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    days[date.toISOString().slice(0, 10)] = 0;
    return days;
  }, {});
}

function getTimestampDateKey(timestamp) {
  if (!timestamp?.toDate) {
    return "";
  }

  return timestamp.toDate().toISOString().slice(0, 10);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}
