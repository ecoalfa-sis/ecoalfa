import {
  getPatientByDocument,
  getPatientsPage,
  linkPatientToAuth,
  mergePatientRecords,
  searchPatientsByDocument,
  upsertPatient
} from "./pacientes.service.js";

let currentPatients = [];
let lastVisiblePatient = null;
let canLoadMorePatients = false;

export async function renderPacientesModule(container) {
  container.innerHTML = renderShell();
  bindPatientEvents(container);
  await loadPatients(container, true);
}

function renderShell() {
  return `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Pacientes</h2>
        <p class="text-slate-500">Base administrativa conectada con los pacientes que se registran desde el portal de citas.</p>
      </div>

      <div class="grid gap-6 2xl:grid-cols-[420px_1fr]">
        <div class="space-y-6">
          <form id="patient-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Ficha del paciente</h3>
            <p class="mt-1 text-sm text-slate-500">Datos de identificación, contacto y vínculo con el portal.</p>
            <input id="patient-id" type="hidden" />
            <div class="mt-5 space-y-4">
              ${renderInput("fullName", "Nombre completo", "text", true)}
              ${renderInput("documentNumber", "Documento", "text", true)}
              ${renderInput("phone", "Teléfono", "tel", false)}
              ${renderInput("email", "Correo", "email", false)}
              ${renderInput("birthDate", "Fecha de nacimiento", "date", false)}
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="address">Dirección</label>
                <textarea id="address" rows="2" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="background">Notas administrativas</label>
                <textarea id="background" rows="3" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
              </div>
              <p id="patients-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
              <div class="grid gap-3 sm:grid-cols-2">
                <button class="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar paciente</button>
                <button id="clear-patient-form" class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Limpiar</button>
              </div>
            </div>
          </form>
        </div>

        <div class="space-y-6">
          <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div class="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">Base de pacientes</h3>
                <p class="text-sm text-slate-500">Listado paginado de máximo 15 pacientes por carga.</p>
              </div>
              <div class="flex gap-2">
                <input id="patient-search" placeholder="Buscar documento" class="w-44 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                <button id="search-patient" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Buscar</button>
                <button id="refresh-patients" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Todos</button>
              </div>
            </div>
            <div id="patients-table" class="overflow-x-auto"></div>
            <div class="border-t border-slate-200 p-4 text-right">
              <button id="load-more-patients" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <article class="rounded-2xl bg-emerald-50 p-5 text-emerald-950 ring-1 ring-emerald-100">
              <p class="text-sm font-medium text-emerald-700">Origen</p>
              <strong class="mt-2 block text-2xl">Portal conectado</strong>
              <p class="mt-2 text-sm">Los pacientes inscritos desde citas quedan disponibles en esta base.</p>
            </article>
            <article class="rounded-2xl bg-sky-50 p-5 text-sky-950 ring-1 ring-sky-100">
              <p class="text-sm font-medium text-sky-700">Gestión</p>
              <strong class="mt-2 block text-2xl">Datos civiles</strong>
              <p class="mt-2 text-sm">Identificación, contacto, correo, fecha de nacimiento y dirección.</p>
            </article>
            <article class="rounded-2xl bg-lime-50 p-5 text-lime-950 ring-1 ring-lime-100">
              <p class="text-sm font-medium text-lime-700">Atención</p>
              <strong class="mt-2 block text-2xl">Historia aparte</strong>
              <p class="mt-2 text-sm">La atención médica se registra en el módulo Historias clínicas.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderInput(id, label, type, required) {
  return `
    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700" for="${id}">${label}</label>
      <input id="${id}" type="${type}" ${required ? "required" : ""} class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
    </div>
  `;
}

function bindPatientEvents(container) {
  container.querySelector("#patient-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await savePatient(container, event.currentTarget);
  });

  container.querySelector("#clear-patient-form").addEventListener("click", () => resetPatientForm(container));
  container.querySelector("#refresh-patients").addEventListener("click", async () => loadPatients(container, true));
  container.querySelector("#load-more-patients").addEventListener("click", async () => loadPatients(container, false));
  container.querySelector("#search-patient").addEventListener("click", async () => searchPatients(container));
}

async function loadPatients(container, reset) {
  const table = container.querySelector("#patients-table");
  const loadMoreButton = container.querySelector("#load-more-patients");

  table.innerHTML = `<div class="p-6 text-sm text-slate-500">Cargando pacientes...</div>`;

  if (reset) {
    currentPatients = [];
    lastVisiblePatient = null;
  }

  try {
    const page = await getPatientsPage(lastVisiblePatient);
    currentPatients = [...currentPatients, ...page.patients];
    lastVisiblePatient = page.lastVisible;
    canLoadMorePatients = page.hasMore;

    table.innerHTML = renderPatientsTable(currentPatients);
    loadMoreButton.disabled = !canLoadMorePatients;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMorePatients);
    bindPatientsTableEvents(container);
  } catch (error) {
    table.innerHTML = `<div class="p-6 text-sm text-red-600">No fue posible cargar pacientes. Verifica permisos o índices.</div>`;
  }
}

async function searchPatients(container) {
  const term = container.querySelector("#patient-search").value;
  const table = container.querySelector("#patients-table");
  const loadMoreButton = container.querySelector("#load-more-patients");

  if (!term.trim()) {
    await loadPatients(container, true);
    return;
  }

  table.innerHTML = `<div class="p-6 text-sm text-slate-500">Buscando paciente...</div>`;
  currentPatients = await searchPatientsByDocument(term);
  table.innerHTML = renderPatientsTable(currentPatients);
  loadMoreButton.disabled = true;
  loadMoreButton.classList.add("opacity-50");
  bindPatientsTableEvents(container);
}

function renderPatientsTable(patients) {
  if (!patients.length) {
    return `<div class="p-6 text-sm text-slate-500">No hay pacientes para mostrar.</div>`;
  }

  return `
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Paciente</th>
          <th class="px-5 py-3">Documento</th>
          <th class="px-5 py-3">Contacto</th>
          <th class="px-5 py-3">Origen</th>
          <th class="px-5 py-3">Portal</th>
          <th class="px-5 py-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${patients.map(renderPatientRow).join("")}
      </tbody>
    </table>
  `;
}

function renderPatientRow(patient) {
  const sourceBadge = getSourceBadge(patient.source);
  const portalStatus = patient.authUid 
    ? `<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Vinculado</span>`
    : `<span class="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Sin vincular</span>`;
  
  return `
    <tr>
      <td class="px-5 py-4 font-medium text-slate-900">${patient.fullName || "Sin nombre"}</td>
      <td class="px-5 py-4 text-slate-600">${patient.documentNumber || "Sin documento"}</td>
      <td class="px-5 py-4 text-slate-600">${patient.phone || patient.email || "Sin contacto"}</td>
      <td class="px-5 py-4">${sourceBadge}</td>
      <td class="px-5 py-4">${portalStatus}</td>
      <td class="px-5 py-4 text-right">
        <button data-edit-patient="${patient.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
        ${!patient.authUid ? `<button data-link-patient="${patient.id}" class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">Vincular portal</button>` : ""}
        <a href="#historias" data-open-history="${patient.id}" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Abrir historia</a>
      </td>
    </tr>
  `;
}

function getSourceBadge(source) {
  const badges = {
    manual: `<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Interno</span>`,
    patient_portal: `<span class="inline-flex items-center rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">Portal</span>`,
    linked: `<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Vinculado</span>`
  };
  return badges[source] || badges.manual;
}

function bindPatientsTableEvents(container) {
  container.querySelectorAll("[data-edit-patient]").forEach((button) => {
    button.addEventListener("click", () => fillPatientForm(container, button.dataset.editPatient));
  });

  container.querySelectorAll("[data-open-history]").forEach((link) => {
    link.addEventListener("click", () => {
      sessionStorage.setItem("ecoalfa:selectedPatientId", link.dataset.openHistory);
    });
  });

  container.querySelectorAll("[data-link-patient]").forEach((button) => {
    button.addEventListener("click", () => linkPatientToPortal(container, button.dataset.linkPatient));
  });
}

async function linkPatientToPortal(container, patientId) {
  const patient = currentPatients.find((p) => p.id === patientId);
  if (!patient) return;

  const email = prompt(`Vincular paciente: ${patient.fullName}\n\nIngresa el correo del usuario registrado en el portal:`);
  if (!email || !email.includes("@")) {
    showMessage(container, "Correo inválido. Debe ser un correo válido.", "error");
    return;
  }

  try {
    showMessage(container, "Buscando paciente en portal...", "success");
    
    const portalPatient = await getPatientByDocument(patient.documentNumber);
    
    if (!portalPatient) {
      showMessage(container, "No se encontró paciente con ese documento en el portal. El usuario debe registrarse primero en citas.html", "error");
      return;
    }

    if (portalPatient.id === patientId) {
      showMessage(container, "Este paciente ya es el registro principal.", "error");
      return;
    }

    if (!portalPatient.authUid) {
      showMessage(container, "El paciente del portal no tiene cuenta de autenticación vinculada.", "error");
      return;
    }

    const confirmMerge = confirm(
      `Se encontró paciente en portal:\n${portalPatient.fullName}\nCorreo: ${portalPatient.email}\n\n` +
      `¿Deseas vincular y migrar el historial clínico?\n\n` +
      `- El paciente interno quedará como principal\n` +
      `- Se migrarán ${portalPatient.recordCount || "las"} historias clínicas del portal\n` +
      `- El registro del portal se marcará como vinculado`
    );

    if (!confirmMerge) return;

    showMessage(container, "Vinculando y migrando historial...", "success");

    await linkPatientToAuth(patientId, portalPatient.authUid, portalPatient.email);
    
    const migratedCount = await mergePatientRecords(portalPatient.id, patientId);
    
    showMessage(container, `Paciente vinculado exitosamente. ${migratedCount} registros migrados.`, "success");
    
    await loadPatients(container, true);
  } catch (error) {
    console.error("Error vinculando paciente:", error);
    showMessage(container, `Error: ${error.message || "No fue posible vincular"}`, "error");
  }
}

function fillPatientForm(container, patientId) {
  const patient = currentPatients.find((item) => item.id === patientId);
  const form = container.querySelector("#patient-form");

  form.querySelector("#patient-id").value = patient.id;
  form.fullName.value = patient.fullName || "";
  form.documentNumber.value = patient.documentNumber || "";
  form.phone.value = patient.phone || "";
  form.email.value = patient.email || "";
  form.birthDate.value = patient.birthDate || "";
  form.address.value = patient.address || "";
  form.background.value = patient.background || "";
}

async function savePatient(container, form) {
  try {
    const patientId = await upsertPatient(form.querySelector("#patient-id").value, {
      fullName: form.fullName.value,
      documentNumber: form.documentNumber.value,
      phone: form.phone.value,
      email: form.email.value,
      birthDate: form.birthDate.value,
      address: form.address.value,
      background: form.background.value
    });

    resetPatientForm(container);
    await loadPatients(container, true);
    showMessage(container, "Paciente guardado correctamente.", "success");

  } catch (error) {
    showMessage(container, "No fue posible guardar el paciente. Verifica permisos y datos.", "error");
  }
}

function resetPatientForm(container) {
  const form = container.querySelector("#patient-form");

  form.reset();
  form.querySelector("#patient-id").value = "";
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#patients-message");
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
}
