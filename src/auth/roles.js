export const ROLES = {
  ADMIN: "admin",
  MEDICO: "medico",
  OPERADOR: "operador",
  ASESOR: "asesor"
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.MEDICO]: "Médico",
  [ROLES.OPERADOR]: "Operador/Recepcionista",
  [ROLES.ASESOR]: "Asesor"
};

export const ROUTE_PERMISSIONS = {
  dashboard: [ROLES.ADMIN, ROLES.MEDICO, ROLES.OPERADOR],
  citas: [ROLES.ADMIN, ROLES.MEDICO, ROLES.OPERADOR],
  pacientes: [ROLES.ADMIN, ROLES.MEDICO],
  inventario: [ROLES.ADMIN, ROLES.MEDICO, ROLES.OPERADOR],
  facturacion: [ROLES.ADMIN, ROLES.MEDICO, ROLES.OPERADOR],
  usuarios: [ROLES.ADMIN, ROLES.MEDICO]
};

export function canAccess(route, role) {
  return ROUTE_PERMISSIONS[route]?.includes(role) ?? false;
}
