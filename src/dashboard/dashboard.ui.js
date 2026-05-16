import { getSession } from "../auth/session.js";
import { getDashboardKpis } from "./dashboard.service.js";

let dashboardChart = null;

export async function renderDashboardModule(container) {
  container.innerHTML = renderLoading();

  try {
    const role = getSession().profile?.role;
    const kpis = await getDashboardKpis(role);
    const isMobile = detectMobileDevice();
    container.innerHTML = renderDashboard(kpis, isMobile);
    if (!isMobile) {
      renderIncomeChart(kpis.incomeByDay);
    }
  } catch (error) {
    container.innerHTML = `
      <section class="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h2 class="text-2xl font-bold text-slate-900">No fue posible cargar el dashboard</h2>
        <p class="mt-2 text-slate-500">Verifica permisos, índices de Firestore o datos iniciales.</p>
      </section>
    `;
  }
}

function detectMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function renderLoading() {
  return `
    <section class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <p class="text-sm text-slate-500">Cargando indicadores...</p>
    </section>
  `;
}

function renderDashboard(kpis, isMobile) {
  const mobileClass = isMobile ? "text-base" : "";
  
  return `
    <section class="space-y-6 ${mobileClass}">
      <div class="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p class="text-slate-500">${isMobile ? "Vista adaptada para móvil" : "Indicadores operativos"}</p>
        </div>
        ${kpis.limited ? `<span class="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">Vista limitada</span>` : ""}
      </div>

      <div class="grid gap-4 ${isMobile ? "grid-cols-2" : "md:grid-cols-4"}">
        ${renderMetricCard("Ingresos hoy", `$${formatCurrency(kpis.dailyIncome)}`, "Diario")}
        ${renderMetricCard("Ingresos mes", `$${formatCurrency(kpis.monthlyIncome)}`, "Mensual")}
        ${renderMetricCard("Citas atendidas", kpis.attendedAppointments, "Total")}
        ${renderMetricCard("Stock bajo", kpis.lowStock.length, "Alertas")}
      </div>

      ${renderPendingAppointments(kpis.pendingAppointments)}

      <div class="grid gap-6 ${isMobile ? "grid-cols-1" : "xl:grid-cols-[1fr_380px]"}">
        ${!isMobile ? `
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 class="mb-4 text-lg font-semibold text-slate-900">Ingresos últimos 7 días</h3>
          <canvas id="income-chart" height="120"></canvas>
        </div>
        ` : ""}

        <div class="space-y-6">
          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Medicamentos más vendidos</h3>
            <div class="mt-4 space-y-3">
              ${renderTopMedicines(kpis.topMedicines)}
            </div>
          </div>

          <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">Alertas de stock bajo</h3>
            <div class="mt-4 space-y-3">
              ${renderLowStock(kpis.lowStock)}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPendingAppointments(appointments) {
  if (!appointments || appointments.length === 0) {
    return `
      <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Citas de hoy</h3>
        <p class="mt-2 text-sm text-slate-500">No hay citas pendientes para hoy.</p>
      </div>
    `;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  return `
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">Citas pendientes hoy (${appointments.length})</h3>
        <span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">Por atender</span>
      </div>
      <div class="mt-4 space-y-2">
        ${appointments.map((apt) => {
          const [aptHour, aptMinute] = (apt.time || "00:00").split(":").map(Number);
          const isPast = aptHour < currentHour || (aptHour === currentHour && aptMinute < currentMinute);
          const statusColor = isPast ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200";
          return `
            <div class="flex items-center justify-between rounded-xl border ${statusColor} px-4 py-3">
              <div>
                <strong class="block text-sm font-semibold">${apt.patientName || "Paciente"}</strong>
                <span class="text-xs">${apt.time || "--:--"} · ${apt.doctorName || "Sin médico"}</span>
              </div>
              <span class="rounded-full bg-white px-2 py-1 text-xs font-medium">${apt.status || "Programada"}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderMetricCard(title, value, helper) {
  return `
    <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p class="text-sm font-medium text-slate-500">${title}</p>
      <strong class="mt-2 block text-3xl text-slate-900">${value}</strong>
      <span class="mt-2 block text-xs text-slate-400">${helper}</span>
    </article>
  `;
}

function renderTopMedicines(medicines) {
  if (!medicines.length) {
    return `<p class="text-sm text-slate-500">Sin ventas de medicamentos registradas.</p>`;
  }

  return medicines.map((medicine) => `
    <div class="flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <span class="font-medium text-slate-800">${medicine.name}</span>
      <span class="text-slate-500">${medicine.quantity}</span>
    </div>
  `).join("");
}

function renderLowStock(medicines) {
  if (!medicines.length) {
    return `<p class="text-sm text-slate-500">Sin alertas de stock bajo.</p>`;
  }

  return medicines.slice(0, 8).map((medicine) => `
    <div class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      <strong>${medicine.name} ${medicine.potency || ""}</strong>
      <span class="block text-red-600">Stock ${medicine.stock || 0} / mínimo ${medicine.minStock || 0}</span>
    </div>
  `).join("");
}

function renderIncomeChart(incomeByDay) {
  const canvas = document.querySelector("#income-chart");

  if (!canvas || !window.Chart) {
    return;
  }

  if (dashboardChart) {
    dashboardChart.destroy();
  }

  const labels = Object.keys(incomeByDay);
  const values = Object.values(incomeByDay);

  dashboardChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Ingresos",
          data: values,
          borderColor: "#047857",
          backgroundColor: "rgba(4, 120, 87, 0.12)",
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("es-CO");
}
