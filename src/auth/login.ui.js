import { loginWithEmail } from "../firebase/auth.js";

export function renderLogin(container) {
  container.innerHTML = `
    <main class="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-6">
      <canvas id="internal-login-canvas" class="absolute inset-0 h-full w-full"></canvas>
      <section class="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur lg:grid-cols-[1fr_440px]">
        <div class="relative hidden p-10 text-white lg:block">
          <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-indigo-500/10"></div>
          <div class="relative z-10 flex h-full flex-col justify-between">
            <div class="inline-flex w-fit items-center gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <img src="./assets/ecoalfa-logo.jpeg" alt="Logo Ecoalfa" class="h-24 w-24 rounded-2xl bg-white object-contain" />
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.35em] text-blue-200">Ecoalfa</p>
                <p class="text-sm text-white/70">ERP / CRM clínico</p>
              </div>
            </div>
            <div>
              <h1 class="max-w-xl text-5xl font-black tracking-tight">Gestión clínica moderna, segura y conectada.</h1>
              <p class="mt-5 max-w-lg text-lg leading-8 text-slate-200">Administra pacientes, citas, inventario, facturación e historias clínicas desde una plataforma profesional.</p>
              <div class="mt-8 grid grid-cols-3 gap-4">
                <div class="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur"><strong>Pacientes</strong><p class="mt-1 text-xs text-blue-100">Historia y control.</p></div>
                <div class="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur"><strong>Citas</strong><p class="mt-1 text-xs text-sky-100">Agenda diaria.</p></div>
                <div class="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur"><strong>POS</strong><p class="mt-1 text-xs text-lime-100">Facturación.</p></div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white p-8 sm:p-10">
          <div class="mb-8 text-center lg:hidden">
            <img src="./assets/ecoalfa-logo.jpeg" alt="Logo Ecoalfa" class="mx-auto mb-4 h-24 w-24 rounded-2xl object-contain ring-1 ring-slate-200" />
          </div>
          <div class="mb-8">
            <p class="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">Acceso interno</p>
            <h2 class="mt-2 text-3xl font-black text-slate-950">Bienvenido</h2>
            <p class="mt-2 text-sm text-slate-500">Ingresa con tu usuario autorizado de Ecoalfa.</p>
          </div>

          <form id="login-form" class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="email">Correo electrónico</label>
              <input id="email" type="email" required class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" autocomplete="email" />
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-slate-700" for="password">Contraseña</label>
              <input id="password" type="password" required class="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" autocomplete="current-password" />
            </div>

            <p id="login-error" class="hidden rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"></p>

            <button id="login-button" class="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit">
              Ingresar
            </button>
          </form>
        </div>
      </section>
    </main>
  `;

  const form = document.querySelector("#login-form");
  const errorBox = document.querySelector("#login-error");
  const loginButton = document.querySelector("#login-button");

  initInternalLoginCanvas();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("hidden");
    loginButton.disabled = true;
    loginButton.textContent = "Ingresando...";

    const email = form.email.value.trim();
    const password = form.password.value;

    try {
      await loginWithEmail(email, password);
    } catch (error) {
      errorBox.textContent = getLoginErrorMessage(error);
      errorBox.classList.remove("hidden");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Ingresar";
    }
  });
}

function initInternalLoginCanvas() {
  const canvas = document.querySelector("#internal-login-canvas");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  const particles = Array.from({ length: 42 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    radius: 1.5 + Math.random() * 4,
    speed: 0.0006 + Math.random() * 0.0015,
    phase: index * 0.9
  }));

  function resize() {
    canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
    canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function draw(time) {
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0c1e3d");
    gradient.addColorStop(0.45, "#1e3a5f");
    gradient.addColorStop(1, "#020617");

    context.clearRect(0, 0, width, height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.18;
    context.fillStyle = "#3b82f6";
    context.beginPath();
    context.arc(width * 0.75, height * 0.2, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.14;
    context.strokeStyle = "#38bdf8";
    context.lineWidth = 2;
    for (let index = 0; index < 6; index += 1) {
      context.beginPath();
      context.arc(width * 0.18, height * 0.42, 120 + index * 38, 0, Math.PI * 1.6);
      context.stroke();
    }

    context.globalAlpha = 0.8;
    particles.forEach((particle) => {
      const x = particle.x * width + Math.sin(time * particle.speed + particle.phase) * 28;
      const y = particle.y * height + Math.cos(time * particle.speed + particle.phase) * 20;
      context.fillStyle = particle.radius > 4 ? "#93c5fd" : "#bae6fd";
      context.beginPath();
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    });

    context.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
}

function getLoginErrorMessage(error) {
  const messages = {
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No existe un usuario con este correo en Firebase Authentication.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/too-many-requests": "Demasiados intentos fallidos. Intenta nuevamente más tarde.",
    "auth/operation-not-allowed": "El proveedor Email/Password no está habilitado en Firebase Authentication.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Revisa internet, dominio autorizado o bloqueos del navegador."
  };

  return messages[error.code] || `No fue posible iniciar sesión. Código: ${error.code || "desconocido"}`;
}
