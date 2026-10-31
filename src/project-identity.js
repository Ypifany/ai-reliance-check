const SAFE_PROJECT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;

export function canonicalProjectId(value) {
  const supplied = typeof value === 'string' ? value.trim() : '';
  if (!supplied) return '';
  if (SAFE_PROJECT_ID.test(supplied)) return supplied;
  let token = supplied
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/^[A-Za-z]/.test(token)) token = `project-${token || 'id'}`;
  return token.slice(0, 128);
}
