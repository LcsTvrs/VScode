export const PASSWORD_CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function newPasswordChangeDeadline(now = Date.now()) {
  return new Date(now + PASSWORD_CHANGE_WINDOW_MS);
}

export function isPasswordChangeOverdue(session: { mustChangePassword: boolean; passwordChangeDeadline?: number | null }, now = Date.now()) {
  return session.mustChangePassword && (session.passwordChangeDeadline == null || session.passwordChangeDeadline <= now);
}
