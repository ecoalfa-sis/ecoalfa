import { getSession } from "../auth/session.js";
import {
  APPOINTMENT_STATUSES,
  createAppointment,
  getAppointmentsByDate,
  updateAppointment,
  getPatients,
  getDoctorsByRole
} from "./citas.service.js";

let selectedDateKey = getTodayKey();
let lastVisibleAppointment = null;
let canLoadMoreAppointments = false;
let currentAppointments = [];

export async function renderCitasModule(container) {
  container.innerHTML = renderShell();
  await loadDoctors(container);
  bindAppointmentEvents(container);
  setupPatientSearch(container);
  await loadAppointments(container, true);
}

async function loadDoctors(container) {
  try {
    const doctors = await getDoctorsByRole();
    const select = container.querySelector("#doctorId");
    if (select) {
      doctors.forEach((doctor) => {
        const option = document.createElement("option");
        option.value = doctor.id;
        option.textContent = doctor.displayName || doctor.email;
        select.appendChild(option);
      });
      
      select.addEventListener("change", () => {
        const selected = doctors.find((d) => d.id === select.value);
        if (selected) {
          container.querySelector("#doctorName").value = selected.displayName || selected.email;
        }
      });
    }
  } catch (error) {
    console.error("Error cargando doctores:", error);
  }
}

function setupPatientSearch(container) {
  const searchInput = container.querySelector("#patientSearch");
  const resultsDiv = container.querySelector("#patient-results");
  let searchTimeout = null;
  
  if (!searchInput || !resultsDiv) return;
  
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const term = searchInput.value.trim();
    
    if (term.length < 2) {
      resultsDiv.classList.add("hidden");
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const patients = await getPatients(term);
        renderPatientResults(container, patients, term);
      } catch (error) {
        console.error("Error buscando pacientes:", error);
      }
    }, 300);
  });
  
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
      resultsDiv.classList.add("hidden");
    }
  });
}

function renderPatientResults(container, patients, term) {
  const resultsDiv = container.querySelector("#patient-results");
  const selectedDisplay = container.querySelector("#selected-patient");
  
  if (patients.length === 0) {
    resultsDiv.innerHTML = `<div class="p-3 text-sm text-slate-500">No se encontraron pacientes con "${term}"</div>`;
    resultsDiv.classList.remove("hidden");
    return;
  }
  
  resultsDiv.innerHTML = patients.map((p) => `
    <div class="cursor-pointer p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0" data-patient-id="${p.id}" data-patient-name="${p.fullName || "Sin nombre"}">
      <p class="font-medium text-slate-800">${p.fullName || "Sin nombre"}</p>
      <p class="text-xs text-slate-500">${p.documentType || "CC"} ${p.documentNumber || ""} · ${p.phone || "Sin teléfono"}</p>
    </div>
  `).join("");
  
  resultsDiv.classList.remove("hidden");
  
  resultsDiv.querySelectorAll("[data-patient-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const patientId = el.dataset.patientId;
      const patientName = el.dataset.patientName;
      
      container.querySelector("#patientId").value = patientId;
      container.querySelector("#patientName").value = patientName;
      container.querySelector("#patientSearch").value = patientName;
      selectedDisplay.textContent = `Paciente: ${patientName}`;
      resultsDiv.classList.add("hidden");
    });
  });
}

function renderShell() {
  return `
    <section class="space-y-6">
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Gestión de citas</h2>
          <p class="text-slate-500">Agenda diaria optimizada por fecha, hora y estado de atención.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <input id="appointments-date" type="date" value="${selectedDateKey}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <button id="refresh-appointments" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Actualizar</button>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form id="appointment-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">Nueva cita</h3>
          <p class="mt-1 text-sm text-slate-500">Complete los datos para programar la cita médica.</p>

          <input id="appointment-id" type="hidden" />

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="patientSearch">Buscar paciente</label>
              <div class="relative">
                <input id="patientSearch" type="text" placeholder="Escriba para buscar..." class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <div id="patient-results" class="absolute z-10 mt-1 hidden w-full rounded-xl border border-slate-200 bg-white shadow-lg"></div>
              </div>
              <input id="patientId" type="hidden" />
              <input id="patientName" type="hidden" />
              <p id="selected-patient" class="mt-1 text-sm font-medium text-blue-700"></p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="doctorId">Médico asignado</label>
              <select id="doctorId" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="">Seleccione un médico</option>
              </select>
              <input id="doctorName" type="hidden" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="dateKey">Fecha</label>
                <input id="dateKey" type="date" value="${selectedDateKey}" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="time">Hora</label>
                <input id="time" type="time" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="reason">Motivo de consulta</label>
              <textarea id="reason" rows="3" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="status">Estado</label>
              <select id="status" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                ${APPOINTMENT_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}
              </select>
            </div>
            <p id="appointments-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
            <div class="grid gap-3 sm:grid-cols-2">
              <button class="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800" type="submit">Guardar cita</button>
              <button id="clear-appointment-form" class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Limpiar</button>
            </div>
          </div>
        </form>

        <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div class="border-b border-slate-200 p-5">
            <h3 class="text-lg font-semibold text-slate-900">Agenda del día</h3>
            <p class="text-sm text-slate-500">Citas programadas para la fecha seleccionada.</p>
          </div>
          <div id="appointments-table" class="overflow-x-auto"></div>
          <div class="border-t border-slate-200 p-4 text-right">
            <button id="load-more-appointments" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindAppointmentEvents(container) {
  container.querySelector("#appointment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveAppointment(container, event.currentTarget);
  });

  container.querySelector("#appointments-date").addEventListener("change", async (event) => {
    selectedDateKey = event.target.value;
    container.querySelector("#dateKey").value = selectedDateKey;
    await loadAppointments(container, true);
  });

  container.querySelector("#refresh-appointments").addEventListener("click", async () => {
    await loadAppointments(container, true);
  });

  container.querySelector("#load-more-appointments").addEventListener("click", async () => {
    await loadAppointments(container, false);
  });

  container.querySelector("#clear-appointment-form").addEventListener("click", () => {
    resetAppointmentForm(container);
  });
}

async function loadAppointments(container, reset) {
  const table = container.querySelector("#appointments-table");
  const loadMoreButton = container.querySelector("#load-more-appointments");

  table.innerHTML = `<div class="p-6 text-sm text-slate-500"><div class="flex items-center gap-2"><div class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>Cargando citas...</div></div>`;

  if (reset) {
    lastVisibleAppointment = null;
    currentAppointments = [];
  }

  try {
    const page = await getAppointmentsByDate(selectedDateKey, lastVisibleAppointment);
    currentAppointments = [...currentAppointments, ...page.appointments];
    lastVisibleAppointment = page.lastVisible;
    canLoadMoreAppointments = page.hasMore;

    table.innerHTML = renderAppointmentsTable(currentAppointments);
    loadMoreButton.disabled = !canLoadMoreAppointments;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMoreAppointments);
    bindTableEvents(container);
  } catch (error) {
    console.error("No fue posible cargar las citas", error);
    table.innerHTML = `
      <div class="p-6 text-sm text-red-700">
        <p class="font-semibold">No fue posible cargar las citas.</p>
        <p class="mt-1">Por favor intente nuevamente o contacte al administrador.</p>
      </div>
    `;
  }
}

function renderAppointmentsTable(appointments) {
  if (!appointments.length) {
    return `<div class="p-6 text-sm text-slate-500">No hay citas para esta fecha.</div>`;
  }

  return `
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Hora</th>
          <th class="px-5 py-3">Paciente</th>
          <th class="px-5 py-3">Médico</th>
          <th class="px-5 py-3">Motivo</th>
          <th class="px-5 py-3">Estado</th>
          <th class="px-5 py-3">Llegada</th>
          <th class="px-5 py-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${appointments.map(renderAppointmentRow).join("")}
      </tbody>
    </table>
  `;
}

function renderAppointmentRow(appointment) {
  const arrivalInfo = appointment.arrivalTime 
    ? `<span class="text-xs font-medium ${appointment.room ? 'text-blue-600' : 'text-slate-500'}">${appointment.arrivalTime}${appointment.room ? ` · ${appointment.room}` : ''}</span>`
    : `<span class="text-xs text-slate-400">-</span>`;
  
  const modifiedInfo = appointment.lastModifiedBy 
    ? `<span class="text-xs text-slate-400 block mt-1" title="Modificado por">👤 ${appointment.lastModifiedBy.name || 'Sistema'}</span>`
    : '';
  
  return `
    <tr>
      <td class="px-5 py-4 font-semibold text-slate-900">${appointment.time || "--:--"}</td>
      <td class="px-5 py-4 text-slate-700">${appointment.patientName || "Sin paciente"}</td>
      <td class="px-5 py-4 text-slate-600">${appointment.doctorName || "Sin médico"}</td>
      <td class="max-w-xs truncate px-5 py-4 text-slate-600">${appointment.reason || "Sin motivo"}</td>
      <td class="px-5 py-4">${renderStatusSelect(appointment)}${modifiedInfo}</td>
      <td class="px-5 py-4">${arrivalInfo}</td>
      <td class="px-5 py-4 text-right">
        <button data-edit-appointment="${appointment.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
      </td>
    </tr>
  `;
}

function renderStatusSelect(appointment) {
  return `
    <select data-status-appointment="${appointment.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
      ${APPOINTMENT_STATUSES.map((status) => `<option value="${status}" ${appointment.status === status ? "selected" : ""}>${status}</option>`).join("")}
    </select>
  `;
}

function bindTableEvents(container) {
  const session = getSession();
  const currentUser = session.user ? { ...session.user, displayName: session.profile?.displayName } : null;
  
  container.querySelectorAll("[data-edit-appointment]").forEach((button) => {
    button.addEventListener("click", () => fillAppointmentForm(container, button.dataset.editAppointment));
  });

  container.querySelectorAll("[data-status-appointment]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        const { updateAppointmentStatus } = await import("./citas.service.js");
        await updateAppointmentStatus(select.dataset.statusAppointment, select.value, currentUser);
        await loadAppointments(container, true);
        showMessage(container, "Estado actualizado. Registrado por: " + (currentUser?.displayName || "Sistema"), "success");
      } catch (error) {
        showMessage(container, "No fue posible actualizar el estado.", "error");
      }
    });
  });
}

function fillAppointmentForm(container, appointmentId) {
  const appointment = currentAppointments.find((item) => item.id === appointmentId);
  const form = container.querySelector("#appointment-form");

  form.querySelector("#appointment-id").value = appointment.id;
  form.patientName.value = appointment.patientName || "";
  form.doctorName.value = appointment.doctorName || "";
  form.dateKey.value = appointment.dateKey || selectedDateKey;
  form.time.value = appointment.time || "";
  form.reason.value = appointment.reason || "";
  form.status.value = appointment.status || "Programada";
}

async function saveAppointment(container, form) {
  const appointmentId = form.querySelector("#appointment-id").value;
  const payload = {
    patientName: form.patientName.value.trim(),
    doctorName: form.doctorName.value.trim(),
    dateKey: form.dateKey.value,
    time: form.time.value,
    reason: form.reason.value.trim(),
    status: form.status.value
  };

  try {
    if (appointmentId) {
      await updateAppointment(appointmentId, payload);
    } else {
      await createAppointment(payload);
    }

    selectedDateKey = payload.dateKey;
    container.querySelector("#appointments-date").value = selectedDateKey;
    resetAppointmentForm(container);
    await loadAppointments(container, true);
    showMessage(container, "Cita guardada correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible guardar la cita. Verifica permisos y datos.", "error");
  }
}

function resetAppointmentForm(container) {
  const form = container.querySelector("#appointment-form");

  form.reset();
  form.querySelector("#appointment-id").value = "";
  form.dateKey.value = selectedDateKey;
  form.status.value = "Programada";
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#appointments-message");
  const classes = type === "success" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700";
  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
  messageBox.classList.remove("hidden");
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}
