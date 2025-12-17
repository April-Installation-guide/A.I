import axios from 'axios';

const API_TIMEOUT = 5000;

/**
 * Obtiene una cita aleatoria de una API pública
 */
export async function getRandomQuote() {
    try {
        const response = await axios.get('https://api.quotable.io/random', {
            timeout: API_TIMEOUT
        });
        return {
            success: true,
            quote: response.data.content,
            author: response.data.author
        };
    } catch (error) {
        console.error('Error obteniendo cita:', error.message);
        return {
            success: false,
            error: 'No se pudo obtener una cita'
        };
    }
}

/**
 * Obtiene información de Wikipedia
 */
export async function searchWikipedia(query) {
    try {
        const response = await axios.get('https://es.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                format: 'json',
                srprop: 'snippet'
            },
            timeout: API_TIMEOUT
        });

        const results = response.data.query.search;
        if (results.length === 0) {
            return {
                success: false,
                error: 'No se encontraron resultados en Wikipedia'
            };
        }

        return {
            success: true,
            results: results.slice(0, 3).map(r => ({
                title: r.title,
                snippet: r.snippet.replace(/<[^>]*>/g, '')
            }))
        };
    } catch (error) {
        console.error('Error buscando en Wikipedia:', error.message);
        return {
            success: false,
            error: 'Error al consultar Wikipedia'
        };
    }
}

/**
 * Obtiene información del clima (usando Open-Meteo - sin API key)
 */
export async function getWeather(latitude, longitude) {
    try {
        const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude,
                longitude,
                current: 'temperature_2m,weather_code,wind_speed_10m',
                timezone: 'auto'
            },
            timeout: API_TIMEOUT
        });

        const current = response.data.current;
        const weatherCodes = {
            0: '☀️ Despejado',
            1: '🌤️ Mayormente despejado',
            2: '⛅ Parcialmente nublado',
            3: '☁️ Nublado',
            45: '🌫️ Neblina',
            48: '🌫️ Neblina con escarcha',
            51: '🌧️ Llovizna ligera',
            61: '🌧️ Lluvia',
            71: '❄️ Nieve',
            80: '🌧️ Lluvia fuerte'
        };

        return {
            success: true,
            temperature: current.temperature_2m,
            weather: weatherCodes[current.weather_code] || 'Condición desconocida',
            windSpeed: current.wind_speed_10m,
            timezone: response.data.timezone
        };
    } catch (error) {
        console.error('Error obteniendo clima:', error.message);
        return {
            success: false,
            error: 'Error al obtener información del clima'
        };
    }
}

/**
 * Obtiene datos de criptomonedas (usando CoinGecko - sin API key)
 */
export async function getCryptoPrice(cryptoId = 'bitcoin') {
    try {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price`,
            {
                params: {
                    ids: cryptoId.toLowerCase(),
                    vs_currencies: 'usd,eur',
                    include_market_cap: true,
                    include_24hr_change: true
                },
                timeout: API_TIMEOUT
            }
        );

        const data = response.data[cryptoId.toLowerCase()];
        if (!data) {
            return {
                success: false,
                error: `Criptomoneda "${cryptoId}" no encontrada`
            };
        }

        return {
            success: true,
            crypto: cryptoId,
            prices: {
                usd: data.usd,
                eur: data.eur
            },
            marketCap: data.usd_market_cap,
            change24h: data.usd_24h_change
        };
    } catch (error) {
        console.error('Error obteniendo precio crypto:', error.message);
        return {
            success: false,
            error: 'Error al obtener precio de criptomoneda'
        };
    }
}

/**
 * Obtiene un dato interesante aleatorio
 */
export async function getRandomFact() {
    try {
        const response = await axios.get('https://uselessfacts.jsonfeed.org/feed.json', {
            timeout: API_TIMEOUT
        });

        const facts = response.data.items;
        const randomFact = facts[Math.floor(Math.random() * facts.length)];

        return {
            success: true,
            fact: randomFact.summary
        };
    } catch (error) {
        console.error('Error obteniendo dato interesante:', error.message);
        return {
            success: false,
            error: 'No se pudo obtener un dato interesante'
        };
    }
}

/**
 * Obtiene traducciones (usando My Memory API - sin API key)
 */
export async function translate(text, targetLanguage = 'es') {
    try {
        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: text,
                langpair: `en|${targetLanguage}`
            },
            timeout: API_TIMEOUT
        });

        if (response.data.responseStatus !== 200) {
            return {
                success: false,
                error: 'Error en la traducción'
            };
        }

        return {
            success: true,
            original: text,
            translated: response.data.responseData.translatedText,
            targetLanguage
        };
    } catch (error) {
        console.error('Error en traducción:', error.message);
        return {
            success: false,
            error: 'Error al traducir'
        };
    }
}

/**
 * Obtiene información de un país
 */
export async function getCountryInfo(countryCode) {
    try {
        const response = await axios.get(
            `https://restcountries.com/v3.1/alpha/${countryCode}`,
            { timeout: API_TIMEOUT }
        );

        const country = response.data[0];

        return {
            success: true,
            name: country.name.common,
            capital: country.capital?.[0] || 'N/A',
            region: country.region,
            population: country.population,
            area: country.area,
            languages: country.languages || {},
            currencies: country.currencies || {},
            flag: country.flag
        };
    } catch (error) {
        console.error('Error obteniendo info del país:', error.message);
        return {
            success: false,
            error: 'País no encontrado'
        };
    }
          }
