import { ROLE_LABELS, ROLES } from "../auth/roles.js";
import { getUsersPage, updateUserProfile, upsertUserProfile } from "./usuarios.service.js";

let lastVisibleUser = null;
let canLoadMoreUsers = false;
let currentUsers = [];

export async function renderUsuariosModule(container) {
  container.innerHTML = renderShell();
  bindUserEvents(container);
  await loadUsers(container, true);
}

function renderShell() {
  return `
    <section class="space-y-6">
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Usuarios y roles</h2>
          <p class="text-slate-500">Administración RBAC de perfiles autorizados en Firestore.</p>
        </div>
        <button id="refresh-users" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Actualizar</button>
      </div>

      <div class="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form id="user-profile-form" class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">Crear/actualizar perfil</h3>
          <p class="mt-1 text-sm text-slate-500">El UID debe existir en Firebase Authentication.</p>

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="uid">UID Auth</label>
              <input id="uid" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              <p id="uid-help" class="mt-1 text-xs text-slate-500">Pega el UID de Firebase Authentication al crear el perfil.</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="displayName">Nombre</label>
              <input id="displayName" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="email">Correo</label>
              <input id="email" type="email" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="role">Rol</label>
              <select id="role" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                ${Object.values(ROLES).map((role) => `<option value="${role}">${ROLE_LABELS[role]}</option>`).join("")}
              </select>
            </div>
            <label class="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input id="active" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-emerald-600" />
              Usuario activo
            </label>
            <p id="users-message" class="hidden rounded-xl px-4 py-3 text-sm"></p>
            <button class="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800" type="submit">Guardar perfil</button>
          </div>
        </form>

        <div class="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div class="border-b border-slate-200 p-5">
            <h3 class="text-lg font-semibold text-slate-900">Perfiles registrados</h3>
            <p class="text-sm text-slate-500">Lectura paginada de máximo 10 documentos por carga.</p>
          </div>
          <div id="users-table" class="overflow-x-auto"></div>
          <div class="border-t border-slate-200 p-4 text-right">
            <button id="load-more-users" class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cargar más</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindUserEvents(container) {
  container.querySelector("#user-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile(container, event.currentTarget);
  });

  container.querySelector("#refresh-users").addEventListener("click", async () => {
    await loadUsers(container, true);
  });

  container.querySelector("#load-more-users").addEventListener("click", async () => {
    await loadUsers(container, false);
  });
}

async function loadUsers(container, reset) {
  const table = container.querySelector("#users-table");
  const loadMoreButton = container.querySelector("#load-more-users");

  table.innerHTML = `<div class="p-6 text-sm text-slate-500">Cargando usuarios...</div>`;

  if (reset) {
    lastVisibleUser = null;
    currentUsers = [];
  }

  const page = await getUsersPage(lastVisibleUser);
  currentUsers = [...currentUsers, ...page.users];
  lastVisibleUser = page.lastVisible;
  canLoadMoreUsers = page.hasMore;

  table.innerHTML = renderUsersTable(currentUsers);
  loadMoreButton.disabled = !canLoadMoreUsers;
  loadMoreButton.classList.toggle("opacity-50", !canLoadMoreUsers);

  bindTableEvents(container);
}

function renderUsersTable(users) {
  if (!users.length) {
    return `<div class="p-6 text-sm text-slate-500">No hay perfiles registrados.</div>`;
  }

  return `
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-5 py-3">Nombre</th>
          <th class="px-5 py-3">Correo</th>
          <th class="px-5 py-3">Rol</th>
          <th class="px-5 py-3">Estado</th>
          <th class="px-5 py-3 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${users.map(renderUserRow).join("")}
      </tbody>
    </table>
  `;
}

function renderUserRow(user) {
  return `
    <tr>
      <td class="px-5 py-4 font-medium text-slate-900">${user.displayName || "Sin nombre"}</td>
      <td class="px-5 py-4 text-slate-600">${user.email || "Sin correo"}</td>
      <td class="px-5 py-4 text-slate-600">${ROLE_LABELS[user.role] || user.role || "Sin rol"}</td>
      <td class="px-5 py-4">
        <span class="rounded-full px-3 py-1 text-xs font-medium ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}">${user.active ? "Activo" : "Inactivo"}</span>
      </td>
      <td class="px-5 py-4 text-right">
        <button data-edit-user="${user.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Editar</button>
        <button data-toggle-user="${user.id}" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">${user.active ? "Desactivar" : "Activar"}</button>
      </td>
    </tr>
  `;
}

function bindTableEvents(container) {
  container.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => fillForm(container, button.dataset.editUser));
  });

  container.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = currentUsers.find((item) => item.id === button.dataset.toggleUser);
      await updateUserProfile(user.id, { active: !user.active });
      await loadUsers(container, true);
      showMessage(container, "Estado actualizado correctamente.", "success");
    });
  });
}

function fillForm(container, uid) {
  const user = currentUsers.find((item) => item.id === uid);
  const form = container.querySelector("#user-profile-form");

  form.uid.value = user.id;
  form.uid.readOnly = true;
  form.uid.classList.add("bg-slate-100", "text-slate-500");
  container.querySelector("#uid-help").textContent = "UID de Firebase Authentication visible para referencia. No se modifica en perfiles existentes.";
  form.displayName.value = user.displayName || "";
  form.email.value = user.email || "";
  form.role.value = user.role || ROLES.ASESOR;
  form.active.checked = user.active !== false;
}

async function saveProfile(container, form) {
  try {
    await upsertUserProfile(form.uid.value.trim(), {
      displayName: form.displayName.value,
      email: form.email.value,
      role: form.role.value,
      active: form.active.checked
    });

    form.reset();
    form.active.checked = true;
    form.uid.readOnly = false;
    form.uid.classList.remove("bg-slate-100", "text-slate-500");
    container.querySelector("#uid-help").textContent = "Pega el UID de Firebase Authentication al crear el perfil.";
    await loadUsers(container, true);
    showMessage(container, "Perfil guardado correctamente.", "success");
  } catch (error) {
    showMessage(container, "No fue posible guardar el perfil. Verifica permisos y reglas.", "error");
  }
}

function showMessage(container, message, type) {
  const messageBox = container.querySelector("#users-message");
  const classes = type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";

  messageBox.className = `rounded-xl px-4 py-3 text-sm ${classes}`;
  messageBox.textContent = message;
}
