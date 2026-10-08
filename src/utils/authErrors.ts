type AuthFailure = { code?: string; status?: number; name?: string; message?: string };

function failureDetails(error: unknown): AuthFailure {
  return error && typeof error === 'object' ? error as AuthFailure : {};
}

export function isInvalidCredentials(error: unknown): boolean {
  const { code, message } = failureDetails(error);
  return code === 'invalid_credentials' || message === 'Invalid login credentials';
}

/** Business rejections belong in the form; don't confuse service failures with bad passwords. */
export function authErrorMessage(error: unknown): string {
  const { code, status, name } = failureDetails(error);
  if (isInvalidCredentials(error)) return 'Correo o contraseña incorrectos.';
  if (code === 'email_not_confirmed') return 'Tu correo aún no está confirmado. Contacta al administrador para habilitar tu acceso.';
  if (code === 'user_banned') return 'Tu cuenta no tiene acceso activo. Contacta al administrador.';
  if (status === 429 || code === 'over_request_rate_limit') return 'Se realizaron demasiados intentos. Espera unos minutos antes de volver a ingresar.';
  if (typeof status === 'number' && status >= 500) return 'El servicio de acceso no está disponible temporalmente. Inténtalo nuevamente en unos minutos.';
  if (name === 'AuthRetryableFetchError' || name === 'TypeError') return 'No se pudo conectar con el servicio de acceso. Revisa tu conexión e inténtalo nuevamente.';
  return 'No se pudo verificar el acceso. Inténtalo nuevamente.';
}
