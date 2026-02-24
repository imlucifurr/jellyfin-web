import DefaultConfig from '../../config.json';
import fetchLocal from '../../utils/fetchLocal.ts';

let data;

async function getConfig() {
    if (data) return Promise.resolve(data);
    try {
        const response = await fetchLocal('config.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('network response was not ok');
        }

        data = await response.json();

        return data;
    } catch (error) {
        console.warn('failed to fetch the web config file:', error);
        data = DefaultConfig;
        return data;
    }
}

async function getLatestConfig() {
    try {
        const response = await fetchLocal('config.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('network response was not ok');
        }

        const latestData = await response.json();
        data = latestData;
        return latestData;
    } catch (error) {
        console.warn('failed to fetch latest web config file:', error);
        return getConfig();
    }
}

export function getIncludeCorsCredentials() {
    return getConfig()
        .then(config => !!config.includeCorsCredentials)
        .catch(error => {
            console.log('cannot get web config:', error);
            return false;
        });
}

export function getMultiServer() {
    // Enable multi-server support when served by webpack
    if (__WEBPACK_SERVE__) {
        return Promise.resolve(true);
    }

    return getConfig().then(config => {
        return !!config.multiserver;
    }).catch(error => {
        console.log('cannot get web config:', error);
        return false;
    });
}

export function getServers() {
    return getConfig().then(config => {
        const servers = Array.isArray(config.servers) ? config.servers : [];

        return servers.map(server => {
            if (typeof server === 'string') {
                return server;
            }

            if (!server || typeof server !== 'object') {
                return null;
            }

            return server.Url || server.url || server.Address || server.address || server.ManualAddress || null;
        }).filter(server => typeof server === 'string').map(server => server.trim()).filter(server => !!server);
    }).catch(error => {
        console.log('cannot get web config:', error);
        return [];
    });
}

const baseDefaultTheme = {
    'name': 'Dark',
    'id': 'dark',
    'default': true
};

let internalDefaultTheme = baseDefaultTheme;

const checkDefaultTheme = (themes) => {
    if (themes) {
        const defaultTheme = themes.find((theme) => theme.default);

        if (defaultTheme) {
            internalDefaultTheme = defaultTheme;
            return;
        }
    }

    internalDefaultTheme = baseDefaultTheme;
};

export function getThemes() {
    return getConfig().then(config => {
        if (!Array.isArray(config.themes)) {
            console.error('web config is invalid, missing themes:', config);
        }
        const themes = Array.isArray(config.themes) ? config.themes : DefaultConfig.themes;
        checkDefaultTheme(themes);
        return themes;
    }).catch(error => {
        console.log('cannot get web config:', error);
        checkDefaultTheme();
        return DefaultConfig.themes;
    });
}

export const getDefaultTheme = () => internalDefaultTheme;

export function getMenuLinks() {
    return getConfig().then(config => {
        if (!config.menuLinks) {
            console.error('web config is invalid, missing menuLinks:', config);
        }
        return config.menuLinks || [];
    }).catch(error => {
        console.log('cannot get web config:', error);
        return [];
    });
}

export function getPlugins() {
    return getConfig().then(config => {
        if (!config.plugins) {
            console.error('web config is invalid, missing plugins:', config);
        }
        return config.plugins || DefaultConfig.plugins;
    }).catch(error => {
        console.log('cannot get web config:', error);
        return DefaultConfig.plugins;
    });
}

export function getTvdbApiKey() {
    return getConfig().then(config => {
        if (typeof config.tvdbApiKey === 'string') {
            return config.tvdbApiKey.trim();
        }

        if (config.tvdb && typeof config.tvdb === 'object' && typeof config.tvdb.apiKey === 'string') {
            return config.tvdb.apiKey.trim();
        }

        return '';
    }).catch(error => {
        console.log('cannot get tvdb api key from web config:', error);
        return '';
    });
}

export function getMovieHeroItems() {
    return getLatestConfig().then(config => {
        if (Array.isArray(config)) {
            return config;
        }

        const lists = [
            config.movieHeroItems,
            config.movieHeroList,
            config.homeHero,
            config.heroMovies
        ];

        const heroItems = lists.find(Array.isArray);
        return heroItems || [];
    }).catch(error => {
        console.log('cannot get hero movie list from web config:', error);
        return [];
    });
}
