export type ParsedTextPart =
  | { type: 'text'; content: string }
  | { type: 'path'; content: string; targetType: 'path' }
  | { type: 'url'; content: string; targetType: 'url' }
  | { type: 'outlook'; content: string; targetType: 'path' | 'url' };

export interface ResolvedDroppedLink {
  insertedText: string;
  type: 'path' | 'url' | 'outlook';
  target: string;
  targetType: 'path' | 'url';
}

export interface DroppedLinkResolutionError {
  error: string;
}

const URL_PATTERN = /(?:https?:\/\/|mailto:|ms-outlook:)[^\s<>"')\]]+/i;
const COMBINED_LINK_REGEX = /(https?:\/\/[^\s"<>]+|mailto:[^\s"<>]+|ms-outlook:[^\s"<>]+)|"([a-zA-Z]:[^"]+|\/[^"]+|\.\.?\/[^"]+|\\\\[^"]+)"|(?:[a-zA-Z]:\\(?:[^\s\\/:*?"<>|]+\\)*[^\s\\/:*?"<>|]+(?:\.[a-zA-Z0-9]+)?)|(?:\/(?:[^\s/]+\/)*[^\s/]+)|(?:\.\.?\/(?:[^\s/]+\/)*[^\s/]+)|(?:\\\\[^\s\\]+\\[^\s\\]+(?:\\[^\s\\]+)*)/g;
const SUPPORTED_DROP_TYPES = ['files', 'text/uri-list', 'url', 'uniformresourcelocator', 'text/plain', 'text/html'];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getDataTransferTypes(dataTransfer: Pick<DataTransfer, 'types'>): string[] {
  return Array.from(dataTransfer.types ?? []).map((type) => type.toLowerCase());
}

function getDataTransferValue(dataTransfer: Pick<DataTransfer, 'getData'>, type: string): string {
  try {
    return dataTransfer.getData(type)?.trim() ?? '';
  } catch {
    return '';
  }
}

function cleanUrlCandidate(value: string): string {
  return value.trim().replace(/[),.;]+$/, '');
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match ? cleanUrlCandidate(match[0]) : null;
}

function sanitizeDroppedLabel(label: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(label ?? '');
  if (!normalized) return null;
  return extractFirstUrl(normalized) === normalized ? null : normalized.slice(0, 200);
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function extractUriListUrl(uriList: string): string | null {
  const lines = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  for (const line of lines) {
    if (looksLikeUrl(line)) return cleanUrlCandidate(line);
  }

  return null;
}

function extractHtmlDropLabel(dataTransfer: Pick<DataTransfer, 'getData'>): string | null {
  const html = getDataTransferValue(dataTransfer, 'text/html');
  if (!html) return null;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return sanitizeDroppedLabel(doc.body.textContent);
  } catch {
    return null;
  }
}

function extractPlainTextDropLabel(
  dataTransfer: Pick<DataTransfer, 'getData'>,
  url: string | null,
): string | null {
  const plainText = getDataTransferValue(dataTransfer, 'text/plain');
  if (!plainText) return null;

  const lines = plainText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  for (const line of lines) {
    if (url && line === url) continue;
    if (extractFirstUrl(line) === line) continue;
    const label = sanitizeDroppedLabel(line);
    if (label) return label;
  }

  if (!url) return sanitizeDroppedLabel(plainText);

  const withoutUrl = normalizeWhitespace(plainText.replace(url, ''));
  return sanitizeDroppedLabel(withoutUrl);
}

function extractDroppedLabel(
  dataTransfer: Pick<DataTransfer, 'getData'>,
  file: File | null,
  url: string | null = null,
  fallbackLabel: string | null = null,
): string | null {
  return (
    extractHtmlDropLabel(dataTransfer) ??
    extractPlainTextDropLabel(dataTransfer, url) ??
    sanitizeDroppedLabel(file ? stripExtension(file.name) : null) ??
    sanitizeDroppedLabel(fallbackLabel)
  );
}

export function getDroppedFilePath(file: File): string {
  if (window.electronAPI?.getPathForFile) {
    return window.electronAPI.getPathForFile(file);
  }

  return (file as File & { path?: string }).path ?? '';
}

export function formatPathForInsertion(path: string): string {
  return path.includes(' ') ? `"${path}"` : path;
}

export function formatDroppedLinkInsertion(
  label: string | null | undefined,
  target: string,
  targetType: 'path' | 'url',
): string {
  const normalizedLabel = sanitizeDroppedLabel(label);
  const formattedTarget = targetType === 'path' ? formatPathForInsertion(target) : target;
  return normalizedLabel ? `${normalizedLabel} ${formattedTarget}` : formattedTarget;
}

export function insertDroppedText(
  currentValue: string,
  insertedText: string,
  options?: { start?: number; end?: number; separator?: string },
): string {
  const separator = options?.separator ?? '\n';
  const start = options?.start;
  const end = options?.end;

  if (typeof start === 'number' && typeof end === 'number') {
    const prefix = currentValue.slice(0, start);
    const needsSeparator = prefix.length > 0 && !prefix.endsWith(separator);
    return `${prefix}${needsSeparator ? separator : ''}${insertedText}${currentValue.slice(end)}`;
  }

  return currentValue ? `${currentValue}${separator}${insertedText}` : insertedText;
}

export function looksLikeUrl(value: string): boolean {
  const trimmed = cleanUrlCandidate(value);
  if (!trimmed) return false;

  if (trimmed.startsWith('mailto:') || trimmed.startsWith('ms-outlook:')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isOutlookUrl(value: string): boolean {
  const trimmed = cleanUrlCandidate(value).toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('ms-outlook:')) return true;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return host.includes('outlook.') || host.includes('office.com') || host.includes('office365.com');
  } catch {
    return false;
  }
}

export function isOutlookMsgPath(value: string): boolean {
  return value.trim().toLowerCase().endsWith('.msg');
}

export function hasSupportedLinkDropPayload(dataTransfer: Pick<DataTransfer, 'types' | 'files'>): boolean {
  const types = getDataTransferTypes(dataTransfer);
  if (types.some((type) => SUPPORTED_DROP_TYPES.includes(type))) return true;
  // Fallback : files peuplés (certains navigateurs / Electron)
  if ((dataTransfer.files?.length ?? 0) > 0) return true;
  // Electron : Outlook OLE ne remplit ni types ni files pendant dragover —
  // on accepte tous les drags pour laisser le drop handler tenter la résolution.
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) return true;
  return false;
}

export function getPathDisplayName(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '');
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function getUrlDisplayName(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'mailto:') {
      return parsed.pathname || 'mailto';
    }

    const host = parsed.host.replace(/^www\./, '');
    const suffix = parsed.pathname === '/' ? '' : parsed.pathname;
    const display = `${host}${suffix}`;
    return display.length > 50 ? `${display.slice(0, 50)}...` : display;
  } catch {
    return url.length > 50 ? `${url.slice(0, 50)}...` : url;
  }
}

export function getLinkedPartDisplayName(part: Exclude<ParsedTextPart, { type: 'text' }>): string {
  if (part.type === 'outlook') {
    return part.targetType === 'path' ? getPathDisplayName(part.content) : 'Outlook';
  }

  return part.type === 'path' ? getPathDisplayName(part.content) : getUrlDisplayName(part.content);
}

export function parseFilePaths(text: string): ParsedTextPart[] {
  const parts: ParsedTextPart[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMBINED_LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      const url = cleanUrlCandidate(match[1]);
      parts.push({
        type: isOutlookUrl(url) ? 'outlook' : 'url',
        content: url,
        targetType: 'url',
      });
    } else {
      const path = match[2] || match[0];
      const normalizedPath = path.trim();
      parts.push({
        type: isOutlookMsgPath(normalizedPath) ? 'outlook' : 'path',
        content: normalizedPath,
        targetType: 'path',
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

export async function resolveDroppedLinkFromDataTransfer(
  dataTransfer: Pick<DataTransfer, 'files' | 'getData'>,
  options?: { storagePath?: string | null },
): Promise<ResolvedDroppedLink | DroppedLinkResolutionError | null> {
  // Outlook drag propriétaire (multimaillistconversationrows) : pas de fichier accessible depuis le renderer
  // → ignorer silencieusement (les bytes OLE CF_FILECONTENTS ne sont pas accessibles sans bindings natifs)
  const types = Array.from((dataTransfer as DataTransfer).types ?? []);
  if (types.some(t => t === 'multimaillistconversationrows' || t.startsWith('multimaillist'))) {
    return null;
  }

  const file = dataTransfer.files?.[0] ?? null;
  const nativePath = file ? getDroppedFilePath(file) : '';

  if (nativePath) {
    return {
      insertedText: formatPathForInsertion(nativePath),
      type: isOutlookMsgPath(nativePath) ? 'outlook' : 'path',
      target: nativePath,
      targetType: 'path',
    };
  }

  const droppedUrl =
    extractUriListUrl(getDataTransferValue(dataTransfer, 'text/uri-list')) ??
    extractFirstUrl(getDataTransferValue(dataTransfer, 'UniformResourceLocator')) ??
    extractFirstUrl(getDataTransferValue(dataTransfer, 'URL')) ??
    extractFirstUrl(getDataTransferValue(dataTransfer, 'text/plain'));

  if (droppedUrl) {
    const label = extractDroppedLabel(dataTransfer, file, droppedUrl);
    return {
      insertedText: formatDroppedLinkInsertion(label, droppedUrl, 'url'),
      type: isOutlookUrl(droppedUrl) ? 'outlook' : 'url',
      target: droppedUrl,
      targetType: 'url',
    };
  }

  if (file?.name?.toLowerCase().endsWith('.msg')) {
    const storagePath = options?.storagePath;
    if (!storagePath) {
      return { error: "Impossible de sauvegarder l'email Outlook: dossier de stockage indisponible." };
    }

    if (!window.electronAPI?.isElectron || !window.electronAPI.outlook?.saveDroppedMail) {
      return { error: "La sauvegarde des emails Outlook n'est disponible qu'en mode Electron." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await window.electronAPI.outlook.saveDroppedMail(storagePath, file.name, bytes);
    if (!result.success || !result.path) {
      return { error: result.error || "Impossible de sauvegarder l'email Outlook deplace." };
    }

    const label = extractDroppedLabel(dataTransfer, file, null, 'Mail Outlook');
    return {
      insertedText: formatDroppedLinkInsertion(label, result.path, 'path'),
      type: 'outlook',
      target: result.path,
      targetType: 'path',
    };
  }

  return null;
}
