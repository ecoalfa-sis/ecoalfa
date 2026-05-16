import { renderLogin } from "./auth/login.ui.js";
import { getSession, subscribeSession } from "./auth/session.js";
import { bindRouter, renderProtectedApp } from "./ui/router.js";

const appContainer = document.querySelector("#app");

bindRouter(appContainer, getSession);

subscribeSession((session) => {
  if (!session.user) {
    renderLogin(appContainer);
    return;
  }

  if (session.error) {
    const helpText = getSessionErrorHelp(session.error);

    appContainer.innerHTML = `
      <main class="min-h-screen grid place-items-center bg-slate-100 p-6">
        <section class="max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 class="text-2xl font-bold text-slate-900">No se pudo cargar tu perfil</h1>
          <p class="mt-2 text-slate-500">La autenticación fue correcta, pero Firestore no permitió leer el documento del usuario.</p>
          <div class="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>UID:</strong> ${session.user.uid}</p>
            <p class="mt-2"><strong>Código:</strong> ${session.error.code || "desconocido"}</p>
          </div>
          <div class="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">${helpText}</div>
          <p class="mt-5 text-sm text-slate-500">Verifica que exista el documento <strong>users/${session.user.uid}</strong> con un rol válido y <strong>active: true</strong>.</p>
        </section>
      </main>
    `;
    return;
  }

  if (!session.profile || session.profile.active === false) {
    appContainer.innerHTML = `
      <main class="min-h-screen grid place-items-center bg-slate-100 p-6">
        <section class="max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 class="text-2xl font-bold text-slate-900">Usuario sin acceso</h1>
          <p class="mt-2 text-slate-500">Tu perfil no está activo o no tiene un rol asignado.</p>
          <div class="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p><strong>UID:</strong> ${session.user.uid}</p>
          </div>
          <p class="mt-5 text-sm text-slate-500">Crea o corrige el documento <strong>users/${session.user.uid}</strong> en Firestore.</p>
        </section>
      </main>
    `;
    return;
  }

  renderProtectedApp(appContainer, session);
});

function getSessionErrorHelp(error) {
  if (error.code === "unavailable") {
    return "Firestore no está respondiendo desde el navegador. Revisa tu conexión, bloqueadores de anuncios/extensiones, que Firestore Database esté creado en Firebase Console y que el dominio de GitHub Pages esté autorizado en Firebase Authentication.";
  }

  if (error.code === "permission-denied") {
    return "Firestore rechazó la lectura por reglas de seguridad. Publica temporalmente firestore.bootstrap.rules para inicializar o crea manualmente users/{uid} con role admin y active true.";
  }

  return "Abre la consola de Chrome para ver el detalle completo del error y verifica la configuración de Firebase.";
}
