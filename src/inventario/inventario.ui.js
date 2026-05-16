import { getSession } from "../auth/session.js";
import { ROLES } from "../auth/roles.js";
import {
  MOVEMENT_TYPES,
  getInventoryPage,
  getMedicineMovements,
  registerInventoryMovement,
  upsertMedicine
} from "./inventario.service.js";

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
  return role === ROLES.ADMIN || role === ROLES.MEDICO || role === ROLES.OPERADOR;
}

function renderShell() {
  const writeAllowed = canWriteInventory();

  return `
    <section class="space-y-6">
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Inventario homeopático</h2>
          <p class="text-slate-500">Medicamentos, potencias, presentaciones, stock y auditoría de movimientos.</p>
        </div>
        <button id="refresh-inventory" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Actualizar</button>
      </div>

      <div class="grid gap-6 2xl:grid-cols-[420px_1fr]">
        <form id="medicine-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 ${writeAllowed ? "" : "hidden"}">
          <h3 class="text-lg font-semibold text-slate-900">Medicamento</h3>
          <input id="medicine-id" type="hidden" />
          <div class="mt-5 space-y-4">
            ${renderInput("name", "Nombre", "text", true)}
            ${renderInput("activeIngredient", "Principio activo", "text", false)}
            ${renderInput("sanitaryRegistry", "Registro sanitario", "text", false)}
            ${renderInput("laboratory", "Laboratorio", "text", false)}
            <div class="grid gap-4 sm:grid-cols-2">
              ${renderInput("lot", "Lote", "text", false)}
              ${renderInput("expirationDate", "Fecha de vencimiento", "date", false)}
            </div>
            ${renderInput("potency", "Dilución / Potencia", "text", true)}
            ${renderInput("presentation", "Presentación", "text", true)}
            ${renderInput("concentration", "Concentración", "text", false)}
            ${renderInput("storageConditions", "Condiciones de almacenamiento", "text", false)}
            <div class="grid gap-4 sm:grid-cols-2">
              ${renderInput("location", "Ubicación interna", "text", false)}
              ${renderInput("supplier", "Proveedor", "text", false)}
            </div>
            <div class="grid gap-4 sm:grid-cols-3">
              ${renderInput("stock", "Stock", "number", true)}
              ${renderInput("minStock", "Mínimo", "number", true)}
              ${renderInput("salePrice", "Precio", "number", true)}
            </div>
            ${renderInput("purchasePrice", "Costo de compra", "number", false)}
            <p id="inventory-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
            <div class="grid gap-3 sm:grid-cols-2">
              <button class="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar</button>
              <button id="clear-medicine-form" class="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50" type="button">Limpiar</button>
            </div>
          </div>
        </form>

        <div class="space-y-6">
          <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div class="border-b border-slate-200 p-5">
              <h3 class="text-lg font-semibold text-slate-900">Medicamentos</h3>
              <p class="text-sm text-slate-500">Listado paginado de máximo 15 medicamentos por carga.</p>
            </div>
            <div id="inventory-table" class="overflow-x-auto"></div>
            <div class="border-t border-slate-200 p-4 text-right">
              <button id="load-more-inventory" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
            </div>
          </div>

          <div id="movements-panel" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
      <input id="${id}" type="${type}" ${required ? "required" : ""} min="0" step="${type === "number" ? "0.01" : "any"}" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
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
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Medicamento</th>
          <th class="px-5 py-3">Presentación</th>
          <th class="px-5 py-3">Lote/Vence</th>
          <th class="px-5 py-3">Stock</th>
          <th class="px-5 py-3">Precio</th>
          <th class="px-5 py-3 text-right">Acciones</th>
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
      <td class="px-5 py-4">
        <div class="font-medium text-slate-900">${medicine.name || "Sin nombre"}</div>
        <div class="text-xs text-slate-500">${medicine.activeIngredient || medicine.potency || "Sin principio activo"}</div>
      </td>
      <td class="px-5 py-4 text-slate-600">${medicine.presentation || "Sin presentación"} · ${medicine.potency || "Sin potencia"}</td>
      <td class="px-5 py-4 text-slate-600">${medicine.lot || "Sin lote"}<br><span class="text-xs text-slate-400">${medicine.expirationDate || "Sin vencimiento"}</span></td>
      <td class="px-5 py-4">
        <span class="rounded-full px-3 py-1 text-xs font-medium ${lowStock ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}">${medicine.stock || 0} / mín. ${medicine.minStock || 0}</span>
      </td>
      <td class="px-5 py-4 text-slate-600">$${Number(medicine.salePrice || 0).toLocaleString("es-CO")}</td>
      <td class="px-5 py-4 text-right">
        ${canWriteInventory() ? `<button data-edit-medicine="${medicine.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>` : ""}
        <button data-movements-medicine="${medicine.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Movimientos</button>
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
  form.activeIngredient.value = medicine.activeIngredient || "";
  form.sanitaryRegistry.value = medicine.sanitaryRegistry || "";
  form.laboratory.value = medicine.laboratory || "";
  form.lot.value = medicine.lot || "";
  form.expirationDate.value = medicine.expirationDate || "";
  form.potency.value = medicine.potency || "";
  form.presentation.value = medicine.presentation || "";
  form.concentration.value = medicine.concentration || "";
  form.storageConditions.value = medicine.storageConditions || "";
  form.location.value = medicine.location || "";
  form.supplier.value = medicine.supplier || "";
  form.stock.value = medicine.stock || 0;
  form.minStock.value = medicine.minStock || 0;
  form.salePrice.value = medicine.salePrice || 0;
  form.purchasePrice.value = medicine.purchasePrice || 0;
}

async function saveMedicine(container, form) {
  try {
    await upsertMedicine(form.querySelector("#medicine-id").value, {
      name: form.name.value,
      activeIngredient: form.activeIngredient.value,
      sanitaryRegistry: form.sanitaryRegistry.value,
      laboratory: form.laboratory.value,
      lot: form.lot.value,
      expirationDate: form.expirationDate.value,
      potency: form.potency.value,
      presentation: form.presentation.value,
      concentration: form.concentration.value,
      storageConditions: form.storageConditions.value,
      location: form.location.value,
      supplier: form.supplier.value,
      stock: form.stock.value,
      minStock: form.minStock.value,
      salePrice: form.salePrice.value,
      purchasePrice: form.purchasePrice.value
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
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp.toDate());
}
