const SOUND_URL_CACHE = new Map<string, string>();

function normalizeSoundFileName(soundFile: string): string {
  return soundFile.replace(/^[\\/]+/, '').trim();
}

function buildRelativeSoundUrl(soundFile: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}sounds/${encodeURIComponent(soundFile)}`;
}

function buildAbsoluteSoundUrl(soundFile: string): string {
  return `/sounds/${encodeURIComponent(soundFile)}`;
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

async function resolveElectronSoundUrl(soundFile: string): Promise<string | null> {
  if (!window.electronAPI?.getSoundUrl) {
    return null;
  }

  try {
    const result = await window.electronAPI.getSoundUrl(soundFile);
    if (result.success && result.url) {
      return result.url;
    }
    return null;
  } catch {
    return null;
  }
}

function waitForAudioToLoad(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Audio load timeout'));
    }, 5000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      audio.removeEventListener('canplaythrough', onCanPlay);
      audio.removeEventListener('error', onError);
    };

    const onCanPlay = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Audio load failed (${audio.currentSrc})`));
    };

    audio.addEventListener('canplaythrough', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.load();
  });
}

export async function resolveSoundUrl(soundFile: string): Promise<string> {
  const normalizedFileName = normalizeSoundFileName(soundFile);
  if (!normalizedFileName) {
    throw new Error('Invalid sound file name');
  }

  const cachedUrl = SOUND_URL_CACHE.get(normalizedFileName);
  if (cachedUrl) {
    console.log('🔊 [SOUND] Using cached URL:', cachedUrl);
    return cachedUrl;
  }

  const electronUrl = await resolveElectronSoundUrl(normalizedFileName);
  console.log('🔊 [SOUND] Electron URL:', electronUrl);
  const resolvedUrl = electronUrl || buildRelativeSoundUrl(normalizedFileName);
  console.log('🔊 [SOUND] Resolved URL:', resolvedUrl);
  SOUND_URL_CACHE.set(normalizedFileName, resolvedUrl);

  return resolvedUrl;
}

export async function playSoundFile(soundFile: string): Promise<HTMLAudioElement> {
  const normalizedFileName = normalizeSoundFileName(soundFile);
  if (!normalizedFileName) {
    throw new Error('Invalid sound file name');
  }

  const primaryUrl = await resolveSoundUrl(normalizedFileName);
  const fallbackRelativeUrl = buildRelativeSoundUrl(normalizedFileName);
  const fallbackAbsoluteUrl = buildAbsoluteSoundUrl(normalizedFileName);
  const candidates = uniqueUrls([primaryUrl, fallbackRelativeUrl, fallbackAbsoluteUrl]);

  console.log('🔊 [SOUND] Trying candidates:', candidates);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    console.log('🔊 [SOUND] Trying:', candidate);
    const audio = new Audio(candidate);
    audio.preload = 'auto';

    try {
      await waitForAudioToLoad(audio);
      await audio.play();
      console.log('✅ [SOUND] Success with:', candidate);
      return audio;
    } catch (error) {
      console.log('❌ [SOUND] Failed:', candidate, error);
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unable to play sound file "${normalizedFileName}"`);
}
