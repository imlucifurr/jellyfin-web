import { getTvdbApiKey } from 'scripts/settings/webSettings';

type TvdbRecordType = 'movie' | 'series';
type TvdbCandidateType = 'new' | 'popular';

interface TvdbCandidate {
    title: string;
    year?: number;
    score?: number;
    recordType: TvdbRecordType;
    candidateType: TvdbCandidateType;
}

interface TvdbAuthResponse {
    data?: {
        token?: string;
    };
}

interface TvdbApiResponse<T> {
    data?: T[] | { items?: T[] };
}

interface TvdbBaseRecord {
    name?: string;
    title?: string;
    year?: string | number;
    score?: number;
}

interface TokenCacheEntry {
    token: string;
    expiresAt: number;
}

interface CandidatesCacheEntry {
    value: {
        newCandidates: TvdbCandidate[];
        popularCandidates: TvdbCandidate[];
    };
    expiresAt: number;
}

const TVDB_BASE_URL = 'https://api4.thetvdb.com/v4';
const TVDB_DEFAULT_LANG = 'eng';
const TVDB_DEFAULT_COUNTRY = 'usa';
const TOKEN_CACHE_MS = 1000 * 60 * 60 * 24 * 25;
const CANDIDATES_CACHE_MS = 1000 * 60 * 10;
const TVDB_REQUEST_TIMEOUT_MS = 4500;
const TVDB_LOGIN_TIMEOUT_MS = 6000;

let tokenCache: TokenCacheEntry | null = null;
let tokenPromise: Promise<string> | null = null;
const candidatesCache = new Map<number, CandidatesCacheEntry>();
let tvdbApiKeyPromise: Promise<string> | null = null;

async function resolveTvdbApiKey() {
    if (!tvdbApiKeyPromise) {
        tvdbApiKeyPromise = getTvdbApiKey();
    }

    const apiKey = await tvdbApiKeyPromise;
    if (!apiKey) {
        throw new Error('TVDB API key is missing in config.json (tvdbApiKey)');
    }

    return apiKey;
}

function toQueryString(query?: Record<string, string | number | undefined>) {
    if (!query) {
        return '';
    }

    const params = new URLSearchParams();
    Object.entries(query).forEach(([ key, value ]) => {
        if (value !== undefined) {
            params.set(key, String(value));
        }
    });

    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
}

async function requestTvdb<T>(
    path: string,
    init?: RequestInit,
    query?: Record<string, string | number | undefined>,
    token?: string,
    timeoutMs = TVDB_REQUEST_TIMEOUT_MS
) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(`${TVDB_BASE_URL}${path}${toQueryString(query)}`, {
            ...init,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(init?.headers ?? {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        });

        if (!response.ok) {
            throw new Error(`TVDB request failed (${response.status})`);
        }

        return response.json() as Promise<T>;
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            throw new Error(`TVDB request timed out (${path})`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function getTvdbToken() {
    if (tokenCache && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    if (tokenPromise) {
        return tokenPromise;
    }

    const apiKey = await resolveTvdbApiKey();

    tokenPromise = requestTvdb<TvdbAuthResponse>(
        '/login',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apikey: apiKey })
        },
        undefined,
        undefined,
        TVDB_LOGIN_TIMEOUT_MS
    ).then(response => {
        const token = response?.data?.token;
        if (!token) {
            throw new Error('TVDB auth token was not returned');
        }

        tokenCache = {
            token,
            expiresAt: Date.now() + TOKEN_CACHE_MS
        };

        return token;
    }).finally(() => {
        tokenPromise = null;
    });

    return tokenPromise;
}

function normalizeTvdbRecords(data: TvdbApiResponse<TvdbBaseRecord> | undefined) {
    if (!data?.data) {
        return [] as TvdbBaseRecord[];
    }

    if (Array.isArray(data.data)) {
        return data.data;
    }

    return data.data.items ?? [];
}

function mapToCandidates(
    records: TvdbBaseRecord[],
    recordType: TvdbRecordType,
    candidateType: TvdbCandidateType
) {
    return records
        .map((record): TvdbCandidate | null => {
            const title = (record.name ?? record.title ?? '').trim();
            if (!title) {
                return null;
            }

            const parsedYear = Number.parseInt(String(record.year ?? ''), 10);

            return {
                title,
                year: Number.isNaN(parsedYear) ? undefined : parsedYear,
                score: record.score,
                recordType,
                candidateType
            };
        })
        .filter((item): item is TvdbCandidate => Boolean(item));
}

async function fetchFilteredTitles(
    endpoint: '/movies/filter' | '/series/filter',
    recordType: TvdbRecordType,
    candidateType: TvdbCandidateType,
    sort: 'score' | 'firstAired',
    year?: number
) {
    const token = await getTvdbToken();

    const response = await requestTvdb<TvdbApiResponse<TvdbBaseRecord>>(
        endpoint,
        undefined,
        {
            lang: TVDB_DEFAULT_LANG,
            country: TVDB_DEFAULT_COUNTRY,
            sort,
            sortType: 'desc',
            year
        },
        token
    );

    return mapToCandidates(normalizeTvdbRecords(response), recordType, candidateType);
}

function dedupeCandidates(candidates: TvdbCandidate[]) {
    const seen = new Set<string>();
    const deduped: TvdbCandidate[] = [];

    for (const candidate of candidates) {
        const key = `${candidate.recordType}:${candidate.title.toLowerCase()}:${candidate.year ?? ''}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        deduped.push(candidate);
    }

    return deduped;
}

export async function getTvdbNewAndPopularCandidates(limit = 60) {
    const cached = candidatesCache.get(limit);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
    }

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const [
        newMoviesCurrentYear,
        newSeriesCurrentYear,
        newMoviesPreviousYear,
        newSeriesPreviousYear,
        popularMovies,
        popularSeries
    ] = await Promise.allSettled([
        fetchFilteredTitles('/movies/filter', 'movie', 'new', 'firstAired', currentYear),
        fetchFilteredTitles('/series/filter', 'series', 'new', 'firstAired', currentYear),
        fetchFilteredTitles('/movies/filter', 'movie', 'new', 'firstAired', previousYear),
        fetchFilteredTitles('/series/filter', 'series', 'new', 'firstAired', previousYear),
        fetchFilteredTitles('/movies/filter', 'movie', 'popular', 'score'),
        fetchFilteredTitles('/series/filter', 'series', 'popular', 'score')
    ]);

    const collect = (result: PromiseSettledResult<TvdbCandidate[]>) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }

        return [] as TvdbCandidate[];
    };

    const value = {
        newCandidates: dedupeCandidates([
            ...collect(newMoviesCurrentYear),
            ...collect(newSeriesCurrentYear),
            ...collect(newMoviesPreviousYear),
            ...collect(newSeriesPreviousYear)
        ]).slice(0, limit),
        popularCandidates: dedupeCandidates([ ...collect(popularMovies), ...collect(popularSeries) ]).slice(0, limit)
    };

    candidatesCache.set(limit, {
        value,
        expiresAt: Date.now() + CANDIDATES_CACHE_MS
    });

    return value;
}

export type { TvdbCandidate };