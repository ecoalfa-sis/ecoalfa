# Ecoalfa ERP/CRM

Sistema SPA modular para gestión de consultorio de medicina homeopática.

## FASE 1

Incluye:

- Configuración base de Firebase v10+ por CDN ES Modules.
- Firebase Authentication con Email/Password.
- Firestore como base de datos.
- Layout SPA con TailwindCSS por CDN.
- Router por hash con protección RBAC.
- Roles iniciales: `admin`, `medico`, `operador`, `asesor`.
- Reglas iniciales de Firestore en `firestore.rules`.

## FASE 2

Incluye:

- Módulo `usuarios` separado de la UI global.
- Listado paginado de perfiles con máximo 10 documentos por carga.
- Creación/actualización de documentos `users/{uid}`.
- Edición de roles y activación/desactivación de perfiles.
- Administración disponible para roles con acceso total: `admin` y `medico`.
- El UID de Firebase Authentication se muestra como referencia no editable al modificar perfiles existentes.

## FASE 3

Incluye:

- Módulo `citas` separado de la UI global.
- Agenda diaria consultada por `dateKey`.
- Listado paginado de máximo 20 citas por carga.
- Creación y edición de citas.
- Selector de médicos desde la colección `doctors`.
- Registro básico de médicos con nombre, documento, tarjeta profesional, especialidad, contacto y estado.
- Página pública `agendar.html` para solicitudes externas en `publicAppointmentRequests`.
- Cambio rápido de estados: Programada, Confirmada, En Sala de Espera, Atendida, Cancelada.
- Acceso para roles `admin`, `medico` y `operador`.

## FASE 4

Incluye:

- Módulo `pacientes` separado de la UI global.
- Base de pacientes con tipo/número de documento, nombres, apellidos, contacto, ubicación, EPS, ocupación, grupo sanguíneo, contacto de emergencia y antecedentes.
- Listado paginado de máximo 15 pacientes por carga.
- Búsqueda puntual por número de documento.
- Historia clínica por subcolección `patients/{patientId}/clinicalRecords`.
- Historia clínica profesional con motivo, enfermedad actual, antecedentes, alergias, medicamentos actuales, signos vitales, examen físico, revisión por sistemas, diagnóstico, CIE-10, plan de manejo, prescripción, recomendaciones y seguimiento.
- Acceso protegido para roles `admin` y `medico`.

## FASE 5

Incluye:

- Módulo `inventario` separado de la UI global.
- CRUD de medicamentos homeopáticos con nombre, principio activo, registro sanitario, laboratorio, lote, vencimiento, potencia, presentación, concentración, almacenamiento, ubicación, proveedor, stock, costo, precio y stock mínimo.
- Alertas visuales de stock bajo.
- Movimientos de entrada, salida y ajuste positivo con auditoría.
- Listado paginado de máximo 15 medicamentos y 10 movimientos por carga.
- Acceso para `admin`, `medico` y `operador`.
- Escritura restringida a `admin`, `medico` y `operador`.

## FASE 6

Incluye:

- Módulo `facturacion` separado de la UI global.
- POS para facturar consultas médicas y venta de medicamentos.
- Asociación opcional de factura con paciente registrado desde `patients`.
- Registro en factura de `patientId`, documento y teléfono del cliente cuando aplica.
- Tipos de pago: Efectivo, Tarjeta y Transferencia.
- Descuento automático de inventario al facturar medicamentos.
- Registro de salida en `inventory/{medicineId}/movements` por cada medicamento vendido.
- Generación de ticket térmico básico de 80mm.
- Acceso protegido para roles `admin`, `medico` y `operador`.

## FASE 7

Incluye:

- Módulo `dashboard` separado de la UI global.
- KPIs de ingresos diarios y mensuales desde facturas recientes.
- Conteo de citas atendidas con consulta limitada.
- Medicamentos más vendidos desde los ítems de facturación recientes.
- Alertas de stock bajo desde inventario.
- Gráfico de ingresos de los últimos 7 días con Chart.js.
- Vista limitada para rol `asesor` enfocada en inventario/stock.

## Estructura

```text
src/
  app.js
  firebase/
    config.js
    auth.js
    db.js
  auth/
    login.ui.js
    roles.js
    session.js
  citas/
    citas.service.js
    citas.ui.js
    medicos.service.js
  dashboard/
    dashboard.service.js
    dashboard.ui.js
  facturacion/
    facturacion.service.js
    facturacion.ui.js
  inventario/
    inventario.service.js
    inventario.ui.js
  pacientes/
    pacientes.service.js
    pacientes.ui.js
  usuarios/
    usuarios.service.js
    usuarios.ui.js
  ui/
    layout.js
    router.js
    views.js
  styles/
    main.css
```

## Preparación en Firebase

1. Activa Authentication con proveedor Email/Password.
2. Crea manualmente el primer usuario desde Firebase Console.
3. Copia el `uid` generado en Authentication.
4. Crea manualmente el documento `users/{uid}` en Firestore con `email`, `displayName`, `role: "admin"` y `active: true`.
5. Publica las reglas de `firestore.rules` en Firestore Rules.
6. Inicia sesión en la app con ese usuario.

También puedes usar `iniciar.html` como herramienta de diagnóstico e inicialización para crear el perfil inicial y copiar reglas temporales/finales.

## Optimización Firestore Spark

- Usar `getDocs()` y consultas paginadas por defecto.
- Reservar `onSnapshot()` para pantallas que realmente necesiten tiempo real.
- Mantener documentos agregados para KPIs diarios/mensuales en fases posteriores.

## Índices Firestore

El módulo de citas consulta `appointments` por `dateKey` y ordena por `time`. También consulta `doctors` por `fullName`. Si Firestore solicita un índice compuesto, créalo desde el enlace automático que aparece en la consola del navegador o en Firebase Console.

El módulo de pacientes ordena `patients` por `fullName` y los registros clínicos por `createdAt` descendente dentro de cada paciente.

El módulo de inventario ordena `inventory` por `name` y los movimientos por `createdAt` descendente dentro de cada medicamento.

El módulo POS consulta `patients` por `fullName` para enlazar facturas a pacientes registrados.

## GitHub Pages

- El proyecto usa rutas relativas, por lo que puede publicarse desde GitHub Pages.
- La clave pública web de Firebase puede estar en el frontend; la protección real depende de `firestore.rules`.
- Agrega el dominio de GitHub Pages en Firebase Console, sección Authentication > Settings > Authorized domains.
- Si el repositorio se publica como `usuario.github.io/repositorio`, no uses rutas absolutas iniciadas en `/`.
- Para probar localmente, abre la app desde un servidor HTTP y no con `file://`.
- Consulta `DEPLOY.md` para el paso a paso de publicación y pruebas mínimas.
