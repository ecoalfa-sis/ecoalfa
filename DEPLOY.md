# Despliegue Ecoalfa en GitHub Pages

## 1. Preparar Firebase

1. En Firebase Authentication, activa Email/Password.
2. Crea el primer usuario administrador.
3. Copia el `uid` del usuario.
4. En Firestore crea `users/{uid}` con:

```js
{
  email: "admin@ecoalfa.com",
  displayName: "Administrador Ecoalfa",
  role: "admin",
  active: true
}
```

5. Publica el contenido de `firestore.rules` en Firestore Rules.
6. Publica el contenido de `database.rules.json` en Realtime Database Rules.
7. Agrega el dominio de GitHub Pages en Authentication > Settings > Authorized domains.

## 2. Subir a GitHub

1. Crea un repositorio en GitHub.
2. Sube todo el contenido de la carpeta `Ecoalfa`.
3. Verifica que existan `index.html` y `.nojekyll` en la raíz del repositorio.

## 3. Activar GitHub Pages

1. Entra al repositorio en GitHub.
2. Ve a Settings > Pages.
3. En Source selecciona Deploy from a branch.
4. Selecciona la rama `main` y carpeta `/root`.
5. Guarda y espera la URL pública.

## 4. Pruebas mínimas

- Login con usuario admin.
- Crear perfil de usuario por UID en Usuarios.
- Crear cita.
- Crear paciente e historia clínica.
- Crear medicamento.
- Facturar medicamento y verificar descuento de stock.
- Revisar dashboard.

## 5. Notas de Firestore Spark

- El sistema usa `getDocs()` y consultas limitadas por defecto.
- No usa listeners permanentes `onSnapshot()`.
- Si Firestore solicita índices compuestos, créalos desde el enlace automático de la consola.

## 6. Si el login no avanza en GitHub Pages

- Verifica que Email/Password esté habilitado en Firebase Authentication.
- Verifica que el usuario exista en Authentication y que estés usando la contraseña correcta.
- Agrega el dominio de GitHub Pages en Authentication > Settings > Authorized domains.
- Crea el documento `users/{uid}` en Firestore usando exactamente el UID del usuario autenticado.
- El documento debe tener un `role` válido: `admin`, `medico`, `operador` o `asesor`.
- El documento debe tener `active: true` como booleano, no como texto.
- Publica `firestore.rules` después de cambiar reglas.

## 7. Inicialización rápida con iniciar.html

`iniciar.html` es una herramienta temporal para crear datos de prueba y comprobar conexión con Firebase.

Flujo recomendado si Firestore está vacío:

1. Publica temporalmente `firestore.bootstrap.rules` en Firestore Rules.
2. Abre `iniciar.html` desde GitHub Pages.
3. Inicia sesión con el usuario creado en Firebase Authentication.
4. Haz clic en `Iniciar / Crear datos de prueba`.
5. Verifica los logs en pantalla y en la consola de Chrome.
6. Vuelve a publicar las reglas finales desde `firestore.rules`.
7. Entra al sistema desde `index.html`.

Desde `iniciar.html` puedes copiar las reglas temporales y finales, y abrir directamente Firebase Console. Por seguridad, una página HTML pública no puede publicar reglas automáticamente.

Importante: no dejes `firestore.bootstrap.rules` publicadas en producción. Solo sirven para arranque inicial y diagnóstico.
