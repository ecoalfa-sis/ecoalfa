export function renderDashboardView() {
  return `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p class="text-slate-500">Indicadores administrativos y alertas operativas.</p>
      </div>
      <div class="grid gap-4 md:grid-cols-4">
        ${renderMetricCard("Ingresos diarios", "$0", "Pendiente FASE Dashboard")}
        ${renderMetricCard("Citas atendidas", "0", "Pendiente FASE Citas")}
        ${renderMetricCard("Stock bajo", "0", "Pendiente FASE Inventario")}
        ${renderMetricCard("Ventas medicamentos", "0", "Pendiente FASE POS")}
      </div>
      <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <canvas id="dashboard-chart" height="120"></canvas>
      </div>
    </section>
  `;
}

export function renderCitasView() {
  return renderModuleShell("Gestión de citas", "Lista diaria optimizada para consultar citas por fecha con paginación.");
}

export function renderPacientesView() {
  return renderModuleShell("Pacientes", "Gestión de datos, contacto y vinculación con pacientes inscritos desde el portal.");
}

export function renderHistoriasView() {
  return renderModuleShell("Historias clínicas", "Atención médica, evolución clínica, prescripción y generación de PDF.");
}

export function renderInventarioView() {
  return renderModuleShell("Inventario médico", "Medicamentos, potencias, presentaciones, stock y alertas mínimas.");
}

export function renderFacturacionView() {
  return renderModuleShell("Facturación POS", "Caja ágil para consultas, medicamentos, pagos y tickets térmicos.");
}

export function renderUsuariosView() {
  return renderModuleShell("Usuarios y roles", "Administración de perfiles, estados y permisos RBAC.");
}

export function renderUnauthorizedView() {
  return `
    <section class="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <h2 class="text-2xl font-bold text-slate-900">Acceso restringido</h2>
      <p class="mt-2 text-slate-500">Tu rol no tiene permisos para acceder a este módulo.</p>
    </section>
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

function renderModuleShell(title, description) {
  return `
    <section class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h2 class="text-2xl font-bold text-slate-900">${title}</h2>
      <p class="mt-2 text-slate-500">${description}</p>
      <div class="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        Módulo reservado para la siguiente fase de implementación.
      </div>
    </section>
  `;
}
