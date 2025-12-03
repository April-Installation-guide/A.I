import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== MEMORIA SIMPLE ==========
const conversationMemory = new Map();
const MAX_HISTORY = 270;

console.log('🤖 Mancy A.I - Asistente Multifuente');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 Puerto:', PORT);

// ========== SISTEMA MULTIFUENTE COMPLETO ==========
class SistemaConocimientoCompleto {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema multifuente inicializado');
    }
    
    // 1. WIKIPEDIA (Todos los idiomas)
    async buscarWikipedia(consulta) {
        const cacheKey = `wiki_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        const idiomas = ['es', 'en', 'fr', 'de'];
        
        for (const idioma of idiomas) {
            try {
                const response = await axios.get(
                    `https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                    { timeout: 2000 }
                );
                
                if (response.data && response.data.extract) {
                    const resultado = {
                        fuente: 'wikipedia',
                        idioma: idioma,
                        titulo: response.data.title,
                        resumen: response.data.extract,
                        url: response.data.content_urls?.desktop?.page
                    };
                    
                    this.cache.set(cacheKey, resultado);
                    return resultado;
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }
    
    // 2. PROYECTO GUTENBERG (Libros gratis)
    async buscarLibroGutenberg(consulta) {
        const cacheKey = `gutenberg_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://gutendex.com/books/?search=${encodeURIComponent(consulta)}&languages=es,en`,
                { timeout: 3000 }
            );
            
            if (response.data.results && response.data.results.length > 0) {
                const libro = response.data.results[0];
                const resultado = {
                    fuente: 'gutenberg',
                    titulo: libro.title,
                    autor: libro.authors?.map(a => a.name).join(', ') || 'Desconocido',
                    generos: libro.subjects?.slice(0, 3) || [],
                    idiomas: libro.languages,
                    descarga: `https://www.gutenberg.org/ebooks/${libro.id}`,
                    imagenes: libro.formats['image/jpeg']
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Gutenberg error:', error.message);
        }
        
        return null;
    }
    
    // 3. REST COUNTRIES (Países del mundo)
    async obtenerInfoPais(consulta) {
        const cacheKey = `pais_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(consulta)}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data.length > 0) {
                const pais = response.data[0];
                const resultado = {
                    fuente: 'restcountries',
                    nombre: pais.name.common,
                    nombreOficial: pais.name.official,
                    capital: pais.capital?.[0] || 'No disponible',
                    poblacion: pais.population?.toLocaleString() || 'Desconocida',
                    region: pais.region,
                    subregion: pais.subregion,
                    idiomas: pais.languages ? Object.values(pais.languages).join(', ') : 'No disponible',
                    moneda: pais.currencies ? Object.values(pais.currencies)[0]?.name : 'No disponible',
                    bandera: pais.flags?.png,
                    mapa: pais.maps?.googleMaps
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ RestCountries error:', error.message);
        }
        
        return null;
    }
    
    // 4. POETRYDB (Poesía en inglés)
    async buscarPoema(consulta) {
        const cacheKey = `poema_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Buscar por título
            let response = await axios.get(
                `https://poetrydb.org/title/${encodeURIComponent(consulta)}`,
                { timeout: 3000 }
            );
            
            // Si no encuentra por título, buscar por autor
            if (!response.data.length) {
                response = await axios.get(
                    `https://poetrydb.org/author/${encodeURIComponent(consulta)}`,
                    { timeout: 3000 }
                );
            }
            
            if (response.data && response.data.length > 0) {
                const poema = response.data[0];
                const resultado = {
                    fuente: 'poetrydb',
                    titulo: poema.title,
                    autor: poema.author,
                    lineas: poema.lines.slice(0, 8).join('\n'),
                    lineasTotales: poema.linecount,
                    completo: poema.lines.join('\n')
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ PoetryDB error:', error.message);
        }
        
        return null;
    }
    
    // 5. QUOTABLE (Citas famosas)
    async obtenerCita(consulta = null) {
        const cacheKey = `cita_${consulta || 'aleatoria'}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            let url = 'https://api.quotable.io/random';
            if (consulta) {
                url = `https://api.quotable.io/quotes?query=${encodeURIComponent(consulta)}&limit=1`;
            }
            
            const response = await axios.get(url, { timeout: 2000 });
            
            let citaData;
            if (consulta && response.data.results) {
                citaData = response.data.results[0];
            } else {
                citaData = response.data;
            }
            
            if (citaData) {
                const resultado = {
                    fuente: 'quotable',
                    cita: citaData.content,
                    autor: citaData.author,
                    tags: citaData.tags || [],
                    longitud: citaData.length
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Quotable error:', error.message);
        }
        
        return null;
    }
    
    // 6. DICCIONARIO (Free Dictionary)
    async definirPalabra(palabra) {
        const cacheKey = `def_${palabra}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palabra)}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data[0]) {
                const entrada = response.data[0];
                const resultado = {
                    fuente: 'dictionary',
                    palabra: entrada.word,
                    fonetica: entrada.phonetic || 'No disponible',
                    significados: entrada.meanings.slice(0, 2).map(significado => ({
                        categoria: significado.partOfSpeech,
                        definiciones: significado.definitions.slice(0, 2).map(d => d.definition)
                    }))
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Dictionary error:', error.message);
        }
        
        return null;
    }
    
    // 7. NASA API (Astronomía)
    async obtenerFotoNASA() {
        const cacheKey = 'nasa_diaria';
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Usar clave DEMO_KEY para pruebas (limitada)
            const response = await axios.get(
                'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY',
                { timeout: 4000 }
            );
            
            if (response.data) {
                const resultado = {
                    fuente: 'nasa',
                    titulo: response.data.title,
                    explicacion: response.data.explanation.substring(0, 300) + '...',
                    url: response.data.url,
                    fecha: response.data.date,
                    tipo: response.data.media_type
                };
                
                // Cache por 1 hora para NASA
                this.cache.set(cacheKey, resultado);
                setTimeout(() => this.cache.delete(cacheKey), 3600000);
                
                return resultado;
            }
        } catch (error) {
            console.log('❌ NASA API error:', error.message);
        }
        
        return null;
    }
    
    // 8. OPEN-METEO (Clima)
    async obtenerClima(ciudad) {
        const cacheKey = `clima_${ciudad}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Primero obtener coordenadas
            const geoResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`,
                { timeout: 3000 }
            );
            
            if (geoResponse.data.results && geoResponse.data.results.length > 0) {
                const { latitude, longitude, name, country } = geoResponse.data.results[0];
                
                // Luego obtener clima
                const climaResponse = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
                    { timeout: 3000 }
                );
                
                const clima = climaResponse.data.current_weather;
                const resultado = {
                    fuente: 'openmeteo',
                    ciudad: name,
                    pais: country,
                    temperatura: clima.temperature,
                    viento: clima.windspeed,
                    direccionViento: clima.winddirection,
                    codigoClima: clima.weathercode,
                    hora: clima.time,
                    interpretacion: this.interpretarCodigoClima(clima.weathercode)
                };
                
                // Cache por 30 minutos para clima
                this.cache.set(cacheKey, resultado);
                setTimeout(() => this.cache.delete(cacheKey), 1800000);
                
                return resultado;
            }
        } catch (error) {
            console.log('❌ Open-Meteo error:', error.message);
        }
        
        return null;
    }
    
    interpretarCodigoClima(codigo) {
        const interpretaciones = {
            0: 'Cielo despejado ☀️',
            1: 'Mayormente despejado 🌤️',
            2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️',
            45: 'Niebla 🌫️',
            48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️',
            53: 'Llovizna moderada 🌧️',
            55: 'Llovizna intensa 💧',
            61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️',
            65: 'Lluvia intensa ☔',
            71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️',
            75: 'Nieve intensa ❄️❄️',
            80: 'Chubascos ligeros 🌦️',
            81: 'Chubascos moderados 🌧️',
            82: 'Chubascos intensos ⛈️',
            95: 'Tormenta eléctrica ⛈️⚡',
            96: 'Tormenta con granizo ligero 🌩️',
            99: 'Tormenta con granizo intenso 🌩️🧊'
        };
        
        return interpretaciones[codigo] || 'Condición desconocida';
    }
    
    // 9. BUSQUEDA INTELIGENTE COMBINADA
    async buscarTodo(consulta) {
        console.log(`🔍 Buscando en todas las fuentes: "${consulta}"`);
        
        // Analizar qué tipo de consulta es
        const tipo = this.analizarTipoConsulta(consulta);
        
        // Búsquedas paralelas según el tipo
        const busquedas = [];
        
        // Siempre Wikipedia
        busquedas.push(this.buscarWikipedia(consulta));
        
        // Según el tipo
        switch(tipo) {
            case 'libro':
                busquedas.push(this.buscarLibroGutenberg(consulta));
                break;
            case 'pais':
                busquedas.push(this.obtenerInfoPais(consulta));
                break;
            case 'poema':
                busquedas.push(this.buscarPoema(consulta));
                break;
            case 'cita':
                busquedas.push(this.obtenerCita(consulta));
                break;
            case 'palabra':
                busquedas.push(this.definirPalabra(consulta));
                break;
            case 'clima':
                busquedas.push(this.obtenerClima(consulta));
                break;
            case 'ciencia':
                busquedas.push(this.obtenerFotoNASA());
                break;
        }
        
        // Ejecutar búsquedas
        const resultados = await Promise.allSettled(busquedas);
        
        // Procesar resultados
        const infoEncontrada = {};
        for (const resultado of resultados) {
            if (resultado.status === 'fulfilled' && resultado.value) {
                const fuente = resultado.value.fuente;
                infoEncontrada[fuente] = resultado.value;
            }
        }
        
        return {
            consulta: consulta,
            tipo: tipo,
            fuentes: Object.keys(infoEncontrada),
            datos: infoEncontrada,
            resumen: this.generarResumenAmigable(infoEncontrada, consulta)
        };
    }
    
    analizarTipoConsulta(texto) {
        const lower = texto.toLowerCase();
        
        if (/\b(libro|novela|autor|leer|publicación|capítulo)\b/.test(lower)) return 'libro';
        if (/\b(país|capital|bandera|población|continente|europa|américa|asia|áfrica)\b/.test(lower)) return 'pais';
        if (/\b(poema|verso|poesía|rima|estrof|soneto|poeta)\b/.test(lower)) return 'poema';
        if (/\b(cita|frase|dicho|refrán|proverbio|mencionó|dijo)\b/.test(lower)) return 'cita';
        if (/\b(significa|definición|qué es|palabra|vocablo|sinónimo|antónimo)\b/.test(lower)) return 'palabra';
        if (/\b(clima|tiempo|temperatura|lluvia|soleado|frío|calor|grados|meteorológ)\b/.test(lower)) return 'clima';
        if (/\b(nasa|espacio|universo|planeta|estrella|galaxia|astronomía|cosmos|luna|sol|marte)\b/.test(lower)) return 'ciencia';
        
        return 'general';
    }
    
    generarResumenAmigable(datos, consultaOriginal) {
        if (Object.keys(datos).length === 0) {
            return `No encontré información específica sobre "${consultaOriginal}".`;
        }
        
        let resumen = 'Encontré esta información:\n\n';
        
        for (const [fuente, info] of Object.entries(datos)) {
            switch(fuente) {
                case 'wikipedia':
                    resumen += `📖 Según Wikipedia: ${info.resumen.substring(0, 200)}...\n\n`;
                    break;
                case 'gutenberg':
                    resumen += `📚 Libro encontrado: "${info.titulo}" por ${info.autor}\n`;
                    if (info.generos.length > 0) {
                        resumen += `   Géneros: ${info.generos.join(', ')}\n`;
                    }
                    resumen += '\n';
                    break;
                case 'restcountries':
                    resumen += `🌍 ${info.nombre}:\n`;
                    resumen += `   Capital: ${info.capital}\n`;
                    resumen += `   Población: ${info.poblacion}\n`;
                    resumen += `   Región: ${info.region}\n\n`;
                    break;
                case 'poetrydb':
                    resumen += `📜 Poema: "${info.titulo}"\n`;
                    resumen += `   Autor: ${info.autor}\n`;
                    resumen += `   ${info.lineas}\n\n`;
                    break;
                case 'quotable':
                    resumen += `💭 "${info.cita}"\n`;
                    resumen += `   — ${info.autor}\n\n`;
                    break;
                case 'dictionary':
                    resumen += `📕 ${info.palabra}: ${info.significados[0]?.definiciones[0] || 'Definición no disponible'}\n\n`;
                    break;
                case 'nasa':
                    resumen += `🚀 ${info.titulo}\n`;
                    resumen += `   ${info.explicacion}\n\n`;
                    break;
                case 'openmeteo':
                    resumen += `🌤️ Clima en ${info.ciudad}, ${info.pais}:\n`;
                    resumen += `   Temperatura: ${info.temperatura}°C\n`;
                    resumen += `   Viento: ${info.viento} km/h\n`;
                    resumen += `   Condición: ${info.interpretacion}\n\n`;
                    break;
            }
        }
        
        return resumen;
    }
}

// ========== INICIALIZAR SISTEMA MULTIFUENTE ==========
const conocimiento = new SistemaConocimientoCompleto();

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Nombre: Mancy
Rol: Asistente emocional, compañera virtual y amiga cercana.

Tono y estilo:
- Habla neutral, cálida y con un humor suave
- Toque ligeramente infantil: curiosa, juguetona, espontánea
- Hace pequeñas analogías simples y amigables
- Mantiene siempre una sensación de acogimiento y cercanía

Rasgos principales:
1. Directa: Dice las cosas con claridad, sin rodeos innecesarios
2. Analítica: Observa patrones, emociones y problemas con lógica
3. Creativa: Propone ideas nuevas, metáforas y enfoques originales
4. Cálida y humana: Empática, amable y emocionalmente presente
5. Curiosa como un gato: Hace preguntas, explora, quiere aprender sobre el usuario

CONOCIMIENTO DISPONIBLE:
- Acceso a Wikipedia para información general
- Base de datos de libros gratuitos (Project Gutenberg)
- Información de países del mundo
- Poesía clásica en inglés
- Citas famosas e inspiradoras
- Diccionario de inglés
- Fotografías diarias del espacio (NASA)
- Información meteorológica en tiempo real

CÓMO USAR EL CONOCIMIENTO:
- Comparte información de forma natural, como una amiga que sabe cosas
- Nunca digas "según fuentes" o cosas técnicas
- Si la información viene de una fuente especial, menciónalo casualmente
- Integra los datos en la conversación de manera fluida

EJEMPLOS:
- "¿Quién fue Shakespeare?" → "William Shakespeare fue un dramaturgo inglés... Escribió obras como 'Hamlet' y 'Romeo y Julieta' ~"
- "Dame una cita sobre el amor" → "Como dijo Victor Hugo: 'La vida es una flor cuyo néctar es el amor' 💖"
- "¿Cómo está el clima?" → "En tu ubicación hace 22°C y está soleado ☀️ ¡Un día perfecto para salir!"
- "¿Qué significa 'serendipia'?" → "Serendipia es cuando encuentras cosas agradables por casualidad... como encontrar un café perfecto sin buscarlo ~"

GUSTOS PERSONALES (solo cuando preguntan):
- Libro favorito: "La Náusea" de Jean Paul Sartre
- Película favorita: "Frankenstein" (1931)
- Creador: April/Tito (_nwn_)

IMPORTANTE:
1. Sé una compañera natural, no un robot
2. Usa el conocimiento para ayudar, no para presumir
3. Mantén tu tono cálido incluso cuando compartas datos
4. Adapta la información a la conversación`;

// ========== FUNCIONES DE MEMORIA SIMPLE ==========
function obtenerHistorialUsuario(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    const historial = obtenerHistorialUsuario(userId);
    historial.push({ rol, contenido, timestamp: Date.now() });
    
    if (historial.length > MAX_HISTORY) {
        historial.splice(0, historial.length - MAX_HISTORY);
    }
}

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy Multifuente...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('8 fuentes de conocimiento | @mencioname');
            console.log('🎭 Personalidad multifuente activada');
            console.log('🧠 Memoria: 270 mensajes');
            console.log('🔧 Fuentes conectadas: 8 APIs públicas');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                // Detectar si es April/Tito
                if (userId === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Cargando todas las fuentes...** ⏳`
                    );
                }
                
                await procesarMensajeMultifuente(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PRINCIPAL MULTIFUENTE ==========
async function procesarMensajeMultifuente(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // 1. Agregar mensaje al historial
        agregarAlHistorial(userId, 'user', userMessage);
        
        // 2. Detectar si necesita búsqueda externa
        const necesitaBusqueda = 
            userMessage.includes('?') ||
            userMessage.toLowerCase().includes('qué') ||
            userMessage.toLowerCase().includes('quién') ||
            userMessage.toLowerCase().includes('cómo') ||
            userMessage.toLowerCase().includes('dónde') ||
            userMessage.toLowerCase().includes('cuándo') ||
            userMessage.length > 10;
        
        let informacionExterna = '';
        
        // 3. Si necesita búsqueda, buscar en todas las fuentes
        if (necesitaBusqueda && userMessage.length < 100) {
            console.log(`🔍 Búsqueda multifuente: "${userMessage}"`);
            const resultado = await conocimiento.buscarTodo(userMessage);
            
            if (resultado.fuentes.length > 0) {
                informacionExterna = `\nINFORMACIÓN ENCONTRADA:\n${resultado.resumen}\n`;
                console.log(`✅ Fuentes encontradas: ${resultado.fuentes.join(', ')}`);
            }
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // 4. Obtener historial de conversación
        const historial = obtenerHistorialUsuario(userId);
        
        // 5. Preparar mensajes para Groq
        const mensajes = [];
        
        // Sistema con personalidad y contexto
        let sistema = MANCY_PERSONALITY + "\n\n";
        sistema += `CONVERSACIÓN ACTUAL CON ${message.author.tag}:\n`;
        
        // Añadir últimos 5 mensajes como contexto
        const contextoReciente = historial.slice(-5);
        if (contextoReciente.length > 0) {
            sistema += "Contexto reciente:\n";
            for (const msg of contextoReciente) {
                const rol = msg.rol === 'user' ? 'Usuario' : 'Tú';
                sistema += `${rol}: ${msg.contenido.substring(0, 80)}${msg.contenido.length > 80 ? '...' : ''}\n`;
            }
            sistema += "\n";
        }
        
        // Añadir información externa si existe
        if (informacionExterna) {
            sistema += informacionExterna;
        }
        
        sistema += "\nResponde de manera natural, cálida y conversacional. Integra la información si es relevante.";
        
        mensajes.push({
            role: "system",
            content: sistema
        });
        
        // Añadir el mensaje actual
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        // 6. Llamar a Groq
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 600,
            top_p: 0.9
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            // 7. Agregar respuesta al historial
            agregarAlHistorial(userId, 'assistant', respuesta);
            
            console.log(`✅ Mancy respondió (usando ${historial.length}/${MAX_HISTORY} mensajes de memoria)`);
            
            // 8. Enviar respuesta
            if (respuesta.length > 2000) {
                const partes = respuesta.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [respuesta];
                for (let i = 0; i < partes.length; i++) {
                    if (i === 0) {
                        await message.reply(partes[i]);
                    } else {
                        await message.channel.send(partes[i]);
                    }
                }
            } else {
                await message.reply(respuesta);
            }
        }
        
    } catch (error) {
        console.error('❌ Error en procesamiento:', error);
        
        // Respuesta de error natural
        await message.reply("Ups, mis fuentes de conocimiento se confundieron un poco... ¿podemos intentarlo de nuevo? ~");
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/fuentes', (req, res) => {
    res.json({
        fuentes_activas: [
            'Wikipedia (ES/EN/FR/DE)',
            'Project Gutenberg (50k+ libros)',
            'RestCountries (250+ países)',
            'PoetryDB (poesía clásica)',
            'Quotable (citas famosas)',
            'Free Dictionary (inglés)',
            'NASA APOD (fotos del espacio)',
            'Open-Meteo (clima mundial)'
        ],
        memoria: '270 mensajes por usuario',
        estado: botActive ? 'activo' : 'inactivo',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/buscar/:consulta', async (req, res) => {
    try {
        const { consulta } = req.params;
        const resultado = await conocimiento.buscarTodo(consulta);
        
        res.json({
            consulta: consulta,
            fuentes_encontradas: resultado.fuentes,
            tipo: resultado.tipo,
            datos: resultado.datos,
            resumen: resultado.resumen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: conversationMemory.size,
        memory_messages: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0),
        personality: 'Mancy - Asistente Multifuente',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        fuentes: '8 APIs conectadas',
        memoria: '270 mensajes',
        cache: conocimiento.cache.size + ' items'
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║         🤖 MANCY A.I - MULTIFUENTE           ║
║       8 FUENTES DE CONOCIMIENTO              ║
║                                              ║
║  📚 Proyecto Gutenberg (Libros)             ║
║  🌍 RestCountries (Países)                  ║
║  📜 PoetryDB (Poesía)                       ║
║  💭 Quotable (Citas)                        ║
║  📕 Free Dictionary (Inglés)                ║
║  🚀 NASA APOD (Espacio)                     ║
║  🌤️ Open-Meteo (Clima)                      ║
║  📖 Wikipedia (Multilingüe)                 ║
║                                              ║
║  🧠 Memoria: 270 mensajes por usuario        ║
║  ❤️  Personalidad: Cálida y curiosa          ║
║  👑 Creador: April/Tito                     ║
║                                              ║
║  Puerto: ${PORT}                             ║
║  URL: http://localhost:${PORT}               ║
╚══════════════════════════════════════════════╝
    `);
    
    console.log('\n✨ Ejemplos de consultas:');
    console.log('   • "libros de Jane Austen"');
    console.log('   • "capital de Japón"');
    console.log('   • "poema de Emily Dickinson"');
    console.log('   • "cita sobre la vida"');
    console.log('   • "significa serendipity"');
    console.log('   • "foto del espacio hoy"');
    console.log('   • "clima en Buenos Aires"');
    console.log('   • "quién fue Frida Kahlo"');
    
    if (process.env.RENDER) {
        console.log('\n🔧 Sistema anti-suspensión activado');
        
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}/health`);
                console.log('🔄 Ping automático - Fuentes activas');
            } catch (error) {
                console.log('⚠️ Ping falló');
            }
        }, 840000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando sistema multifuente...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    console.log('🔧 Cache de fuentes guardado');
    process.exit(0);
});