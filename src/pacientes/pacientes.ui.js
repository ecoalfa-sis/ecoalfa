import {
  createClinicalRecord,
  getClinicalRecords,
  getPatientsPage,
  searchPatientsByDocument,
  upsertPatient
} from "./pacientes.service.js";

let currentPatients = [];
let selectedPatient = null;
let lastVisiblePatient = null;
let lastVisibleRecord = null;
let canLoadMorePatients = false;
let canLoadMoreRecords = false;
let currentRecords = [];

export async function renderPacientesModule(container) {
  container.innerHTML = renderShell();
  bindPatientEvents(container);
  await loadPatients(container, true);
}

function renderShell() {
  return `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Pacientes e historias clínicas</h2>
        <p class="text-slate-500">Gestión EMR protegida para Administrador y Médico.</p>
      </div>

      <div class="grid gap-6 2xl:grid-cols-[420px_1fr]">
        <div class="space-y-6">
          <form id="patient-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Datos del paciente</h3>
            <input id="patient-id" type="hidden" />
            <div class="mt-5 space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                ${renderSelect("documentType", "Tipo de documento", ["CC", "TI", "CE", "PA", "RC", "Otro"])}
                ${renderInput("documentNumber", "Número de documento", "text", true)}
                ${renderInput("firstName", "Primer nombre", "text", true)}
                ${renderInput("secondName", "Segundo nombre", "text", false)}
                ${renderInput("firstLastName", "Primer apellido", "text", true)}
                ${renderInput("secondLastName", "Segundo apellido", "text", false)}
                ${renderInput("email", "Correo", "email", false)}
                ${renderInput("phone", "Celular", "tel", false)}
                ${renderInput("birthDate", "Fecha de nacimiento", "date", false)}
                ${renderSelect("gender", "Género", ["Hombre", "Mujer", "Otro", "Prefiero no decirlo"])}
                ${renderInput("neighborhood", "Barrio", "text", false)}
                ${renderInput("municipality", "Municipio", "text", false)}
                ${renderInput("eps", "EPS", "text", false)}
                ${renderSelect("bloodType", "Grupo sanguíneo", ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"])}
                ${renderInput("occupation", "Ocupación", "text", false)}
                ${renderInput("emergencyContactName", "Contacto de emergencia", "text", false)}
                ${renderInput("emergencyContactPhone", "Teléfono emergencia", "tel", false)}
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="address">Dirección</label>
                <textarea id="address" rows="2" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="background">Antecedentes</label>
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

          <div id="clinical-records-panel" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            ${renderNoPatientSelected()}
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

function renderSelect(id, label, options) {
  return `
    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700" for="${id}">${label}</label>
      <select id="${id}" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
        ${options.map((option) => `<option value="${option}">${option || "Selecciona"}</option>`).join("")}
      </select>
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
  return `
    <tr>
      <td class="px-5 py-4 font-medium text-slate-900">${patient.fullName || "Sin nombre"}</td>
      <td class="px-5 py-4 text-slate-600">${patient.documentNumber || "Sin documento"}</td>
      <td class="px-5 py-4 text-slate-600">${patient.phone || patient.email || "Sin contacto"}</td>
      <td class="px-5 py-4 text-right">
        <button data-edit-patient="${patient.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
        <button data-records-patient="${patient.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Historia</button>
      </td>
    </tr>
  `;
}

function bindPatientsTableEvents(container) {
  container.querySelectorAll("[data-edit-patient]").forEach((button) => {
    button.addEventListener("click", () => fillPatientForm(container, button.dataset.editPatient));
  });

  container.querySelectorAll("[data-records-patient]").forEach((button) => {
    button.addEventListener("click", async () => selectPatient(container, button.dataset.recordsPatient));
  });
}

function fillPatientForm(container, patientId) {
  const patient = currentPatients.find((item) => item.id === patientId);
  const form = container.querySelector("#patient-form");

  form.querySelector("#patient-id").value = patient.id;
  form.documentType.value = patient.documentType || "CC";
  form.documentNumber.value = patient.documentNumber || "";
  form.firstName.value = patient.firstName || "";
  form.secondName.value = patient.secondName || "";
  form.firstLastName.value = patient.firstLastName || "";
  form.secondLastName.value = patient.secondLastName || "";
  form.phone.value = patient.phone || "";
  form.email.value = patient.email || "";
  form.birthDate.value = patient.birthDate || "";
  form.gender.value = patient.gender || "Prefiero no decirlo";
  form.neighborhood.value = patient.neighborhood || "";
  form.municipality.value = patient.municipality || "";
  form.eps.value = patient.eps || "";
  form.bloodType.value = patient.bloodType || "";
  form.occupation.value = patient.occupation || "";
  form.emergencyContactName.value = patient.emergencyContactName || "";
  form.emergencyContactPhone.value = patient.emergencyContactPhone || "";
  form.address.value = patient.address || "";
  form.background.value = patient.background || "";
}

async function savePatient(container, form) {
  try {
    const patientId = await upsertPatient(form.querySelector("#patient-id").value, {
      documentType: form.documentType.value,
      documentNumber: form.documentNumber.value,
      firstName: form.firstName.value,
      secondName: form.secondName.value,
      firstLastName: form.firstLastName.value,
      secondLastName: form.secondLastName.value,
      phone: form.phone.value,
      email: form.email.value,
      birthDate: form.birthDate.value,
      gender: form.gender.value,
      neighborhood: form.neighborhood.value,
      municipality: form.municipality.value,
      eps: form.eps.value,
      bloodType: form.bloodType.value,
      occupation: form.occupation.value,
      emergencyContactName: form.emergencyContactName.value,
      emergencyContactPhone: form.emergencyContactPhone.value,
      address: form.address.value,
      background: form.background.value
    });

    resetPatientForm(container);
    await loadPatients(container, true);
    showMessage(container, "Paciente guardado correctamente.", "success");

    const patient = currentPatients.find((item) => item.id === patientId);
    if (patient) {
      await selectPatient(container, patient.id);
    }
  } catch (error) {
    showMessage(container, "No fue posible guardar el paciente. Verifica permisos y datos.", "error");
  }
}

function resetPatientForm(container) {
  const form = container.querySelector("#patient-form");

  form.reset();
  form.querySelector("#patient-id").value = "";
}

async function selectPatient(container, patientId) {
  selectedPatient = currentPatients.find((item) => item.id === patientId);
  currentRecords = [];
  lastVisibleRecord = null;
  renderClinicalPanel(container);
  await loadRecords(container, true);
}

function renderClinicalPanel(container) {
  const panel = container.querySelector("#clinical-records-panel");

  if (!selectedPatient) {
    panel.innerHTML = renderNoPatientSelected();
    return;
  }

  panel.innerHTML = `
    <div class="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
      <div>
        <h3 class="text-lg font-semibold text-slate-900">Historia clínica</h3>
        <p class="text-sm text-slate-500">${selectedPatient.fullName} · ${selectedPatient.documentNumber}</p>
      </div>
      <button id="load-more-records" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más registros</button>
    </div>

    <form id="clinical-record-form" class="mb-6 rounded-2xl bg-slate-50 p-5">
      <h4 class="font-semibold text-slate-900">Nueva consulta</h4>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        ${renderTextarea("record-reason", "Motivo", true)}
        ${renderTextarea("record-currentIllness", "Enfermedad actual", true)}
        ${renderTextarea("record-personalHistory", "Antecedentes personales", false)}
        ${renderTextarea("record-familyHistory", "Antecedentes familiares", false)}
        ${renderTextarea("record-allergies", "Alergias", false)}
        ${renderTextarea("record-currentMedications", "Medicamentos actuales", false)}
        ${renderTextarea("record-physicalExam", "Examen físico", false)}
        ${renderTextarea("record-systemsReview", "Revisión por sistemas", false)}
        ${renderTextarea("record-diagnosis", "Diagnóstico", true)}
        ${renderInput("record-cie10", "CIE-10", "text", false)}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-4">
        ${renderInput("record-bloodPressure", "Tensión arterial", "text", false)}
        ${renderInput("record-heartRate", "Frecuencia cardíaca", "text", false)}
        ${renderInput("record-temperature", "Temperatura", "text", false)}
        ${renderInput("record-weight", "Peso", "text", false)}
      </div>
      <div class="mt-4">
        ${renderTextarea("record-treatmentPlan", "Plan de manejo", false)}
        ${renderTextarea("record-prescription", "Prescripción / Fórmula médica", true)}
        ${renderTextarea("record-recommendations", "Recomendaciones", false)}
        ${renderTextarea("record-followUp", "Seguimiento", false)}
      </div>
      <button class="mt-4 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar consulta</button>
    </form>

    <div id="clinical-records-list" class="space-y-4"></div>
  `;

  panel.querySelector("#clinical-record-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveClinicalRecord(container, event.currentTarget);
  });

  panel.querySelector("#load-more-records").addEventListener("click", async () => loadRecords(container, false));
}

function renderTextarea(id, label, required) {
  return `
    <div>
      <label class="mb-1 block text-sm font-medium text-slate-700" for="${id}">${label}</label>
      <textarea id="${id}" rows="3" ${required ? "required" : ""} class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></textarea>
    </div>
  `;
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

  list.innerHTML = `<div class="text-sm text-slate-500">Cargando historia clínica...</div>`;

  try {
    const page = await getClinicalRecords(selectedPatient.id, lastVisibleRecord);
    currentRecords = [...currentRecords, ...page.records];
    lastVisibleRecord = page.lastVisible;
    canLoadMoreRecords = page.hasMore;

    list.innerHTML = renderRecordsList(currentRecords);
    loadMoreButton.disabled = !canLoadMoreRecords;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMoreRecords);
  } catch (error) {
    list.innerHTML = `<div class="text-sm text-red-600">No fue posible cargar la historia clínica.</div>`;
  }
}

function renderRecordsList(records) {
  if (!records.length) {
    return `<div class="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Sin registros clínicos.</div>`;
  }

  return records.map((record) => `
    <article class="rounded-2xl border border-slate-200 p-5">
      <div class="mb-3 flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
        <h4 class="font-semibold text-slate-900">${record.diagnosis || "Consulta médica"}</h4>
        <span class="text-xs text-slate-400">${formatDate(record.createdAt)}</span>
      </div>
      <dl class="grid gap-3 text-sm lg:grid-cols-2">
        ${renderRecordField("Motivo", record.reason)}
        ${renderRecordField("Enfermedad actual", record.currentIllness)}
        ${renderRecordField("Antecedentes personales", record.personalHistory)}
        ${renderRecordField("Antecedentes familiares", record.familyHistory)}
        ${renderRecordField("Alergias", record.allergies)}
        ${renderRecordField("Medicamentos actuales", record.currentMedications)}
        ${renderRecordField("Signos vitales", renderVitalSigns(record.vitalSigns))}
        ${renderRecordField("Examen físico", record.physicalExam)}
        ${renderRecordField("Revisión por sistemas", record.systemsReview)}
        ${renderRecordField("Diagnóstico", record.diagnosis)}
        ${renderRecordField("CIE-10", record.cie10)}
        ${renderRecordField("Plan de manejo", record.treatmentPlan)}
      </dl>
      <div class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <strong class="block text-emerald-950">Prescripción / Fórmula médica</strong>
        <p class="mt-1 whitespace-pre-wrap">${record.prescription || "Sin prescripción"}</p>
      </div>
    </article>
  `).join("");
}

function renderRecordField(label, value) {
  return `
    <div>
      <dt class="font-medium text-slate-500">${label}</dt>
      <dd class="mt-1 whitespace-pre-wrap text-slate-800">${value || "Sin información"}</dd>
    </div>
  `;
}

function renderVitalSigns(vitalSigns = {}) {
  return [
    vitalSigns.bloodPressure ? `TA: ${vitalSigns.bloodPressure}` : "",
    vitalSigns.heartRate ? `FC: ${vitalSigns.heartRate}` : "",
    vitalSigns.respiratoryRate ? `FR: ${vitalSigns.respiratoryRate}` : "",
    vitalSigns.temperature ? `Temp: ${vitalSigns.temperature}` : "",
    vitalSigns.oxygenSaturation ? `SatO2: ${vitalSigns.oxygenSaturation}` : "",
    vitalSigns.weight ? `Peso: ${vitalSigns.weight}` : "",
    vitalSigns.height ? `Talla: ${vitalSigns.height}` : ""
  ].filter(Boolean).join(" · ");
}

async function saveClinicalRecord(container, form) {
  try {
    await createClinicalRecord(selectedPatient.id, {
      reason: form.querySelector("#record-reason").value,
      currentIllness: form.querySelector("#record-currentIllness").value,
      personalHistory: form.querySelector("#record-personalHistory").value,
      familyHistory: form.querySelector("#record-familyHistory").value,
      allergies: form.querySelector("#record-allergies").value,
      currentMedications: form.querySelector("#record-currentMedications").value,
      physicalExam: form.querySelector("#record-physicalExam").value,
      systemsReview: form.querySelector("#record-systemsReview").value,
      diagnosis: form.querySelector("#record-diagnosis").value,
      cie10: form.querySelector("#record-cie10").value,
      bloodPressure: form.querySelector("#record-bloodPressure").value,
      heartRate: form.querySelector("#record-heartRate").value,
      temperature: form.querySelector("#record-temperature").value,
      weight: form.querySelector("#record-weight").value,
      treatmentPlan: form.querySelector("#record-treatmentPlan").value,
      prescription: form.querySelector("#record-prescription").value,
      recommendations: form.querySelector("#record-recommendations").value,
      followUp: form.querySelector("#record-followUp").value
    });

    form.reset();
    await loadRecords(container, true);
    showMessage(container, "Consulta guardada correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible guardar la consulta clínica.", "error");
  }
}

function renderNoPatientSelected() {
  return `
    <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      Selecciona un paciente para consultar o crear registros clínicos.
    </div>
  `;
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#patients-message");
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp.toDate());
}
