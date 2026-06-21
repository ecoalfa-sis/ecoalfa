import { getSession } from "../auth/session.js";
import { ROLES } from "../auth/roles.js";
import {
  MOVEMENT_TYPES,
  getInventoryPage,
  getMedicineMovements,
  registerInventoryMovement,
  upsertMedicine
} from "./inventario.service.js";

const COLOMBIA_TIME_ZONE = "America/Bogota";

let currentMedicines = [];
let selectedMedicine = null;
let currentMovements = [];
let lastVisibleMedicine = null;
let lastVisibleMovement = null;
let canLoadMoreMedicines = false;
let canLoadMoreMovements = false;

export async function renderInventarioModule(container) {
  container.innerHTML = renderShell();
  bindInventoryEvents(container);
  await loadInventory(container, true);
}

function canWriteInventory() {
  const role = getSession().profile?.role;
  return role === ROLES.ADMIN || role === ROLES.OPERADOR;
}

function renderShell() {
  const writeAllowed = canWriteInventory();

  return `
    <section class="space-y-8">
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-3xl font-bold text-slate-900">Inventario médico</h2>
          <p class="mt-1 text-base text-slate-500">Medicamentos, potencias, presentaciones, stock y auditoría de movimientos.</p>
        </div>
        <button id="refresh-inventory" class="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Actualizar</button>
      </div>

      <div class="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form id="medicine-form" class="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 ${writeAllowed ? "" : "hidden"}">
          <h3 class="text-xl font-bold text-slate-900">Medicamento</h3>
          <input id="medicine-id" type="hidden" />
          <div class="mt-5 space-y-4">
            ${renderInput("name", "Nombre", "text", true)}
            ${renderInput("potency", "Dilución / Potencia", "text", true)}
            ${renderInput("presentation", "Presentación", "text", true)}
            <div class="grid gap-4 sm:grid-cols-3">
              ${renderInput("stock", "Stock", "number", true)}
              ${renderInput("minStock", "Mínimo", "number", true)}
              ${renderInput("salePrice", "Precio", "number", true)}
            </div>
            <p id="inventory-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
            <div class="grid gap-3 sm:grid-cols-2">
              <button class="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar</button>
              <button id="clear-medicine-form" class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Limpiar</button>
            </div>
          </div>
        </form>

        <div class="space-y-6">
          <div class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div class="border-b border-slate-200 p-6">
              <h3 class="text-xl font-bold text-slate-900">Medicamentos</h3>
              <p class="mt-1 text-sm text-slate-500">Listado paginado de máximo 15 medicamentos por carga.</p>
            </div>
            <div id="inventory-table" class="overflow-x-auto"></div>
            <div class="border-t border-slate-200 p-5 text-right">
              <button id="load-more-inventory" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
            </div>
          </div>

          <div id="movements-panel" class="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            ${renderNoMedicineSelected()}
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
      <input id="${id}" type="${type}" ${required ? "required" : ""} min="0" step="${type === "number" ? "0.01" : "any"}" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
    </div>
  `;
}

function bindInventoryEvents(container) {
  container.querySelector("#refresh-inventory").addEventListener("click", async () => loadInventory(container, true));
  container.querySelector("#load-more-inventory").addEventListener("click", async () => loadInventory(container, false));

  const form = container.querySelector("#medicine-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveMedicine(container, event.currentTarget);
    });
    container.querySelector("#clear-medicine-form")?.addEventListener("click", () => resetMedicineForm(container));
  }
}

async function loadInventory(container, reset) {
  const table = container.querySelector("#inventory-table");
  const loadMoreButton = container.querySelector("#load-more-inventory");

  table.innerHTML = `<div class="p-6 text-sm text-slate-500">Cargando inventario...</div>`;

  if (reset) {
    currentMedicines = [];
    lastVisibleMedicine = null;
  }

  try {
    const page = await getInventoryPage(lastVisibleMedicine);
    currentMedicines = [...currentMedicines, ...page.medicines];
    lastVisibleMedicine = page.lastVisible;
    canLoadMoreMedicines = page.hasMore;

    table.innerHTML = renderInventoryTable(currentMedicines);
    loadMoreButton.disabled = !canLoadMoreMedicines;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMoreMedicines);
    bindInventoryTableEvents(container);
  } catch (error) {
    table.innerHTML = `<div class="p-6 text-sm text-red-600">No fue posible cargar inventario.</div>`;
  }
}

function renderInventoryTable(medicines) {
  if (!medicines.length) {
    return `<div class="p-6 text-sm text-slate-500">No hay medicamentos registrados.</div>`;
  }

  return `
    <table class="min-w-[900px] w-full divide-y divide-slate-200 text-base">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-6 py-4">Medicamento</th>
          <th class="px-6 py-4">Presentación</th>
          <th class="px-6 py-4">Stock</th>
          <th class="px-6 py-4">Precio</th>
          <th class="px-6 py-4 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${medicines.map(renderMedicineRow).join("")}
      </tbody>
    </table>
  `;
}

function renderMedicineRow(medicine) {
  const lowStock = Number(medicine.stock || 0) <= Number(medicine.minStock || 0);

  return `
    <tr>
      <td class="px-6 py-5">
        <div class="font-semibold text-slate-900">${medicine.name || "Sin nombre"}</div>
        <div class="mt-1 text-sm text-slate-500">${medicine.potency || "Sin potencia"}</div>
      </td>
      <td class="px-6 py-5 text-slate-600">${medicine.presentation || "Sin presentación"}</td>
      <td class="px-6 py-5">
        <span class="rounded-full px-4 py-1.5 text-sm font-semibold ${lowStock ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}">${medicine.stock || 0} / mín. ${medicine.minStock || 0}</span>
      </td>
      <td class="px-6 py-5 font-semibold text-slate-700">$${Number(medicine.salePrice || 0).toLocaleString("es-CO")}</td>
      <td class="px-6 py-5 text-right">
        <div class="inline-flex flex-wrap justify-end gap-2">
          ${canWriteInventory() ? `<button data-edit-medicine="${medicine.id}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Editar</button>` : ""}
          <button data-movements-medicine="${medicine.id}" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Movimientos</button>
        </div>
      </td>
    </tr>
  `;
}

function bindInventoryTableEvents(container) {
  container.querySelectorAll("[data-edit-medicine]").forEach((button) => {
    button.addEventListener("click", () => fillMedicineForm(container, button.dataset.editMedicine));
  });

  container.querySelectorAll("[data-movements-medicine]").forEach((button) => {
    button.addEventListener("click", async () => selectMedicine(container, button.dataset.movementsMedicine));
  });
}

function fillMedicineForm(container, medicineId) {
  const medicine = currentMedicines.find((item) => item.id === medicineId);
  const form = container.querySelector("#medicine-form");

  form.querySelector("#medicine-id").value = medicine.id;
  form.name.value = medicine.name || "";
  form.potency.value = medicine.potency || "";
  form.presentation.value = medicine.presentation || "";
  form.stock.value = medicine.stock || 0;
  form.minStock.value = medicine.minStock || 0;
  form.salePrice.value = medicine.salePrice || 0;
}

async function saveMedicine(container, form) {
  try {
    await upsertMedicine(form.querySelector("#medicine-id").value, {
      name: form.name.value,
      potency: form.potency.value,
      presentation: form.presentation.value,
      stock: form.stock.value,
      minStock: form.minStock.value,
      salePrice: form.salePrice.value
    });

    resetMedicineForm(container);
    await loadInventory(container, true);
    showMessage(container, "Medicamento guardado correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible guardar el medicamento.", "error");
  }
}

function resetMedicineForm(container) {
  const form = container.querySelector("#medicine-form");
  form.reset();
  form.querySelector("#medicine-id").value = "";
}

async function selectMedicine(container, medicineId) {
  selectedMedicine = currentMedicines.find((item) => item.id === medicineId);
  currentMovements = [];
  lastVisibleMovement = null;
  renderMovementsPanel(container);
  await loadMovements(container, true);
}

function renderMovementsPanel(container) {
  const panel = container.querySelector("#movements-panel");
  const writeAllowed = canWriteInventory();

  if (!selectedMedicine) {
    panel.innerHTML = renderNoMedicineSelected();
    return;
  }

  panel.innerHTML = `
    <div class="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
      <div>
        <h3 class="text-lg font-semibold text-slate-900">Movimientos de inventario</h3>
        <p class="text-sm text-slate-500">${selectedMedicine.name} · ${selectedMedicine.potency}</p>
      </div>
      <button id="load-more-movements" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
    </div>

    <form id="movement-form" class="mb-6 rounded-2xl bg-slate-50 p-5 ${writeAllowed ? "" : "hidden"}">
      <h4 class="font-semibold text-slate-900">Registrar movimiento</h4>
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="movement-type">Tipo</label>
          <select id="movement-type" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
            <option value="${MOVEMENT_TYPES.IN}">Entrada</option>
            <option value="${MOVEMENT_TYPES.OUT}">Salida</option>
            <option value="${MOVEMENT_TYPES.ADJUSTMENT}">Ajuste positivo</option>
          </select>
        </div>
        ${renderInput("movement-quantity", "Cantidad", "number", true)}
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700" for="movement-note">Nota</label>
          <input id="movement-note" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
        </div>
      </div>
      <button class="mt-4 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar movimiento</button>
    </form>

    <div id="movements-list" class="space-y-3"></div>
  `;

  panel.querySelector("#movement-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveMovement(container, event.currentTarget);
  });
  panel.querySelector("#load-more-movements").addEventListener("click", async () => loadMovements(container, false));
}

async function loadMovements(container, reset) {
  const list = container.querySelector("#movements-list");
  const loadMoreButton = container.querySelector("#load-more-movements");

  if (!selectedMedicine || !list) {
    return;
  }

  if (reset) {
    currentMovements = [];
    lastVisibleMovement = null;
  }

  list.innerHTML = `<div class="text-sm text-slate-500">Cargando movimientos...</div>`;

  try {
    const page = await getMedicineMovements(selectedMedicine.id, lastVisibleMovement);
    currentMovements = [...currentMovements, ...page.movements];
    lastVisibleMovement = page.lastVisible;
    canLoadMoreMovements = page.hasMore;

    list.innerHTML = renderMovementsList(currentMovements);
    loadMoreButton.disabled = !canLoadMoreMovements;
    loadMoreButton.classList.toggle("opacity-50", !canLoadMoreMovements);
  } catch (error) {
    list.innerHTML = `<div class="text-sm text-red-600">No fue posible cargar movimientos.</div>`;
  }
}

function renderMovementsList(movements) {
  if (!movements.length) {
    return `<div class="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Sin movimientos registrados.</div>`;
  }

  return movements.map((movement) => `
    <article class="rounded-xl border border-slate-200 p-4 text-sm">
      <div class="flex justify-between gap-3">
        <strong class="text-slate-900">${movement.type}</strong>
        <span class="font-semibold ${Number(movement.signedQuantity || 0) < 0 ? "text-red-600" : "text-emerald-700"}">${movement.signedQuantity || movement.quantity}</span>
      </div>
      <p class="mt-1 text-slate-500">${movement.note || "Sin nota"}</p>
      <span class="mt-2 block text-xs text-slate-400">${formatDate(movement.createdAt)}</span>
    </article>
  `).join("");
}

async function saveMovement(container, form) {
  try {
    await registerInventoryMovement(selectedMedicine.id, {
      type: form.querySelector("#movement-type").value,
      quantity: form.querySelector("#movement-quantity").value,
      note: form.querySelector("#movement-note").value
    });

    form.reset();
    await loadInventory(container, true);
    await selectMedicine(container, selectedMedicine.id);
  } catch (error) {
    showMessage(container, "No fue posible registrar el movimiento.", "error");
  }
}

function renderNoMedicineSelected() {
  return `
    <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
      Selecciona un medicamento para consultar movimientos de inventario.
    </div>
  `;
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#inventory-message");

  if (!messageBox) {
    return;
  }

  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
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
