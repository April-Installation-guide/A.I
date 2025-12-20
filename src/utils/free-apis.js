import axios from 'axios';

const API_TIMEOUT = 8000; // Aumentado para conexiones más lentas
const CACHE_DURATION = 300000; // 5 minutos en caché

// Sistema de caché
const apiCache = new Map();

class FreeAPIs {
    constructor() {
        // Configuraciones específicas
        this.config = {
            retries: 2,
            fallbackEnabled: true,
            cacheEnabled: true,
            logLevel: 'info' // 'debug', 'info', 'error'
        };
        
        // APIs disponibles
        this.apis = {
            quotes: {
                name: 'Quotable',
                url: 'https://api.quotable.io',
                status: 'operational',
                free: true
            },
            wikipedia: {
                name: 'Wikipedia API',
                url: 'https://wikipedia.org',
                status: 'operational',
                free: true
            },
            weather: {
                name: 'Open-Meteo',
                url: 'https://open-meteo.com',
                status: 'operational',
                free: true
            },
            crypto: {
                name: 'CoinGecko',
                url: 'https://coingecko.com',
                status: 'operational',
                free: true
            },
            facts: {
                name: 'Useless Facts',
                url: 'https://uselessfacts.jsonfeed.org',
                status: 'operational',
                free: true
            },
            translate: {
                name: 'MyMemory',
                url: 'https://mymemory.translated.net',
                status: 'operational',
                free: true
            },
            countries: {
                name: 'REST Countries',
                url: 'https://restcountries.com',
                status: 'operational',
                free: true
            }
        };
        
        // Estadísticas
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            startTime: Date.now()
        };
        
        this.log('FreeAPIs inicializado', 'info');
    }
    
    /**
     * Sistema de logging
     */
    log(message, level = 'info') {
        if (level === 'debug' && this.config.logLevel !== 'debug') return;
        
        const timestamp = new Date().toISOString();
        const prefix = `[FreeAPIs ${level.toUpperCase()}]`;
        
        switch(level) {
            case 'error':
                console.error(`${timestamp} ${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${timestamp} ${prefix} ${message}`);
                break;
            case 'debug':
                console.debug(`${timestamp} ${prefix} ${message}`);
                break;
            default:
                console.log(`${timestamp} ${prefix} ${message}`);
        }
    }
    
    /**
     * Manejo de caché
     */
    getCache(key) {
        if (!this.config.cacheEnabled) return null;
        
        const cached = apiCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            this.stats.cacheHits++;
            this.log(`Cache hit: ${key}`, 'debug');
            return cached.data;
        }
        return null;
    }
    
    setCache(key, data) {
        if (!this.config.cacheEnabled) return;
        
        apiCache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Limpiar caché antiguo si hay más de 100 entradas
        if (apiCache.size > 100) {
            const oldestKey = Array.from(apiCache.keys())[0];
            apiCache.delete(oldestKey);
        }
    }
    
    clearCache() {
        apiCache.clear();
        this.log('Caché limpiado', 'info');
    }
    
    /**
     * Cliente HTTP con reintentos
     */
    async makeRequest(url, params = {}, method = 'GET', retries = this.config.retries) {
        this.stats.totalRequests++;
        
        try {
            const response = await axios({
                method,
                url,
                params,
                timeout: API_TIMEOUT,
                headers: {
                    'User-Agent': 'MancyBot-FreeAPIs/1.0',
                    'Accept': 'application/json'
                }
            });
            
            this.stats.successfulRequests++;
            return response;
        } catch (error) {
            this.stats.failedRequests++;
            
            if (retries > 0) {
                this.log(`Reintentando (${retries} restantes): ${error.message}`, 'warn');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.makeRequest(url, params, method, retries - 1);
            }
            
            throw error;
        }
    }
    
    /**
     * Obtiene una cita aleatoria
     */
    async getRandomQuote(category = null) {
        const cacheKey = `quote_${category || 'random'}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const params = category ? { tags: category } : {};
            const response = await this.makeRequest('https://api.quotable.io/random', params);
            
            const result = {
                success: true,
                quote: response.data.content,
                author: response.data.author,
                category: response.data.tags?.[0] || 'general',
                length: response.data.length
            };
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error obteniendo cita: ${error.message}`, 'error');
            
            // Fallback
            return this.config.fallbackEnabled ? {
                success: false,
                quote: "La práctica hace al maestro.",
                author: "Proverbio popular",
                category: "general",
                fallback: true
            } : {
                success: false,
                error: 'No se pudo obtener una cita'
            };
        }
    }
    
    /**
     * Busca en Wikipedia
     */
    async searchWikipedia(query, language = 'es') {
        const cacheKey = `wiki_${language}_${query}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const baseUrl = language === 'es' 
                ? 'https://es.wikipedia.org/w/api.php'
                : 'https://en.wikipedia.org/w/api.php';
            
            const response = await this.makeRequest(baseUrl, {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                srlimit: 5,
                srprop: 'snippet|timestamp',
                utf8: 1,
                origin: '*'
            });
            
            const results = response.data.query?.search || [];
            
            if (results.length === 0) {
                return {
                    success: false,
                    error: 'No se encontraron resultados'
                };
            }
            
            const formattedResults = results.map(r => ({
                title: r.title,
                snippet: r.snippet.replace(/<[^>]*>/g, ''),
                timestamp: r.timestamp,
                wordcount: r.wordcount,
                pageid: r.pageid
            }));
            
            const result = {
                success: true,
                query,
                language,
                results: formattedResults,
                totalResults: response.data.query.searchinfo.totalhits || 0
            };
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error buscando en Wikipedia: ${error.message}`, 'error');
            return {
                success: false,
                error: 'Error al consultar Wikipedia'
            };
        }
    }
    
    /**
     * Obtiene el clima
     */
    async getWeather(latitude, longitude) {
        const cacheKey = `weather_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await this.makeRequest('https://api.open-meteo.com/v1/forecast', {
                latitude,
                longitude,
                current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,is_day',
                hourly: 'temperature_2m,precipitation_probability',
                daily: 'temperature_2m_max,temperature_2m_min,weather_code',
                timezone: 'auto',
                forecast_days: 1
            });
            
            const current = response.data.current;
            const daily = response.data.daily;
            
            // Mapeo de códigos de clima
            const weatherCodes = {
                0: { description: 'Despejado', emoji: '☀️' },
                1: { description: 'Mayormente despejado', emoji: '🌤️' },
                2: { description: 'Parcialmente nublado', emoji: '⛅' },
                3: { description: 'Nublado', emoji: '☁️' },
                45: { description: 'Neblina', emoji: '🌫️' },
                48: { description: 'Neblina con escarcha', emoji: '🌫️' },
                51: { description: 'Llovizna ligera', emoji: '🌧️' },
                53: { description: 'Llovizna moderada', emoji: '🌧️' },
                55: { description: 'Llovizna densa', emoji: '🌧️' },
                61: { description: 'Lluvia ligera', emoji: '🌧️' },
                63: { description: 'Lluvia moderada', emoji: '🌧️' },
                65: { description: 'Lluvia fuerte', emoji: '⛈️' },
                71: { description: 'Nieve ligera', emoji: '❄️' },
                73: { description: 'Nieve moderada', emoji: '❄️' },
                75: { description: 'Nieve fuerte', emoji: '❄️' },
                80: { description: 'Chubascos ligeros', emoji: '🌧️' },
                81: { description: 'Chubascos moderados', emoji: '🌧️' },
                82: { description: 'Chubascos fuertes', emoji: '⛈️' },
                95: { description: 'Tormenta eléctrica', emoji: '⚡' },
                96: { description: 'Tormenta con granizo ligero', emoji: '⚡🌨️' },
                99: { description: 'Tormenta con granizo fuerte', emoji: '⚡🌨️' }
            };
            
            const weatherInfo = weatherCodes[current.weather_code] || 
                               { description: 'Condición desconocida', emoji: '❓' };
            
            const result = {
                success: true,
                location: { latitude, longitude },
                current: {
                    temperature: current.temperature_2m,
                    feels_like: current.temperature_2m, // Open-Meteo no tiene feels_like
                    weather: weatherInfo.description,
                    emoji: weatherInfo.emoji,
                    humidity: current.relative_humidity_2m,
                    wind_speed: current.wind_speed_10m,
                    wind_direction: current.wind_direction_10m,
                    is_day: current.is_day === 1
                },
                daily: {
                    max_temp: daily.temperature_2m_max?.[0],
                    min_temp: daily.temperature_2m_min?.[0],
                    weather_code: daily.weather_code?.[0]
                },
                timezone: response.data.timezone,
                units: response.data.current_units
            };
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error obteniendo clima: ${error.message}`, 'error');
            return {
                success: false,
                error: 'Error al obtener información del clima'
            };
        }
    }
    
    /**
     * Obtiene precio de criptomonedas
     */
    async getCryptoPrice(cryptoId = 'bitcoin', vsCurrencies = ['usd', 'eur']) {
        const cacheKey = `crypto_${cryptoId}_${vsCurrencies.join('_')}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await this.makeRequest('https://api.coingecko.com/api/v3/simple/price', {
                ids: cryptoId.toLowerCase(),
                vs_currencies: vsCurrencies.join(','),
                include_market_cap: true,
                include_24hr_vol: true,
                include_24hr_change: true,
                include_last_updated_at: true
            });
            
            const data = response.data[cryptoId.toLowerCase()];
            
            if (!data) {
                return {
                    success: false,
                    error: `Criptomoneda "${cryptoId}" no encontrada`
                };
            }
            
            const result = {
                success: true,
                crypto: cryptoId,
                prices: {},
                market_cap: data[`${vsCurrencies[0]}_market_cap`],
                volume_24h: data[`${vsCurrencies[0]}_24h_vol`],
                change_24h: data[`${vsCurrencies[0]}_24h_change`],
                last_updated: data.last_updated_at ? 
                    new Date(data.last_updated_at * 1000).toISOString() : null
            };
            
            // Formatear precios
            vsCurrencies.forEach(currency => {
                result.prices[currency.toUpperCase()] = data[currency];
            });
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error obteniendo precio crypto: ${error.message}`, 'error');
            return {
                success: false,
                error: 'Error al obtener precio de criptomoneda'
            };
        }
    }
    
    /**
     * Obtiene un dato curioso
     */
    async getRandomFact() {
        const cacheKey = 'random_fact';
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            // Try multiple fact APIs
            const apis = [
                'https://uselessfacts.jsph.pl/random.json?language=en',
                'https://uselessfacts.jsonfeed.org/feed.json'
            ];
            
            for (const api of apis) {
                try {
                    const response = await this.makeRequest(api);
                    
                    let fact;
                    if (api.includes('jsph.pl')) {
                        fact = response.data.text;
                    } else {
                        const facts = response.data.items || [];
                        fact = facts[Math.floor(Math.random() * facts.length)]?.summary;
                    }
                    
                    if (fact) {
                        const result = {
                            success: true,
                            fact,
                            source: api.includes('jsph.pl') ? 'uselessfacts.jsph.pl' : 'uselessfacts.jsonfeed.org'
                        };
                        
                        this.setCache(cacheKey, result);
                        return result;
                    }
                } catch (error) {
                    continue; // Try next API
                }
            }
            
            throw new Error('Todas las APIs de facts fallaron');
            
        } catch (error) {
            this.log(`Error obteniendo dato curioso: ${error.message}`, 'error');
            
            // Fallback facts
            const fallbackFacts = [
                "Los pulpos tienen tres corazones.",
                "Las abejas pueden reconocer rostros humanos.",
                "Los elefantes son los únicos mamíferos que no pueden saltar.",
                "El corazón de una ballena azul es tan grande que un humano podría nadar por sus arterias.",
                "Los pingüinos pueden saltar hasta 6 pies en el aire."
            ];
            
            return {
                success: true,
                fact: fallbackFacts[Math.floor(Math.random() * fallbackFacts.length)],
                fallback: true
            };
        }
    }
    
    /**
     * Traduce texto
     */
    async translate(text, targetLanguage = 'es', sourceLanguage = 'auto') {
        const cacheKey = `translate_${sourceLanguage}_${targetLanguage}_${text.substring(0, 20)}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await this.makeRequest('https://api.mymemory.translated.net/get', {
                q: text.substring(0, 500), // Limitar longitud
                langpair: `${sourceLanguage}|${targetLanguage}`
            });
            
            if (response.data.responseStatus !== 200) {
                throw new Error('API de traducción falló');
            }
            
            const result = {
                success: true,
                original: text,
                translated: response.data.responseData.translatedText,
                sourceLanguage: response.data.responseData.match || sourceLanguage,
                targetLanguage,
                match: response.data.responseData.match,
                credits: response.data.responseData.credits
            };
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error en traducción: ${error.message}`, 'error');
            return {
                success: false,
                error: 'Error al traducir'
            };
        }
    }
    
    /**
     * Obtiene información de un país
     */
    async getCountryInfo(countryCode) {
        const cacheKey = `country_${countryCode.toLowerCase()}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await this.makeRequest(`https://restcountries.com/v3.1/alpha/${countryCode}`);
            
            const country = response.data[0];
            
            const result = {
                success: true,
                name: {
                    common: country.name.common,
                    official: country.name.official,
                    native: country.name.nativeName
                },
                capital: country.capital?.[0] || 'N/A',
                region: country.region,
                subregion: country.subregion,
                population: country.population,
                area: country.area,
                languages: country.languages || {},
                currencies: country.currencies || {},
                flag: country.flag,
                maps: country.maps || {},
                timezones: country.timezones || [],
                continents: country.continents || []
            };
            
            this.setCache(cacheKey, result);
            return result;
            
        } catch (error) {
            this.log(`Error obteniendo info del país: ${error.message}`, 'error');
            
            // Intentar buscar por nombre si el código falla
            try {
                const searchResponse = await this.makeRequest(`https://restcountries.com/v3.1/name/${countryCode}`);
                if (searchResponse.data && searchResponse.data[0]) {
                    return this.getCountryInfo(searchResponse.data[0].cca2);
                }
            } catch (searchError) {
                // Ignorar error de búsqueda
            }
            
            return {
                success: false,
                error: 'País no encontrado'
            };
        }
    }
    
    /**
     * Obtiene información de todas las APIs
     */
    async getAllAPIs() {
        return {
            success: true,
            apis: this.apis,
            stats: this.getStats(),
            cache: {
                enabled: this.config.cacheEnabled,
                size: apiCache.size,
                duration: CACHE_DURATION / 60000 + ' minutos'
            }
        };
    }
    
    /**
     * Obtiene estadísticas
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const successRate = this.stats.totalRequests > 0 ? 
            (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1) : 0;
        const cacheHitRate = this.stats.totalRequests > 0 ? 
            (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(1) : 0;
        
        return {
            total_requests: this.stats.totalRequests,
            successful_requests: this.stats.successfulRequests,
            failed_requests: this.stats.failedRequests,
            cache_hits: this.stats.cacheHits,
            success_rate: `${successRate}%`,
            cache_hit_rate: `${cacheHitRate}%`,
            uptime: `${Math.floor(uptime / 1000)} segundos`,
            start_time: new Date(this.stats.startTime).toISOString(),
            config: {
                retries: this.config.retries,
                fallback_enabled: this.config.fallbackEnabled,
                cache_enabled: this.config.cacheEnabled
            }
        };
    }
    
    /**
     * Test de todas las APIs
     */
    async testAllAPIs() {
        const tests = [];
        
        // Test 1: Quotes
        tests.push({
            name: 'Quotes API',
            test: async () => {
                const result = await this.getRandomQuote();
                return {
                    success: result.success,
                    response_time: 'N/A',
                    data: result.quote ? '✓' : '✗'
                };
            }
        });
        
        // Test 2: Weather
        tests.push({
            name: 'Weather API',
            test: async () => {
                const result = await this.getWeather(40.4168, -3.7038); // Madrid
                return {
                    success: result.success,
                    data: result.current ? '✓' : '✗'
                };
            }
        });
        
        // Test 3: Crypto
        tests.push({
            name: 'Crypto API',
            test: async () => {
                const result = await this.getCryptoPrice('bitcoin');
                return {
                    success: result.success,
                    data: result.prices ? '✓' : '✗'
                };
            }
        });
        
        // Test 4: Wikipedia
        tests.push({
            name: 'Wikipedia API',
            test: async () => {
                const result = await this.searchWikipedia('artificial intelligence');
                return {
                    success: result.success,
                    data: result.results ? '✓' : '✗'
                };
            }
        });
        
        const results = [];
        for (const test of tests) {
            try {
                const start = Date.now();
                const result = await test.test();
                const responseTime = Date.now() - start;
                
                results.push({
                    name: test.name,
                    success: result.success,
                    response_time: `${responseTime}ms`,
                    data: result.data
                });
            } catch (error) {
                results.push({
                    name: test.name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            system: 'FreeAPIs Test Suite',
            timestamp: new Date().toISOString(),
            results,
            summary: {
                total: results.length,
                passed: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        };
    }
}

// Instancia global
const freeAPIs = new FreeAPIs();

// Exportar funciones individuales (backward compatibility)
export async function getRandomQuote(category = null) {
    return freeAPIs.getRandomQuote(category);
}

export async function searchWikipedia(query, language = 'es') {
    return freeAPIs.searchWikipedia(query, language);
}

export async function getWeather(latitude, longitude) {
    return freeAPIs.getWeather(latitude, longitude);
}

export async function getCryptoPrice(cryptoId = 'bitcoin', vsCurrencies = ['usd', 'eur']) {
    return freeAPIs.getCryptoPrice(cryptoId, vsCurrencies);
}

export async function getRandomFact() {
    return freeAPIs.getRandomFact();
}

export async function translate(text, targetLanguage = 'es', sourceLanguage = 'auto') {
    return freeAPIs.translate(text, targetLanguage, sourceLanguage);
}

export async function getCountryInfo(countryCode) {
    return freeAPIs.getCountryInfo(countryCode);
}

export async function getAllAPIs() {
    return freeAPIs.getAllAPIs();
}

export async function testAllAPIs() {
    return freeAPIs.testAllAPIs();
}

export function getStats() {
    return freeAPIs.getStats();
}

export function clearCache() {
    freeAPIs.clearCache();
}

// Exportar la clase también
export default freeAPIs;
