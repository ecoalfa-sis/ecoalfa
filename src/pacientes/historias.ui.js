import {
  createClinicalRecord,
  getClinicalRecords,
  getPatientById,
  getPatientsPage,
} from "./pacientes.service.js";
import { getSession } from "../auth/session.js";
import { getTodayAppointmentsForDoctor } from "../citas/citas.service.js";

const COLOMBIA_TIME_ZONE = "America/Bogota";

let currentPatients = [];
let currentRecords = [];
let selectedPatient = null;
let lastVisiblePatient = null;
let lastVisibleRecord = null;
let canLoadMorePatients = false;
let canLoadMoreRecords = false;
let currentMode = "historias";

export async function renderHistoriasModule(container) {
  currentMode = "historias";
  container.innerHTML = renderMainView();
  bindMainEvents(container);
  await selectStoredPatient(container);
}

export async function renderAtencionMedicaModule(container) {
  currentMode = "atencion";
  container.innerHTML = renderMainView();
  bindMainEvents(container);
  await selectStoredPatient(container);
}

function renderMainView() {
  return `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">${currentMode === "atencion" ? "Atención médica" : "Historias clínicas"}</h2>
        <p class="text-slate-500">${currentMode === "atencion" ? "Inicie consultas y revise las citas asignadas para hoy." : "Gestión profesional del historial clínico, búsqueda de pacientes, evolución y PDF."}</p>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <button id="open-patient-search" class="group rounded-2xl bg-emerald-600 p-8 text-left text-white shadow-lg transition hover:bg-emerald-700 hover:shadow-xl">
          <div class="flex items-center gap-4">
            <div class="rounded-xl bg-white/20 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold">${currentMode === "atencion" ? "Ver mis citas del día" : "Buscar historial clínico"}</h3>
              <p class="mt-1 text-sm text-emerald-100">${currentMode === "atencion" ? "Pacientes con citas asignadas al médico para hoy." : "Buscar pacientes para consultar y gestionar su historial."}</p>
            </div>
          </div>
        </button>

        <button id="open-consultation-form" class="group rounded-2xl bg-slate-700 p-8 text-left text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl" ${!selectedPatient ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
          <div class="flex items-center gap-4">
            <div class="rounded-xl bg-white/20 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold">${currentMode === "atencion" ? "Iniciar atención" : "Registrar evolución"}</h3>
              <p class="mt-1 text-sm text-slate-300">${selectedPatient ? `Paciente: ${selectedPatient.fullName}` : "Primero seleccione un paciente"}</p>
            </div>
          </div>
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <article class="rounded-2xl bg-emerald-50 p-5 text-emerald-950 ring-1 ring-emerald-100">
          <p class="text-sm font-medium text-emerald-700">Estructura</p>
          <strong class="mt-2 block text-2xl">SOAP</strong>
          <p class="mt-2 text-sm">Subjetivo, Objetivo, Análisis y Plan de manejo médico.</p>
        </article>
        <article class="rounded-2xl bg-sky-50 p-5 text-sky-950 ring-1 ring-sky-100">
          <p class="text-sm font-medium text-sky-700">Prescripción</p>
          <strong class="mt-2 block text-2xl">Fórmula médica</strong>
          <p class="mt-2 text-sm">Medicamentos, dosis, frecuencia y duración del tratamiento.</p>
        </article>
        <article class="rounded-2xl bg-lime-50 p-5 text-lime-950 ring-1 ring-lime-100">
          <p class="text-sm font-medium text-lime-700">Documentación</p>
          <strong class="mt-2 block text-2xl">PDF</strong>
          <p class="mt-2 text-sm">Generación de documento imprimible por cada consulta.</p>
        </article>
      </div>

      <!-- Modal Buscar Paciente -->
      <div id="patient-search-modal" class="fixed inset-0 z-50 hidden bg-black/50 backdrop-blur-sm">
        <div class="flex min-h-screen items-center justify-center p-4">
          <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <h3 class="text-xl font-bold text-slate-900">${currentMode === "atencion" ? "Pacientes asignados hoy" : "Búsqueda de historiales clínicos"}</h3>
              <button id="close-search-modal" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="mb-4 flex gap-2">
              <input id="history-patient-search" placeholder="${currentMode === "atencion" ? "Filtrar pacientes asignados por nombre o documento" : "Buscar por nombre o documento"}" class="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              <button id="history-search-patient" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Filtrar</button>
              <button id="history-refresh-patients" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Actualizar</button>
            </div>

            <div id="history-patients-list" class="max-h-[400px] overflow-y-auto space-y-2">
              <div class="p-6 text-sm text-slate-500 text-center">${currentMode === "atencion" ? "Cargando pacientes asignados a usted para hoy..." : "Use la búsqueda o actualizar para cargar pacientes."}</div>
            </div>

            <div class="mt-4 flex justify-end">
              <button id="history-load-more-patients" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" disabled>Cargar más</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Registrar Consulta -->
      <div id="consultation-modal" class="fixed inset-0 z-50 hidden bg-black/50 backdrop-blur-sm">
        <div class="flex min-h-screen items-center justify-center p-4">
          <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 class="text-xl font-bold text-slate-900">Registrar consulta médica</h3>
                <p id="consultation-patient-name" class="text-sm text-slate-500 mt-1">Paciente: ${selectedPatient?.fullName || "No seleccionado"}</p>
              </div>
              <div class="flex items-center gap-2">
                <button id="change-consultation-patient" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button">Cambiar paciente</button>
                <button id="close-consultation-modal" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="grid gap-6 xl:grid-cols-[1fr_420px]">
              <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div class="mb-4 flex items-center justify-between">
                  <h4 class="text-lg font-bold text-slate-900">Historial de consultas</h4>
                </div>
                <div id="clinical-records-list" class="space-y-4 max-h-[500px] overflow-y-auto">
                  <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 text-center">
                    Seleccione un paciente para ver su historial clínico.
                  </div>
                </div>
                <div class="mt-4">
                  <button id="load-more-records" class="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" disabled>Cargar más visitas</button>
                </div>
              </section>

              <form id="clinical-record-form" class="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <h4 class="text-lg font-bold text-slate-900">Nueva atención</h4>
                <p class="mt-1 text-sm text-slate-500">Complete los campos clínicos.</p>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-consultationDate">Fecha *</label>
                    <input id="record-consultationDate" type="date" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-doctorName">Médico tratante</label>
                    <input id="record-doctorName" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-cie10">CIE-10</label>
                    <input id="record-cie10" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-nextControl">Próximo control</label>
                    <input id="record-nextControl" type="date" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                </div>

                <div class="mt-4 space-y-3">
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-reason">Motivo de consulta *</label>
                    <textarea id="record-reason" rows="2" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-currentIllness">Enfermedad actual *</label>
                    <textarea id="record-currentIllness" rows="3" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-personalHistory">Antecedentes relevantes</label>
                    <textarea id="record-personalHistory" rows="2" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-bloodPressure">TA</label>
                    <input id="record-bloodPressure" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-heartRate">FC</label>
                    <input id="record-heartRate" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-temperature">Temp.</label>
                    <input id="record-temperature" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-weight">Peso</label>
                    <input id="record-weight" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  </div>
                </div>

                <div class="mt-4 space-y-3">
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-physicalExam">Examen físico</label>
                    <textarea id="record-physicalExam" rows="3" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-diagnosis">Diagnóstico *</label>
                    <textarea id="record-diagnosis" rows="2" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-treatmentPlan">Plan de manejo</label>
                    <textarea id="record-treatmentPlan" rows="2" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-prescription">Prescripción / fórmula *</label>
                    <textarea id="record-prescription" rows="3" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="record-recommendations">Recomendaciones</label>
                    <textarea id="record-recommendations" rows="2" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
                  </div>
                </div>

                <p id="clinical-message" class="mt-4 hidden rounded-xl px-4 py-3 text-sm"></p>
                <button class="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800" type="submit">Guardar visita clínica</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindMainEvents(container) {
  // Abrir modal de búsqueda
  container.querySelector("#open-patient-search").addEventListener("click", () => {
    container.querySelector("#patient-search-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    loadPatients(container, true);
  });

  // Cerrar modal de búsqueda
  container.querySelector("#close-search-modal").addEventListener("click", () => {
    closeSearchModal(container);
  });

  // Cerrar al hacer click fuera
  container.querySelector("#patient-search-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closeSearchModal(container);
    }
  });

  // Abrir modal de consulta
  container.querySelector("#open-consultation-form")?.addEventListener("click", () => {
    if (!selectedPatient) {
      alert("Primero debe seleccionar un paciente");
      return;
    }
    openConsultationModal(container);
    // Recargar historial
    loadRecords(container, true);
  });

  // Cerrar modal de consulta
  container.querySelector("#close-consultation-modal").addEventListener("click", () => {
    closeConsultationModal(container);
  });

  container.querySelector("#change-consultation-patient")?.addEventListener("click", async () => {
    closeConsultationModal(container);
    container.querySelector("#patient-search-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    await loadPatients(container, true);
  });

  // Cerrar al hacer click fuera
  container.querySelector("#consultation-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closeConsultationModal(container);
    }
  });

  // Eventos de búsqueda y paginación
  container.querySelector("#history-refresh-patients").addEventListener("click", async () => loadPatients(container, true));
  container.querySelector("#history-load-more-patients").addEventListener("click", async () => loadPatients(container, false));
  container.querySelector("#history-search-patient").addEventListener("click", async () => searchPatients(container));
  container.querySelector("#history-patient-search").addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchPatients(container);
  });

  // Formulario de consulta
  container.querySelector("#clinical-record-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveClinicalRecord(container, event.currentTarget);
  });

  // Cargar más registros
  container.querySelector("#load-more-records")?.addEventListener("click", async () => loadRecords(container, false));
}

function closeSearchModal(container) {
  container.querySelector("#patient-search-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

function openConsultationModal(container) {
  const form = container.querySelector("#clinical-record-form");
  const session = getSession();
  const dateInput = form?.querySelector("#record-consultationDate");
  const doctorInput = form?.querySelector("#record-doctorName");

  if (dateInput && !dateInput.value) {
    dateInput.value = getColombiaDateKey();
  }

  if (doctorInput && !doctorInput.value) {
    doctorInput.value = session.profile?.displayName || session.user?.displayName || session.user?.email || "";
  }

  container.querySelector("#consultation-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeConsultationModal(container) {
  container.querySelector("#consultation-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

async function loadPatients(container, reset) {
  const list = container.querySelector("#history-patients-list");
  const loadMoreButton = container.querySelector("#history-load-more-patients");

  if (reset) {
    currentPatients = [];
    lastVisiblePatient = null;
  }

  list.innerHTML = `<div class="p-4 text-sm text-slate-500 text-center"><div class="inline-flex items-center gap-2"><div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></div>${currentMode === "atencion" ? "Cargando pacientes asignados..." : "Cargando pacientes..."}</div></div>`;

  try {
    if (currentMode === "atencion") {
      currentPatients = await getAssignedPatientsForCurrentDoctor();
      lastVisiblePatient = null;
      canLoadMorePatients = false;
    } else {
      const page = await getPatientsPage(lastVisiblePatient);
      currentPatients = [...currentPatients, ...page.patients];
      lastVisiblePatient = page.lastVisible;
      canLoadMorePatients = page.hasMore;
    }

    const emptyMessage = currentMode === "atencion" ? "No hay pacientes con citas asignadas a usted para hoy." : "No hay pacientes para mostrar.";
    list.innerHTML = currentPatients.length ? renderPatientCards(currentPatients) : `<div class="p-4 text-sm text-slate-500 text-center">${emptyMessage}</div>`;
    loadMoreButton.disabled = !canLoadMorePatients;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMorePatients);
    bindPatientCards(container);
  } catch (error) {
    console.error("[Historias] No fue posible cargar pacientes", error);
    list.innerHTML = `<div class="p-4 text-sm text-red-600 text-center">No fue posible cargar pacientes. ${error.message || ""}</div>`;
  }
}

async function getAssignedPatientsForCurrentDoctor() {
  const session = getSession();
  const doctorId = session.profile?.id || session.user?.uid;

  if (!doctorId) {
    throw new Error("No se encontró el médico autenticado.");
  }

  const appointments = await getTodayAppointmentsForDoctor(doctorId);
  const appointmentsByPatientId = new Map();

  appointments.forEach((appointment) => {
    if (appointment.patientId && !appointmentsByPatientId.has(appointment.patientId)) {
      appointmentsByPatientId.set(appointment.patientId, appointment);
    }
  });

  const patients = await Promise.all([...appointmentsByPatientId.keys()].map((patientId) => getPatientById(patientId)));

  return patients
    .filter(Boolean)
    .map((patient) => {
      const appointment = appointmentsByPatientId.get(patient.id);
      return {
        ...patient,
        appointmentTime: appointment?.time || "",
        appointmentId: appointment?.id || "",
        appointmentStatus: appointment?.status || "Programada"
      };
    });
}

async function searchPatients(container) {
  const term = container.querySelector("#history-patient-search").value;
  const list = container.querySelector("#history-patients-list");
  const loadMoreButton = container.querySelector("#history-load-more-patients");

  if (!term.trim()) {
    await loadPatients(container, true);
    return;
  }

  const normalizedTerm = term.trim().toLowerCase();
  const filteredPatients = currentPatients.filter((patient) =>
    String(patient.fullName || "").toLowerCase().includes(normalizedTerm) ||
    String(patient.documentNumber || "").toLowerCase().includes(normalizedTerm)
  );

  const emptyMessage = currentMode === "atencion" ? "No se encontraron pacientes asignados con ese filtro." : "No se encontraron pacientes con ese filtro.";
  list.innerHTML = filteredPatients.length ? renderPatientCards(filteredPatients) : `<div class="p-4 text-sm text-slate-500 text-center">${emptyMessage}</div>`;
  loadMoreButton.disabled = true;
  loadMoreButton.classList.add("opacity-50");
  bindPatientCards(container, filteredPatients);
}

function renderPatientCards(patients) {
  return patients.map((patient) => `
    <button data-select-patient="${patient.id}" class="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50">
      <div class="flex items-center justify-between">
        <div>
          <strong class="block text-sm text-slate-900">${patient.fullName || "Sin nombre"}</strong>
          <span class="mt-1 block text-xs text-slate-500">${patient.documentNumber || "Sin documento"}</span>
          ${renderPatientAppointmentBadge(patient)}
          <span class="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">${patient.phone || patient.email || "Sin contacto"}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  `).join("");
}

function renderPatientAppointmentBadge(patient) {
  if (currentMode !== "atencion") {
    return "";
  }

  const status = patient.appointmentStatus || "Programada";
  const label = status === "En Sala de Espera" ? "En sala" : status;
  return `<span class="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">${label}${patient.appointmentTime ? ` · ${patient.appointmentTime}` : ""}</span>`;
}

function bindPatientCards(container, patients = currentPatients) {
  container.querySelectorAll("[data-select-patient]").forEach((button) => {
    button.addEventListener("click", async () => {
      await selectPatient(container, button.dataset.selectPatient, patients);
      closeSearchModal(container);
      container.innerHTML = renderMainView();
      bindMainEvents(container);
      openConsultationModal(container);
      await loadRecords(container, true);
    });
  });
}

async function selectStoredPatient(container) {
  const storedPatientId = sessionStorage.getItem("ecoalfa:selectedPatientId");

  if (!storedPatientId) {
    return;
  }

  sessionStorage.removeItem("ecoalfa:selectedPatientId");

  const patient = await getPatientById(storedPatientId);

  if (patient) {
    currentPatients = [patient, ...currentPatients];
    await selectPatient(container, patient.id);
  }
}

async function selectPatient(container, patientId, patients = currentPatients) {
  selectedPatient = patients.find((patient) => patient.id === patientId);
  currentRecords = [];
  lastVisibleRecord = null;
}

async function loadRecords(container, reset) {
  const list = container.querySelector("#clinical-records-list");
  const loadMoreButton = container.querySelector("#load-more-records");

  if (!selectedPatient || !list) {
    return;
  }

  if (reset) {
    currentRecords = [];
    lastVisibleRecord = null;
  }

  list.innerHTML = `<div class="text-sm text-slate-500 text-center py-4">Cargando historia clínica...</div>`;

  try {
    const page = await getClinicalRecords(selectedPatient.id, lastVisibleRecord);
    currentRecords = [...currentRecords, ...page.records];
    lastVisibleRecord = page.lastVisible;
    canLoadMoreRecords = page.hasMore;

    list.innerHTML = renderRecordsList(currentRecords);
    if (loadMoreButton) {
      loadMoreButton.disabled = !canLoadMoreRecords;
      loadMoreButton.classList.toggle("opacity-50", !canLoadMoreRecords);
    }
    bindPdfButtons();
  } catch (error) {
    list.innerHTML = `<div class="text-sm text-red-600 text-center py-4">No fue posible cargar la historia clínica.</div>`;
  }
}

function renderRecordsList(records) {
  if (!records.length) {
    return `<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 text-center">Sin visitas clínicas registradas para este paciente.</div>`;
  }

  return records.map((record) => `
    <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">${record.consultationDate || formatDate(record.createdAt)}</span>
          <h4 class="mt-3 text-lg font-bold text-slate-950">${record.diagnosis || "Consulta médica"}</h4>
          <p class="text-sm text-slate-500">${record.doctorName || "Profesional no especificado"} ${record.cie10 ? `· CIE-10 ${record.cie10}` : ""}</p>
        </div>
        <div class="flex gap-2">
          <button data-print-record="${record.id}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">PDF</button>
          <button data-print-prescription="${record.id}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Prescripción</button>
        </div>
      </div>
      <div class="grid gap-3 text-sm lg:grid-cols-2">
        ${renderRecordField("Subjetivo", record.reason)}
        ${renderRecordField("Enfermedad actual", record.currentIllness)}
        ${renderRecordField("Objetivo / examen", record.physicalExam)}
        ${renderRecordField("Plan", record.treatmentPlan)}
      </div>
      <div class="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
        <strong class="block">Prescripción</strong>
        <p class="mt-1 whitespace-pre-wrap">${record.prescription || "Sin prescripción"}</p>
      </div>
    </article>
  `).join("");
}

function renderRecordField(label, value) {
  return `<div><dt class="font-semibold text-slate-500">${label}</dt><dd class="mt-1 whitespace-pre-wrap text-slate-800">${value || "Sin información"}</dd></div>`;
}

async function saveClinicalRecord(container, form) {
  if (!selectedPatient) {
    showClinicalMessage(container, "No hay paciente seleccionado.", "error");
    return;
  }

  try {
    await createClinicalRecord(selectedPatient.id, {
      consultationDate: form.querySelector("#record-consultationDate").value,
      doctorName: form.querySelector("#record-doctorName").value,
      cie10: form.querySelector("#record-cie10").value,
      nextControl: form.querySelector("#record-nextControl").value,
      reason: form.querySelector("#record-reason").value,
      currentIllness: form.querySelector("#record-currentIllness").value,
      personalHistory: form.querySelector("#record-personalHistory").value,
      bloodPressure: form.querySelector("#record-bloodPressure").value,
      heartRate: form.querySelector("#record-heartRate").value,
      temperature: form.querySelector("#record-temperature").value,
      weight: form.querySelector("#record-weight").value,
      systemsReview: "",
      physicalExam: form.querySelector("#record-physicalExam").value,
      diagnosis: form.querySelector("#record-diagnosis").value,
      treatmentPlan: form.querySelector("#record-treatmentPlan").value,
      prescription: form.querySelector("#record-prescription").value,
      recommendations: form.querySelector("#record-recommendations").value
    });

    form.reset();
    await loadRecords(container, true);
    showClinicalMessage(container, "Visita clínica guardada correctamente.", "success");
  } catch (error) {
    showClinicalMessage(container, "No fue posible guardar la visita clínica.", "error");
  }
}

function bindPdfButtons() {
  document.querySelectorAll("[data-print-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentRecords.find((item) => item.id === button.dataset.printRecord);
      if (record) {
        printRecord(record);
      }
    });
  });

  document.querySelectorAll("[data-print-prescription]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = currentRecords.find((item) => item.id === button.dataset.printPrescription);
      if (record) {
        printPrescriptionOnly(record);
      }
    });
  });
}

function printPrescriptionOnly(record) {
  const printWindow = window.open("", "_blank", "width=800,height=1000");
  const patientName = selectedPatient?.fullName || "Paciente";
  const documentNumber = selectedPatient?.documentNumber || "";
  const now = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Prescripción - ${patientName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #148dcc; padding-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #148dcc; }
          .patient-info { margin-bottom: 30px; }
          .patient-info h3 { margin: 0 0 12px 0; color: #43aa35; }
          .patient-info p { margin: 6px 0; font-size: 14px; }
          .prescription-box { border: 2px solid #148dcc; border-radius: 12px; padding: 30px; min-height: 300px; white-space: pre-wrap; font-size: 16px; line-height: 1.8; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
          @media print { body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">ECOALFA</div>
          <div class="patient-info">
            <h3>Prescripción médica</h3>
            <p><strong>Paciente:</strong> ${patientName}</p>
            <p><strong>Documento:</strong> ${documentNumber}</p>
            <p><strong>Fecha:</strong> ${now}</p>
            <p><strong>Profesional:</strong> ${record.doctorName || "Médico"}</p>
          </div>
        </div>

        <div class="prescription-box">
${record.prescription || "Sin prescripción"}
        </div>

        <div class="footer">
          <p>ECOALFA Medicina · Colombia · Zona horaria Bogotá</p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printRecord(record) {
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  const patientName = selectedPatient?.fullName || "Paciente";
  const documentNumber = selectedPatient?.documentNumber || "";

  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Historia clínica - ${patientName}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
          header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #047857; padding-bottom: 18px; margin-bottom: 24px; }
          img { width: 96px; height: 96px; object-fit: contain; }
          h1 { margin: 0; font-size: 24px; }
          h2 { margin-top: 24px; color: #047857; border-bottom: 1px solid #d1fae5; padding-bottom: 6px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 10px; white-space: pre-wrap; }
          .label { font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; }
          button { border: 0; border-radius: 12px; background: #047857; color: white; padding: 12px 18px; font-weight: 700; }
          @media print { button { display: none; } body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Historia clínica - Ecoalfa</h1>
            <p>Paciente: <strong>${patientName}</strong><br/>Documento: <strong>${documentNumber}</strong><br/>Fecha: <strong>${record.consultationDate || formatDate(record.createdAt)}</strong></p>
          </div>
          <img src="./assets/ecoalfa-logo.jpeg" alt="Ecoalfa" />
        </header>
        <section class="grid">
          ${pdfField("Profesional", record.doctorName)}
          ${pdfField("CIE-10", record.cie10)}
          ${pdfField("Motivo", record.reason)}
          ${pdfField("Enfermedad actual", record.currentIllness)}
        </section>
        <h2>Signos vitales</h2>
        <section class="grid">
          ${pdfField("TA", record.bloodPressure)}
          ${pdfField("FC", record.heartRate)}
          ${pdfField("Temperatura", record.temperature)}
          ${pdfField("Peso", record.weight)}
        </section>
        <h2>Evaluación y plan</h2>
        ${pdfBlock("Antecedentes", record.personalHistory)}
        ${pdfBlock("Examen físico", record.physicalExam)}
        ${pdfBlock("Diagnóstico", record.diagnosis)}
        ${pdfBlock("Plan", record.treatmentPlan)}
        ${pdfBlock("Prescripción", record.prescription)}
        ${pdfBlock("Recomendaciones", record.recommendations)}
        <button onclick="window.print()">Imprimir / Guardar PDF</button>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
}

function pdfField(label, value) {
  return `<div class="box"><div class="label">${label}</div>${value || "Sin información"}</div>`;
}

function pdfBlock(label, value) {
  return `<div class="box"><div class="label">${label}</div>${value || "Sin información"}</div>`;
}

function showClinicalMessage(container, message, type) {
  const messageBox = container.querySelector("#clinical-message");
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `mt-4 rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
  messageBox.classList.remove("hidden");
  
  setTimeout(() => {
    messageBox.classList.add("hidden");
  }, 3000);
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: COLOMBIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp.toDate());
}

function getColombiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}
