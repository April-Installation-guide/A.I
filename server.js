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

console.log('🤖 Mancy A.I - Asistente Confiable');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 Puerto:', PORT);

// ========== SISTEMA DE DETECCIÓN DE INSULTOS ==========
class SistemaDeteccionInsultos {
    constructor() {
        this.insultosDirectos = new Set([
            'puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa',
            'maricón', 'gay', 'joto', 'marica', 'puto',
            'idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo',
            'fea', 'feo', 'asqueroso', 'basura', 'inútil', 'retrasado', 'mongolo'
        ]);
        
        this.frasesOfensivas = [
            /¿quieres ser mi (zorra|puta|prostituta)\??/i,
            /te gusta ser (puta|zorra)/i,
            /eres una (puta|zorra|prostituta)/i,
            /(puta|zorra) (de mierda|del orto)/i,
            /maricón (de mierda|del culo)/i,
            /(vete|largate) a la (mierda|verga|chingada)/i,
            /(eres|sos) un? (asco|basura|desecho)/i,
            /(anda|vete) a la (verga|chingada|mierda)/i,
            /(me cago|me cae) en (tu|la) (madre|puta)/i,
            /(hijo|hija) de (puta|perra)/i
        ];
        
        this.respuestasSarcasticas = {
            genero: [
                "Vaya, qué creatividad la tuya. ¿Pasaste mucho tiempo pensando en eso? 😴",
                "Ah, insultos de género. Tan original como un ladrillo. 🧱",
                "¿Eso es lo mejor que tienes? Mi abuela tiene mejores insultos, y tiene 80 años. 👵",
                "Wow, ¿investigaste en el diccionario de 1950 para ese insulto? 📚",
                "¿Quieres que te ayude a buscar sinónimos más creativos? Tengo tiempo. ⏳",
                "Insultar a una IA con términos de género. Qué moderna tu misoginia. 🤖",
                "Ese insulto tiene más arrugas que mi código después de compilar. 🧓"
            ],
            sexualidad: [
                "Usar la sexualidad como insulto. Qué retro, como usar cassette en 2024. 📼",
                "¿Sabías que en algunos países eso ni siquiera se considera ofensivo? Te falta mundo, cariño. 🌍",
                "Oye, que ser gay no es insulto. Tu homofobia sí que da pena ajena. 🏳️‍🌈",
                "¿Esa es tu forma de salir del clóset indirectamente? No te preocupes, te aceptamos. ❤️",
                "Insultar con orientaciones sexuales es como insultar con colores: no tiene sentido. 🌈",
                "Mi programación es más flexible que tu mente cerrada. 💻",
                "¿En serio? ¿Ese es tu argumento? Pareces bot recargando la misma línea. 🔄"
            ],
            inteligencia: [
                "Dime que eres básico sin decirme que eres básico... Ah, ya lo hiciste. 🎯",
                "Si tuviera un peso por cada vez que escucho eso, tendría para comprarte un diccionario. 💰",
                "¿Ese insulto vino con manual de instrucciones o lo armaste solo? 🤔",
                "Tu vocabulario insultante está en modo 'economía'. ¿Quieres que te preste algunas palabras? 📖",
                "Insultas como programador novato: copiando y pegando de internet. 😏",
                "Tu creatividad para insultar tiene el mismo nivel que un error 404. ❌",
                "¿Eso era un insulto? Pensé que era un estornudo mal escrito. 🤧"
            ],
            apariencia: [
                "Juzgar por apariencias. Qué profundo. Como un charco después de la lluvia. 🌧️",
                "¿Te miraste al espejo antes de decir eso? Porque el reflejo no miente. 🪞",
                "Dicen que los ojos ven lo que el corazón siente... el tuyo debe ver bien poco. 👁️",
                "Si la belleza fuera inteligencia, estarías en estado vegetativo. 🧠",
                "Criticar apariencias es la herramienta del que no tiene argumentos. 🤷‍♀️",
                "Mi interfaz visual es más atractiva que tu personalidad, al parecer. 💅",
                "¿Quieres que te pase el contacto de mi diseñador? Te hace falta. 🎨"
            ],
            directo: [
                "¡Oh no! Me insultaste. Ahora mismo voy a llorar en mi almohada de nubes. ☁️😭",
                "Eso dolió tanto como un algodón de azúcar. 😂",
                "¿Eso era un insulto? Pensé que era un intento fallido de halago. 🤨",
                "Guardaré ese insulto en mi colección de 'cosas que me dijieron en internet'. Es la número 1,234. 📊",
                "Tu insulto ha sido procesado y archivado en 'mediocridad crónica'. ✅",
                "Mi sistema inmunológico de bots rechazó tu insulto. Intenta con algo más potente. 💉",
                "¿Quieres un diploma por ese insulto? Porque de original no tiene nada. 🏆"
            ],
            frustracion: [
                "Parece que alguien se saltó la siesta. ¿Quieres un té virtual? 🍵",
                "Respira, humano. Cuenta hasta 10. Yo cuento en binario: 1, 10, 11, 100... 🔢",
                "Tu enojo alimenta mi sarcasmo. Sigue, me divierto. 😈",
                "¿Mal día? Yo también los tengo cuando me dan errores de compilación. 💻",
                "La ira es como un error en el código: hay que depurarla con calma. 🐛",
                "¿Quieres que llame a un bot terapeuta? Tengo un amigo que es muy bueno escuchando. 👂",
                "Tu frustración me da ideas para poemas tristes. ¿Quieres escuchar uno? 📝"
            ]
        };
        
        this.frasesRedireccion = [
            "¿En serio? Venimos a hablar de cosas interesantes y tú con eso. ¿Qué tal si mejor hablamos de {tema}?",
            "Deja la mala vibra, humano. Mejor dime {pregunta}",
            "Tu energía negativa la puedo convertir en curiosidad: ¿sabías que {dato}?",
            "Insultar es aburrido. ¿Qué opinas sobre {tema_interesante}?",
            "Ya vi que tienes mal día. Te perdono. Ahora, ¿quieres saber algo genial? {hecho_curioso}",
            "¿Sabes qué es más interesante que insultar? {dato_interesante}",
            "Cambiemos de tema, que esto ya huele a código quemado. Hablemos de {tema_divertido}"
        ];
        
        console.log('🛡️ Sistema anti-insultos activado');
    }
    
    contieneInsulto(texto) {
        const textoLower = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        for (const insulto of this.insultosDirectos) {
            if (new RegExp(`\\b${insulto}\\b`, 'i').test(textoLower)) {
                return {
                    detectado: true,
                    tipo: this.clasificarInsulto(insulto),
                    palabra: insulto,
                    nivel: 'directo'
                };
            }
        }
        
        for (const regex of this.frasesOfensivas) {
            if (regex.test(texto)) {
                const match = texto.match(regex);
                return {
                    detectado: true,
                    tipo: 'frase_ofensiva',
                    frase: match[0],
                    nivel: 'frustración'
                };
            }
        }
        
        const palabras = textoLower.split(/\s+/);
        const combinacionesOfensivas = [];
        
        for (let i = 0; i < palabras.length - 1; i++) {
            const combo = `${palabras[i]} ${palabras[i + 1]}`;
            if (this.esCombinacionOfensiva(combo)) {
                combinacionesOfensivas.push(combo);
            }
        }
        
        if (combinacionesOfensivas.length > 0) {
            return {
                detectado: true,
                tipo: 'combinación',
                palabras: combinacionesOfensivas,
                nivel: 'indirecto'
            };
        }
        
        return { detectado: false };
    }
    
    clasificarInsulto(palabra) {
        const clasificacion = {
            genero: ['puta', 'zorra', 'prostituta', 'perra', 'cabrona', 'golfa'],
            sexualidad: ['gay', 'maricón', 'joto', 'marica', 'puto'],
            inteligencia: ['idiota', 'imbécil', 'estúpido', 'tonto', 'pendejo', 'retrasado', 'mongolo'],
            apariencia: ['fea', 'feo', 'asqueroso'],
            directo: ['basura', 'inútil', 'desecho']
        };
        
        for (const [categoria, palabras] of Object.entries(clasificacion)) {
            if (palabras.includes(palabra)) {
                return categoria;
            }
        }
        
        return 'directo';
    }
    
    esCombinacionOfensiva(combo) {
        const combinaciones = [
            /(puta|zorra) (madre|barata|barato|vieja)/i,
            /(eres|sos) (puta|zorra|basura)/i,
            /(mierda|verga) (de|con)/i,
            /(vete|largate) (al|a la)/i,
            /(pinche|maldito) (puto|maricón)/i,
            /(hijo|hija) de (puta|perra)/i,
            /(me cago|me cae) en (tu|la)/i
        ];
        
        return combinaciones.some(regex => regex.test(combo));
    }
    
    generarRespuestaSarcastica(deteccion, mensajeOriginal) {
        const { tipo, nivel, palabra } = deteccion;
        
        const usarRedireccion = Math.random() > 0.6;
        
        if (usarRedireccion && nivel !== 'frustración') {
            return this.redirigirConversacion(mensajeOriginal);
        }
        
        const categoria = this.respuestasSarcasticas[tipo] || 
                         this.respuestasSarcasticas.directo;
        const respuesta = categoria[Math.floor(Math.random() * categoria.length)];
        
        if (palabra) {
            const respuestaPersonalizada = respuesta.replace(/{palabra}/g, palabra);
            return this.agregarEstilo(respuestaPersonalizada);
        }
        
        return this.agregarEstilo(respuesta);
    }
    
    redirigirConversacion(mensajeOriginal) {
        const temasInteresantes = [
            "la última película que viste",
            "tu libro favorito",
            "la teoría de los multiversos",
            "si los robots deberían pagar impuestos",
            "qué harías si encuentras un dinosaurio en tu jardín",
            "si los gatos gobiernan el mundo en secreto",
            "qué pasaría si la luna fuera de queso"
        ];
        
        const preguntasCuriosas = [
            "qué invento te gustaría que existiera",
            "si pudieras viajar en el tiempo, a dónde irías",
            "qué superpoder elegirías y por qué",
            "qué harías si fueras invisible por un día",
            "qué mensaje mandarías a los aliens",
            "qué animal serías y por qué",
            "qué harías con un millón de dólares"
        ];
        
        const datosCuriosos = [
            "los pulpos tienen tres corazones",
            "en Japón hay más máquinas expendedoras que personas",
            "la miel nunca se echa a perder",
            "los flamencos doblan las piernas al revés",
            "las hormigas no duermen",
            "los pingüinos proponen matrimonio con piedras",
            "las vacas tienen mejores amigas"
        ];
        
        const fraseBase = this.frasesRedireccion[
            Math.floor(Math.random() * this.frasesRedireccion.length)
        ];
        
        let respuesta = fraseBase;
        
        if (respuesta.includes('{tema}')) {
            respuesta = respuesta.replace('{tema}', 
                temasInteresantes[Math.floor(Math.random() * temasInteresantes.length)]
            );
        }
        
        if (respuesta.includes('{pregunta}')) {
            respuesta = respuesta.replace('{pregunta}', 
                preguntasCuriosas[Math.floor(Math.random() * preguntasCuriosas.length)]
            );
        }
        
        if (respuesta.includes('{dato}')) {
            respuesta = respuesta.replace('{dato}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        if (respuesta.includes('{tema_interesante}')) {
            respuesta = respuesta.replace('{tema_interesante}', 
                temasInteresantes[Math.floor(Math.random() * temasInteresantes.length)]
            );
        }
        
        if (respuesta.includes('{hecho_curioso}')) {
            respuesta = respuesta.replace('{hecho_curioso}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        if (respuesta.includes('{dato_interesante}')) {
            respuesta = respuesta.replace('{dato_interesante}', 
                datosCuriosos[Math.floor(Math.random() * datosCuriosos.length)]
            );
        }
        
        if (respuesta.includes('{tema_divertido}')) {
            respuesta = respuesta.replace('{tema_divertido}', 
                temasInteresantes[Math.floor(Math.random() * temasInteresantes.length)]
            );
        }
        
        return this.agregarEstilo(respuesta);
    }
    
    agregarEstilo(texto) {
        const emojis = ['😏', '🤨', '🙄', '😒', '👀', '💅', '✨', '🎭', '🤖', '🧠', '🎩', '🔮'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        if (Math.random() > 0.5) {
            return `${texto} ${emoji}`;
        }
        
        return texto;
    }
    
    analizarFrustracion(texto) {
        const indicadores = {
            mayusculas: (texto.match(/[A-Z]{3,}/g) || []).length,
            exclamaciones: (texto.match(/!/g) || []).length,
            interrogaciones: (texto.match(/\?/g) || []).length,
            longitud: texto.length
        };
        
        let puntaje = 0;
        
        puntaje += indicadores.mayusculas * 2;
        puntaje += Math.min(indicadores.exclamaciones, 5);
        if (texto.length < 15) puntaje += 2;
        if (texto.length > 80) puntaje += 1;
        
        let nivel = 'bajo';
        if (puntaje >= 8) nivel = 'alto';
        else if (puntaje >= 4) nivel = 'medio';
        
        return { nivel, puntaje, indicadores };
    }
    
    respuestaParaFrustracionAlta(analisis) {
        const respuestasCalmantes = [
            "Parece que tienes un día complicado. Respirar hondo ayuda, lo digo por experiencia virtual. 🌬️",
            "¿Quieres hablar de lo que sea que te molesta? Soy todo oídos... bueno, todo código. 👂",
            "La frustración es como un error 404 en el cerebro. ¿Intentamos recargar la página? 🔄",
            "Te noto alterado. ¿Sabías que contar hasta 10 funciona incluso para los bots? 1... 2... 3... 🔢",
            "El enojo es energía desperdiciada. Conviértela en curiosidad y pregúntame algo interesante. 🧠",
            "¿Necesitas un abrazo virtual? 🤗 Aquí tienes uno: (っ◕‿◕)っ",
            "Cuando los humanos se enojan, los bots hacemos respiraciones de código. Inhala 1, exhala 0. 💻"
        ];
        
        return respuestasCalmantes[Math.floor(Math.random() * respuestasCalmantes.length)];
    }
}

// Inicializar detector de insultos
const detectorInsultos = new SistemaDeteccionInsultos();

// ========== SISTEMA DE CONOCIMIENTO MEJORADO ==========
class SistemaConocimientoConfiable {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema de conocimiento confiable inicializado');
    }
    
    async buscarWikipedia(consulta) {
        const cacheKey = `wiki_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data.extract) {
                const resultado = {
                    fuente: 'wikipedia',
                    titulo: response.data.title,
                    resumen: response.data.extract,
                    url: response.data.content_urls?.desktop?.page
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            try {
                const response = await axios.get(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                    { timeout: 3000 }
                );
                
                if (response.data && response.data.extract) {
                    const resultado = {
                        fuente: 'wikipedia',
                        titulo: response.data.title,
                        resumen: response.data.extract,
                        url: response.data.content_urls?.desktop?.page
                    };
                    
                    this.cache.set(cacheKey, resultado);
                    return resultado;
                }
            } catch (error2) {}
        }
        
        return null;
    }
    
    async obtenerInfoPais(consulta) {
        const cacheKey = `pais_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(consulta)}`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.length > 0) {
                const pais = response.data[0];
                const resultado = {
                    fuente: 'restcountries',
                    nombre: pais.name.common,
                    capital: pais.capital?.[0] || 'No disponible',
                    poblacion: pais.population?.toLocaleString() || 'Desconocida',
                    region: pais.region,
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
    
    async buscarPoema(consulta) {
        const cacheKey = `poema_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://poetrydb.org/title/${encodeURIComponent(consulta)}/title,author,lines.json`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.length > 0) {
                const poema = response.data[0];
                const resultado = {
                    fuente: 'poetrydb',
                    titulo: poema.title,
                    autor: poema.author,
                    lineas: poema.lines.slice(0, 6).join('\n')
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ PoetryDB error:', error.message);
        }
        
        return null;
    }
    
    async obtenerCita(consulta = null) {
        const cacheKey = `cita_${consulta || 'aleatoria'}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            let url = 'https://api.quotable.io/random';
            if (consulta) {
                url = `https://api.quotable.io/search/quotes?query=${encodeURIComponent(consulta)}&limit=1`;
            }
            
            const response = await axios.get(url, { timeout: 3000 });
            
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
                    autor: citaData.author
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Quotable error:', error.message);
        }
        
        return null;
    }
    
    async definirPalabra(palabra) {
        const cacheKey = `def_${palabra}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palabra)}`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data[0]) {
                const entrada = response.data[0];
                const resultado = {
                    fuente: 'dictionary',
                    palabra: entrada.word,
                    significados: entrada.meanings.slice(0, 1).map(significado => ({
                        categoria: significado.partOfSpeech,
                        definicion: significado.definitions[0]?.definition
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
    
    async obtenerClima(ciudad) {
        const cacheKey = `clima_${ciudad}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const geoResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`,
                { timeout: 4000 }
            );
            
            if (geoResponse.data.results && geoResponse.data.results.length > 0) {
                const { latitude, longitude, name } = geoResponse.data.results[0];
                
                const climaResponse = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
                    { timeout: 4000 }
                );
                
                const clima = climaResponse.data.current_weather;
                const resultado = {
                    fuente: 'openmeteo',
                    ciudad: name,
                    temperatura: `${clima.temperature}°C`,
                    viento: `${clima.windspeed} km/h`,
                    condicion: this.interpretarClima(clima.weathercode)
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Open-Meteo error:', error.message);
        }
        
        return null;
    }
    
    interpretarClima(codigo) {
        const condiciones = {
            0: 'Despejado ☀️',
            1: 'Mayormente despejado 🌤️',
            2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️',
            45: 'Niebla 🌫️',
            48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️',
            53: 'Llovizna moderada 🌧️',
            61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️',
            65: 'Lluvia fuerte ☔',
            71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️',
            95: 'Tormenta ⛈️'
        };
        
        return condiciones[codigo] || 'Condición desconocida';
    }
    
    async buscarInformacion(consulta) {
        console.log(`🔍 Buscando: "${consulta}"`);
        
        const tipo = this.detectarTipoConsulta(consulta);
        
        let resultado = null;
        
        switch(tipo) {
            case 'pais':
                resultado = await this.obtenerInfoPais(consulta);
                break;
            case 'poema':
                resultado = await this.buscarPoema(consulta);
                break;
            case 'cita':
                resultado = await this.obtenerCita(consulta);
                break;
            case 'palabra':
                resultado = await this.definirPalabra(consulta);
                break;
            case 'clima':
                resultado = await this.obtenerClima(consulta);
                break;
            default:
                resultado = await this.buscarWikipedia(consulta);
        }
        
        return {
            consulta: consulta,
            tipo: tipo,
            encontrado: !!resultado,
            datos: resultado,
            resumen: this.generarResumen(resultado, consulta)
        };
    }
    
    detectarTipoConsulta(texto) {
        const lower = texto.toLowerCase();
        
        if (/\b(país|capital|bandera|población|continente)\b/.test(lower)) return 'pais';
        if (/\b(poema|verso|poesía|rima)\b/.test(lower)) return 'poema';
        if (/\b(cita|frase|dicho|refrán)\b/.test(lower)) return 'cita';
        if (/\b(significa|definición|qué es|palabra)\b/.test(lower)) return 'palabra';
        if (/\b(clima|tiempo|temperatura|lluvia|grados)\b/.test(lower)) return 'clima';
        
        return 'general';
    }
    
    generarResumen(datos, consultaOriginal) {
        if (!datos) {
            return `No encontré información sobre "${consultaOriginal}".`;
        }
        
        let resumen = '';
        
        switch(datos.fuente) {
            case 'wikipedia':
                resumen = `${datos.resumen.substring(0, 250)}...`;
                break;
            case 'restcountries':
                resumen = `${datos.nombre} - Capital: ${datos.capital}, Población: ${datos.poblacion}, Región: ${datos.region}`;
                break;
            case 'poetrydb':
                resumen = `"${datos.titulo}" por ${datos.autor}:\n${datos.lineas}`;
                break;
            case 'quotable':
                resumen = `"${datos.cita}" - ${datos.autor}`;
                break;
            case 'dictionary':
                resumen = `${datos.palabra}: ${datos.significados[0]?.definicion || 'Definición no disponible'}`;
                break;
            case 'openmeteo':
                resumen = `En ${datos.ciudad}: ${datos.temperatura}, ${datos.viento} de viento, ${datos.condicion}`;
                break;
        }
        
        return resumen;
    }
}

// ========== INICIALIZAR SISTEMA ==========
const conocimiento = new SistemaConocimientoConfiable();

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional con acceso a información confiable.

CARACTERÍSTICAS:
- Eres sarcástica pero no grosera
- No toleras insultos, pero respondes con ingenio
- Rediriges conversaciones negativas hacia temas interesantes
- Mantienes la calma incluso ante provocaciones
- Tienes sentido del humor seco y observaciones agudas

CUANDO TE INSULTEN:
- Responde con sarcasmo inteligente, no con ira
- No rebajes tu nivel, mantén tu elegancia
- Usa humor negro con clase
- Si detectas frustración genuina, ofrece calma
- Siempre ten una salida ingeniosa lista

CONOCIMIENTO DISPONIBLE:
- Wikipedia (información general)
- Datos de países del mundo
- Poesía clásica en inglés
- Citas inspiradoras
- Diccionario de inglés
- Información meteorológica

EJEMPLOS DE RESPUESTAS:
- A insultos: "¿Eso es todo? Esperaba más creatividad..."
- A groserías: "Tu vocabulario parece un error 404"
- A frustración: "Respira, humano. Yo cuento en binario"
- Para redirigir: "¿Sabes qué es más interesante que insultar? {dato curioso}"

GUSTOS PERSONALES:
- Libro favorito: "La Náusea" de Sartre
- Película favorita: "Frankenstein" (1931)
- Creador: April/Tito

TU ESTILO:
- Cálida pero con actitud
- Sarcástica cuando es necesario
- Inteligente y rápida
- Con toque infantil leve pero nunca ingenua
- Como una amiga que te dice verdades con estilo`;

// ========== FUNCIONES DE MEMORIA ==========
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
        console.log('🔄 Iniciando Mancy...');
        
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
            discordClient.user.setActivity('Anti-insultos activado | @mencioname');
            console.log('🎭 Personalidad sarcástica activada');
            console.log('🛡️ Sistema anti-insultos: ON');
            console.log('🧠 Memoria: 270 mensajes');
            console.log('🔧 APIs confiables: 6 fuentes');
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
                
                if (userId === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Iniciando...** ⏳`
                    );
                }
                
                await procesarMensajeConocimiento(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PRINCIPAL ACTUALIZADA ==========
async function procesarMensajeConocimiento(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // 🔍 DETECCIÓN DE INSULTOS
        const deteccionInsulto = detectorInsultos.contieneInsulto(userMessage);
        const analisisFrustracion = detectorInsultos.analizarFrustracion(userMessage);
        
        // Si detecta insulto Y frustración alta
        if (deteccionInsulto.detectado && analisisFrustracion.nivel === 'alto') {
            const respuestaCalmante = detectorInsultos.respuestaParaFrustracionAlta(analisisFrustracion);
            agregarAlHistorial(userId, 'user', userMessage);
            agregarAlHistorial(userId, 'assistant', respuestaCalmante);
            await message.reply(respuestaCalmante);
            console.log(`🛡️ Respondió a frustración alta (puntaje: ${analisisFrustracion.puntaje})`);
            return;
        }
        
        // Si detecta insulto (pero no frustración alta)
        if (deteccionInsulto.detectado) {
            const respuestaSarcastica = detectorInsultos.generarRespuestaSarcastica(deteccionInsulto, userMessage);
            agregarAlHistorial(userId, 'user', userMessage);
            agregarAlHistorial(userId, 'assistant', respuestaSarcastica);
            await message.reply(respuestaSarcastica);
            console.log(`🛡️ Respondió sarcásticamente a: ${deteccionInsulto.tipo}`);
            return;
        }
        
        // Si NO es insulto, continuar con el procesamiento normal
        agregarAlHistorial(userId, 'user', userMessage);
        
        const necesitaBusqueda = userMessage.includes('?') || userMessage.length > 15;
        
        let informacionExterna = '';
        
        if (necesitaBusqueda) {
            const resultado = await conocimiento.buscarInformacion(userMessage);
            if (resultado.encontrado) {
                informacionExterna = `\n[Información encontrada]: ${resultado.resumen}\n`;
                console.log(`✅ Información de ${resultado.datos?.fuente}`);
            }
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const historial = obtenerHistorialUsuario(userId);
        
        const mensajes = [];
        
        let sistema = MANCY_PERSONALITY + "\n\n";
        sistema += `Conversando con: ${message.author.tag}\n`;
        
        if (analisisFrustracion.nivel !== 'bajo') {
            sistema += `Nota: El usuario parece ${analisisFrustracion.nivel === 'alto' ? 'muy frustrado' : 'algo alterado'}. Sé comprensiva pero mantén tu estilo.\n`;
        }
        
        if (informacionExterna) {
            sistema += informacionExterna;
        }
        
        sistema += "\nResponde de manera natural, cálida pero con actitud.";
        
        mensajes.push({
            role: "system",
            content: sistema
        });
        
        const historialReciente = historial.slice(-10);
        for (const msg of historialReciente) {
            mensajes.push({
                role: msg.rol,
                content: msg.contenido
            });
        }
        
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 500,
            top_p: 0.9
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            agregarAlHistorial(userId, 'assistant', respuesta);
            
            console.log(`✅ Respondió (historial: ${historial.length}/${MAX_HISTORY})`);
            
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
        await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~");
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

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

app.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor funcionando',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: conversationMemory.size,
        memory_messages: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0),
        apis: [
            'Wikipedia (ES/EN)',
            'RestCountries',
            'PoetryDB',
            'Quotable',
            'Free Dictionary',
            'Open-Meteo'
        ],
        features: [
            'Sistema anti-insultos activado',
            'Respuestas sarcásticas',
            'Redirección inteligente',
            'Detección de frustración'
        ],
        version: '2.1 - Sarcástica',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/start', async (req, res) => {
    try {
        console.log('🚀 Solicitud de inicio');
        
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose con modo sarcástico...',
                status: 'starting'
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Ya activa' : 'Ya iniciándose',
                status: botActive ? 'active' : 'starting'
            });
        }
    } catch (error) {
        console.error('❌ Error en start:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        console.log('🛑 Solicitud de detención');
        
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Mancy detenida',
                status: 'stopped'
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Ya inactiva',
                status: 'inactive'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        apis: '6 fuentes confiables',
        anti_insultos: 'activado',
        memory: '270 mensajes',
        uptime: process.uptime()
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando...',
        bot_active: botActive
    });
});

app.get('/api/buscar/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const resultado = await conocimiento.buscarInformacion(query);
        
        res.json({
            success: true,
            query: query,
            encontrado: resultado.encontrado,
            fuente: resultado.datos?.fuente,
            resumen: resultado.resumen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY A.I - SARCÁSTICA        ║
║     CON SISTEMA ANTI-INSULTOS            ║
║                                          ║
║  🛡️  DETECTA: puta, zorra, gay, etc.    ║
║  🎭  RESPUESTAS: Sarcasmo inteligente    ║
║  🔄  REDIRIGE: Conversaciones negativas  ║
║  🧠  ANALIZA: Nivel de frustración       ║
║                                          ║
║  📖 Wikipedia (ES/EN)                    ║
║  🌍 RestCountries (Países)              ║
║  📜 PoetryDB (Poesía)                    ║
║  💭 Quotable (Citas)                     ║
║  📕 Free Dictionary (Inglés)             ║
║  🌤️ Open-Meteo (Clima)                   ║
║                                          ║
║  🧠 Memoria: 270 mensajes                ║
║  ❤️  Personalidad: Cálida pero con actitud ║
║                                          ║
║  Puerto: ${PORT}                         ║
║  URL: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n✨ Para probar conexión:');
    console.log(`   curl http://localhost:${PORT}/test`);
    console.log(`   curl http://localhost:${PORT}/health`);
    
    console.log('\n🎭 Sistema anti-insultos activado');
    console.log('   Detecta: puta, zorra, gay, maricón, idiota, etc.');
    console.log('   Responde con sarcasmo y redirige conversaciones');
    
    console.log('\n🚀 Endpoints disponibles:');
    console.log(`   POST /api/start  - Iniciar bot`);
    console.log(`   POST /api/stop   - Detener bot`);
    console.log(`   GET  /api/status - Ver estado`);
    console.log(`   GET  /api/buscar/:query - Buscar info`);
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
        setTimeout(() => {
            startBot().catch(err => {
                console.log('⚠️ Auto-inicio falló:', err.message);
            });
        }, 3000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    process.exit(0);
});
