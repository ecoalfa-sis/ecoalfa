import {
  APPOINTMENT_STATUSES,
  createAppointment,
  getAppointmentsByDate,
  updateAppointment
} from "./citas.service.js";
import { createDoctor, getDoctors } from "./medicos.service.js";

let selectedDateKey = getTodayKey();
let lastVisibleAppointment = null;
let canLoadMoreAppointments = false;
let currentAppointments = [];
let currentDoctors = [];

export async function renderCitasModule(container) {
  container.innerHTML = renderShell();
  bindAppointmentEvents(container);
  await loadDoctors(container);
  await loadAppointments(container, true);
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
          <input id="appointments-date" type="date" value="${selectedDateKey}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          <button id="refresh-appointments" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Actualizar</button>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form id="appointment-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">Nueva cita</h3>
          <p class="mt-1 text-sm text-slate-500">Los datos se guardan en appointments con dateKey para consultas eficientes.</p>

          <input id="appointment-id" type="hidden" />

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="patientName">Paciente</label>
              <input id="patientName" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="doctorName">Médico asignado</label>
              <div class="flex gap-2">
                <select id="doctorName" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></select>
                <button id="toggle-doctor-panel" title="Agregar médico" class="rounded-xl border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50" type="button">⚙</button>
              </div>
            </div>
            <div id="doctor-panel" class="hidden rounded-2xl bg-slate-50 p-4">
              <h4 class="font-semibold text-slate-900">Nuevo médico</h4>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <input id="doctor-fullName" placeholder="Nombre completo" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-documentNumber" placeholder="Documento" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-professionalCard" placeholder="Registro médico / tarjeta profesional" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-specialty" placeholder="Especialidad" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-phone" placeholder="Celular" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-email" type="email" placeholder="Correo" class="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
                <input id="doctor-address" placeholder="Dirección" class="rounded-xl border border-slate-300 px-4 py-3 text-sm sm:col-span-2" />
              </div>
              <button id="save-doctor" class="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button">Guardar médico</button>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="dateKey">Fecha</label>
                <input id="dateKey" type="date" value="${selectedDateKey}" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="time">Hora</label>
                <input id="time" type="time" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="reason">Motivo de consulta</label>
              <textarea id="reason" rows="3" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="status">Estado</label>
              <select id="status" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                ${APPOINTMENT_STATUSES.map((status) => `<option value="${status}">${status}</option>`).join("")}
              </select>
            </div>
            <p id="appointments-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
            <div class="grid gap-3 sm:grid-cols-2">
              <button class="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar cita</button>
              <button id="clear-appointment-form" class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Limpiar</button>
            </div>
          </div>
        </form>

        <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div class="border-b border-slate-200 p-5">
            <h3 class="text-lg font-semibold text-slate-900">Agenda del día</h3>
            <p class="text-sm text-slate-500">Lectura paginada de máximo 20 citas por carga.</p>
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

  container.querySelector("#toggle-doctor-panel").addEventListener("click", () => {
    container.querySelector("#doctor-panel").classList.toggle("hidden");
  });

  container.querySelector("#save-doctor").addEventListener("click", async () => {
    await saveDoctor(container);
  });
}

async function loadDoctors(container) {
  const select = container.querySelector("#doctorName");
  select.innerHTML = `<option value="">Cargando médicos...</option>`;

  try {
    currentDoctors = await getDoctors();
    select.innerHTML = `<option value="">Selecciona médico</option>${currentDoctors.map((doctor) => `<option value="${doctor.fullName}">${doctor.fullName} · ${doctor.specialty || "Medicina"}</option>`).join("")}`;
  } catch (error) {
    select.innerHTML = `<option value="">No fue posible cargar médicos</option>`;
  }
}

async function saveDoctor(container) {
  try {
    await createDoctor({
      fullName: container.querySelector("#doctor-fullName").value,
      documentType: "CC",
      documentNumber: container.querySelector("#doctor-documentNumber").value,
      professionalCard: container.querySelector("#doctor-professionalCard").value,
      specialty: container.querySelector("#doctor-specialty").value,
      phone: container.querySelector("#doctor-phone").value,
      email: container.querySelector("#doctor-email").value,
      address: container.querySelector("#doctor-address").value
    });

    container.querySelector("#doctor-panel").classList.add("hidden");
    await loadDoctors(container);
    showMessage(container, "Médico creado correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible crear el médico. Verifica datos y permisos.", "error");
  }
}

async function loadAppointments(container, reset) {
  const table = container.querySelector("#appointments-table");
  const loadMoreButton = container.querySelector("#load-more-appointments");

  table.innerHTML = `<div class="p-6 text-sm text-slate-500">Cargando citas...</div>`;

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
    table.innerHTML = `<div class="p-6 text-sm text-red-600">No fue posible cargar las citas. Verifica reglas o índices de Firestore.</div>`;
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
  return `
    <tr>
      <td class="px-5 py-4 font-semibold text-slate-900">${appointment.time || "--:--"}</td>
      <td class="px-5 py-4 text-slate-700">${appointment.patientName || "Sin paciente"}</td>
      <td class="px-5 py-4 text-slate-600">${appointment.doctorName || "Sin médico"}</td>
      <td class="max-w-xs truncate px-5 py-4 text-slate-600">${appointment.reason || "Sin motivo"}</td>
      <td class="px-5 py-4">${renderStatusSelect(appointment)}</td>
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
  container.querySelectorAll("[data-edit-appointment]").forEach((button) => {
    button.addEventListener("click", () => fillAppointmentForm(container, button.dataset.editAppointment));
  });

  container.querySelectorAll("[data-status-appointment]").forEach((select) => {
    select.addEventListener("change", async () => {
      await updateAppointment(select.dataset.statusAppointment, { status: select.value });
      await loadAppointments(container, true);
      showMessage(container, "Estado actualizado correctamente.", "success");
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
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}
