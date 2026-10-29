import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

function getExpoHostUri(): string | undefined {
  return Constants.expoConfig?.hostUri
    ?? Constants.manifest2?.extra?.expoClient?.hostUri
    ?? Constants.manifest?.debuggerHost;
}

function normalizeApiBaseUrl(candidate: string): string | undefined {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !['http:', 'https:'].includes(url.protocol)
    || hostname === 'localhost'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || /^127\./.test(hostname)
  ) {
    return undefined;
  }

  return url.toString().replace(/\/$/, '');
}

function getBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const environmentUrl = configuredUrl
    ? normalizeApiBaseUrl(configuredUrl)
    : undefined;
  if (environmentUrl) return environmentUrl;

  const hostUri = getExpoHostUri();
  if (hostUri) {
    const host = hostUri.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
    const hostname = host.startsWith('[')
      ? host.slice(1, host.indexOf(']'))
      : host.split(':')[0];
    const runtimeUrl = normalizeApiBaseUrl(`http://${hostname}:8080`);
    if (runtimeUrl) return runtimeUrl;
  }

  throw new Error(
    'API não configurada para rede local. Defina EXPO_PUBLIC_API_URL com uma URL acessível pelo dispositivo, como http://192.168.1.11:8080.',
  );
}

export const apiBaseUrl = getBaseUrl();

export const getApiAssetUrl = (assetPath?: string | null): string | undefined => {
  if (!assetPath) return undefined;
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, apiBaseUrl);
  }
  return `${apiBaseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
};

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  },
});
console.log('[API BaseURL Configurada]:', api.defaults.baseURL);

interface NativeFileUpload {
  uri: string;
  name: string;
  type: string;
}

interface AvatarUploadResponse {
  avatarUrl?: string;
  message?: string;
}

export async function uploadAvatarFile(file: NativeFileUpload | File) {
  const formData = new FormData();
  if ('uri' in file) {
    formData.append('file', file as unknown as Blob);
  } else {
    formData.append('file', file, file.name);
  }

  const token = await AsyncStorage.getItem('codewear_token');
  const response = await fetch(`${apiBaseUrl}/users/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  let result: AvatarUploadResponse;
  try {
    result = await response.json() as AvatarUploadResponse;
  } catch {
    throw new Error(`Resposta inválida do servidor de upload (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.message ?? `Falha no upload do avatar (HTTP ${response.status}).`);
  }
  if (!result.avatarUrl) {
    throw new Error('O servidor não retornou a URL do avatar.');
  }
  return result as Required<Pick<AvatarUploadResponse, 'avatarUrl'>>;
}

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('codewear_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Erro ao carregar token do AsyncStorage:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const failedUrl = error.config ? api.getUri(error.config) : undefined;
      console.error('[Axios Error]:', failedUrl, error.message);
    } else {
      console.error('[Axios Error]:', undefined, error);
    }
    return Promise.reject(error);
  },
);

export const saveAuthToken = (token: string) => AsyncStorage.setItem('codewear_token', token);
export const clearAuthToken = () => AsyncStorage.removeItem('codewear_token');

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.patch<{ message: string }>('users/change-password', { currentPassword, newPassword });
