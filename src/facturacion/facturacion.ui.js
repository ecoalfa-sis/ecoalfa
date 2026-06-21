import { PAYMENT_TYPES, createInvoice, getPosMedicines, searchBillingPatients } from "./facturacion.service.js";

let medicines = [];
let cart = [];
let lastInvoice = null;

export async function renderFacturacionModule(container) {
  container.innerHTML = renderShell();
  bindPosEvents(container);
  await loadMedicines(container);
  renderCart(container);
}

function renderShell() {
  return `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Facturación POS</h2>
        <p class="text-slate-500">Caja ágil para consultas médicas y venta de medicamentos.</p>
      </div>

      <div class="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div class="space-y-6">
          <form id="pos-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Agregar ítem</h3>
            <div class="mt-5 space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="item-type">Tipo</label>
                <select id="item-type" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                  <option value="consultation">Consulta médica</option>
                  <option value="medicine">Medicamento</option>
                </select>
              </div>

              <div id="consultation-fields" class="space-y-4">
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700" for="consultation-name">Descripción</label>
                  <input id="consultation-name" value="Consulta médica" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700" for="consultation-price">Valor</label>
                  <input id="consultation-price" type="number" min="0" value="0" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                </div>
              </div>

              <div id="medicine-fields" class="hidden space-y-4">
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700" for="medicine-select">Medicamento</label>
                  <select id="medicine-select" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"></select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-slate-700" for="medicine-quantity">Cantidad</label>
                  <input id="medicine-quantity" type="number" min="1" value="1" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                </div>
              </div>

              <button class="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Agregar al carrito</button>
            </div>
          </form>

          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Datos de pago</h3>
            <div class="mt-5 space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="customer-search">Buscar cliente (cedula/nombre)</label>
                <div class="flex gap-2">
                  <input id="customer-search" placeholder="Escribe para buscar o deja vacío para nombre libre" class="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                  <button id="search-customer" class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Buscar</button>
                </div>
                <div id="customer-results" class="mt-2 max-h-32 overflow-y-auto"></div>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="customer-name">Cliente</label>
                <input id="customer-name" placeholder="Consumidor final" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
                <input id="customer-id" type="hidden" />
                <input id="customer-document" type="hidden" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-slate-700" for="payment-type">Forma de pago</label>
                <select id="payment-type" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                  ${PAYMENT_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
                </select>
              </div>
              <p id="pos-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
              <button id="save-invoice" class="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800" type="button">Facturar</button>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div class="border-b border-slate-200 p-5">
              <h3 class="text-lg font-semibold text-slate-900">Carrito</h3>
              <p class="text-sm text-slate-500">Los medicamentos descuentan inventario al facturar.</p>
            </div>
            <div id="cart-table" class="overflow-x-auto"></div>
          </div>

          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div class="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <h3 class="text-lg font-semibold text-slate-900">Ticket térmico</h3>
              <div class="flex gap-2">
                <button id="print-ticket" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" type="button">Imprimir</button>
                <button id="print-letter" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" type="button">Factura carta</button>
              </div>
            </div>
            <div id="ticket-preview" class="ticket-preview mt-5 rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-800"></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindPosEvents(container) {
  container.querySelector("#item-type").addEventListener("change", () => toggleItemFields(container));
  container.querySelector("#pos-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addCartItem(container);
  });
  container.querySelector("#save-invoice").addEventListener("click", async () => saveInvoice(container));
  container.querySelector("#print-ticket").addEventListener("click", () => printTicket());
  container.querySelector("#print-letter").addEventListener("click", () => printLetterInvoice());
  container.querySelector("#search-customer").addEventListener("click", async () => searchCustomer(container));
  container.querySelector("#customer-search").addEventListener("input", async (event) => {
    if (event.target.value.length >= 2) {
      await searchCustomer(container);
    } else {
      container.querySelector("#customer-results").innerHTML = "";
    }
  });
}

async function loadMedicines(container) {
  const select = container.querySelector("#medicine-select");
  select.innerHTML = `<option>Cargando medicamentos...</option>`;

  try {
    medicines = await getPosMedicines();
    select.innerHTML = medicines.map((medicine) => `
      <option value="${medicine.id}">${medicine.name} ${medicine.potency} · Stock ${medicine.stock || 0} · $${formatCurrency(medicine.salePrice || 0)}</option>
    `).join("");
  } catch (error) {
    select.innerHTML = `<option>No fue posible cargar medicamentos</option>`;
  }
}

function toggleItemFields(container) {
  const itemType = container.querySelector("#item-type").value;
  container.querySelector("#consultation-fields").classList.toggle("hidden", itemType !== "consultation");
  container.querySelector("#medicine-fields").classList.toggle("hidden", itemType !== "medicine");
}

async function searchCustomer(container) {
  const searchTerm = container.querySelector("#customer-search").value;
  const resultsDiv = container.querySelector("#customer-results");

  if (!searchTerm.trim()) {
    resultsDiv.innerHTML = "";
    return;
  }

  resultsDiv.innerHTML = `<div class="text-xs text-slate-500">Buscando...</div>`;

  try {
    const patients = await searchBillingPatients(searchTerm);
    resultsDiv.innerHTML = patients.length
      ? patients.map((patient) => `
          <button data-select-customer="${patient.id}" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
            <div class="font-medium text-slate-900">${patient.fullName || "Sin nombre"}</div>
            <div class="text-xs text-slate-500">${patient.documentNumber || "Sin documento"}</div>
          </button>
        `).join("")
      : `<div class="text-xs text-slate-500">No se encontraron pacientes. Usa el campo Cliente para escribir un nombre libre.</div>`;

    resultsDiv.querySelectorAll("[data-select-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        const patientId = button.dataset.selectCustomer;
        const patient = patients.find((p) => p.id === patientId);
        if (patient) {
          container.querySelector("#customer-name").value = patient.fullName || "";
          container.querySelector("#customer-id").value = patient.id || "";
          container.querySelector("#customer-document").value = patient.documentNumber || "";
          container.querySelector("#customer-search").value = "";
          resultsDiv.innerHTML = "";
        }
      });
    });
  } catch (error) {
    resultsDiv.innerHTML = `<div class="text-xs text-red-600">Error al buscar: ${error.message || ""}</div>`;
  }
}

function addCartItem(container) {
  const itemType = container.querySelector("#item-type").value;

  if (itemType === "consultation") {
    cart.push({
      id: crypto.randomUUID(),
      type: "consultation",
      name: container.querySelector("#consultation-name").value.trim() || "Consulta médica",
      quantity: 1,
      unitPrice: Number(container.querySelector("#consultation-price").value || 0)
    });
  }

  if (itemType === "medicine") {
    const medicineId = container.querySelector("#medicine-select").value;
    const medicine = medicines.find((item) => item.id === medicineId);
    const quantity = Number(container.querySelector("#medicine-quantity").value || 1);

    if (!medicine || quantity < 1) {
      showMessage(container, "Selecciona un medicamento y una cantidad válida.", "error");
      return;
    }

    if (quantity > Number(medicine.stock || 0)) {
      showMessage(container, "La cantidad supera el stock disponible.", "error");
      return;
    }

    cart.push({
      id: crypto.randomUUID(),
      type: "medicine",
      medicineId: medicine.id,
      name: `${medicine.name} ${medicine.potency}`,
      quantity,
      unitPrice: Number(medicine.salePrice || 0)
    });
  }

  renderCart(container);
}

function renderCart(container) {
  const table = container.querySelector("#cart-table");
  const ticket = container.querySelector("#ticket-preview");

  if (!cart.length) {
    table.innerHTML = `<div class="p-6 text-sm text-slate-500">No hay ítems en el carrito.</div>`;
    ticket.innerHTML = renderTicket(null);
    return;
  }

  table.innerHTML = `
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Ítem</th>
          <th class="px-5 py-3">Cant.</th>
          <th class="px-5 py-3">Total</th>
          <th class="px-5 py-3 text-right">Acción</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${cart.map((item) => `
          <tr>
            <td class="px-5 py-4 text-slate-900">${item.name}</td>
            <td class="px-5 py-4 text-slate-600">${item.quantity}</td>
            <td class="px-5 py-4 text-slate-600">$${formatCurrency(item.quantity * item.unitPrice)}</td>
            <td class="px-5 py-4 text-right"><button data-remove-item="${item.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Quitar</button></td>
          </tr>
        `).join("")}
      </tbody>
      <tfoot>
        <tr><td colspan="2" class="px-5 py-4 text-right font-semibold">Total</td><td class="px-5 py-4 font-bold">$${formatCurrency(getCartTotal())}</td><td></td></tr>
      </tfoot>
    </table>
  `;

  table.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      cart = cart.filter((item) => item.id !== button.dataset.removeItem);
      renderCart(container);
    });
  });

  ticket.innerHTML = renderTicket(buildInvoicePreview(container));
}

async function saveInvoice(container) {
  if (!cart.length) {
    showMessage(container, "Agrega al menos un ítem para facturar.", "error");
    return;
  }

  const invoice = buildInvoicePreview(container);

  try {
    const invoiceId = await createInvoice(invoice);
    lastInvoice = { ...invoice, id: invoiceId };
    cart = [];
    await loadMedicines(container);
    renderCart(container);
    container.querySelector("#ticket-preview").innerHTML = renderTicket(lastInvoice);
    showMessage(container, "Factura guardada correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible guardar la factura. Verifica permisos y stock.", "error");
  }
}

function buildInvoicePreview(container) {
  const total = getCartTotal();

  return {
    number: generateInvoiceNumber(),
    patientId: container.querySelector("#customer-id").value || "",
    authUid: "",
    customerDocument: container.querySelector("#customer-document").value || "",
    customerName: container.querySelector("#customer-name").value || "Consumidor final",
    paymentType: container.querySelector("#payment-type").value,
    items: cart.map((item) => ({
      type: item.type,
      medicineId: item.medicineId || null,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice
    })),
    subtotal: total,
    total
  };
}

function renderTicket(invoice) {
  if (!invoice) {
    return `ECOALFA\nPOS listo para facturar\n------------------------\nAgrega ítems al carrito`;
  }

  return `
ECOALFA
Medicina
Factura: ${invoice.number}
Cliente: ${invoice.customerName}
Pago: ${invoice.paymentType}
------------------------
${invoice.items.map((item) => `${item.name}\n${item.quantity} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.total)}`).join("\n")}
------------------------
TOTAL: $${formatCurrency(invoice.total)}
Gracias por su compra
  `.trim();
}

function printTicket() {
  const ticketContent = document.querySelector("#ticket-preview")?.innerText || "";
  const printWindow = window.open("", "_blank", "width=320,height=600");

  printWindow.document.write(`
    <html>
      <head><title>Ticket Ecoalfa</title></head>
      <body style="font-family: monospace; white-space: pre-wrap; width: 80mm; font-size: 12px;">${ticketContent}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printLetterInvoice() {
  const invoice = lastInvoice;
  if (!invoice) {
    alert("Primero guarda una factura para imprimirla en formato carta.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=800,height=1000");
  const now = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long", day: "numeric" });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Factura Ecoalfa - ${invoice.number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #148dcc; padding-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #148dcc; }
          .invoice-info { text-align: right; }
          .invoice-info h2 { margin: 0 0 8px 0; color: #148dcc; }
          .invoice-info p { margin: 4px 0; font-size: 14px; }
          .customer-info { margin-bottom: 30px; }
          .customer-info h3 { margin: 0 0 12px 0; color: #43aa35; }
          .customer-info p { margin: 6px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .total-row td { font-weight: bold; font-size: 16px; border-top: 2px solid #148dcc; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">ECOALFA</div>
          <div class="invoice-info">
            <h2>FACTURA</h2>
            <p><strong>Número:</strong> ${invoice.number}</p>
            <p><strong>Fecha:</strong> ${now}</p>
            <p><strong>Forma de pago:</strong> ${invoice.paymentType}</p>
          </div>
        </div>

        <div class="customer-info">
          <h3>Cliente</h3>
          <p><strong>Nombre:</strong> ${invoice.customerName}</p>
          ${invoice.customerDocument ? `<p><strong>Documento:</strong> ${invoice.customerDocument}</p>` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>$${formatCurrency(item.unitPrice)}</td>
                <td>$${formatCurrency(item.total)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;">TOTAL</td>
              <td>$${formatCurrency(invoice.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>ECOALFA Medicina · Colombia · Zona horaria Bogotá</p>
          <p>Gracias por su compra</p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function getCartTotal() {
  return cart.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
}

function generateInvoiceNumber() {
  return `POS-${Date.now()}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-CO");
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#pos-message");
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
}
