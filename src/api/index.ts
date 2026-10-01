import { today } from '../lib/dates';
import { httpApi } from './http';
import { MOCK_TODAY, mockApi } from './mock';
import type { PrecisApi } from './types';

const baseUrl = import.meta.env.VITE_API_URL as string | undefined;

/** precis-backend when VITE_API_URL is set, otherwise the sample data. */
export const api: PrecisApi = baseUrl ? httpApi(baseUrl) : mockApi;
export const usingSampleData = !baseUrl;

/** The date the period presets count back from. */
export const referenceDate = baseUrl ? today() : MOCK_TODAY;

export type * from './types';
