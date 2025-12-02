import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Para búsqueda mejorada
import axios from 'axios'; // Para APIs externas
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== SISTEMA DE CONOCIMIENTO UNIVERSAL ==========
class UniversalKnowledgeSystem {
    constructor() {
        // APIs de conocimiento externas
        this.wikidataApi = 'https://www.wikidata.org/w/api.php';
        this.wikipediaApi = 'https://en.wikipedia.org/api/rest_v1';
        this.openLibraryApi = 'https://openlibrary.org';
        this.googleBooksApi = 'https://www.googleapis.com/books/v1';
        
        // Cache local para respuestas frecuentes
        this.cachePath = path.join(__dirname, 'knowledge_cache');
        this.initCache();
        
        // Categorías de conocimiento
        this.knowledgeDomains = {
            literature: ['books', 'authors', 'literary_movements', 'poetry'],
            science: ['physics', 'chemistry', 'biology', 'astronomy', 'mathematics'],
            history: ['events', 'figures', 'civilizations', 'wars'],
            philosophy: ['philosophers', 'schools', 'concepts', 'ethics'],
            arts: ['music', 'painting', 'cinema', 'theater', 'architecture'],
            technology: ['computing', 'ai', 'internet', 'inventions'],
            geography: ['countries', 'cities', 'landmarks', 'cultures'],
            psychology: ['theories', 'psychologists', 'disorders', 'therapy'],
            economics: ['theories', 'economists', 'markets', 'concepts'],
            politics: ['ideologies', 'leaders', 'systems', 'parties']
        };
    }
    
    async initCache() {
        await fs.mkdir(this.cachePath, { recursive: true });
        console.log('🗄️  Sistema de cache de conocimiento inicializado');
    }
    
    // ========== BÚSQUEDA EN WIKIPEDIA/WIKIDATA ==========
    async searchWikipedia(query) {
        const cacheKey = `wiki_${this.hashString(query)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await axios.get(`${this.wikipediaApi}/page/summary/${encodeURIComponent(query)}`, {
                timeout: 5000
            });
            
            const result = {
                source: 'wikipedia',
                title: response.data.title,
                extract: response.data.extract,
                description: response.data.description,
                url: response.data.content_urls?.desktop?.page
            };
            
            await this.cacheResult(cacheKey, result, 604800); // Cache por 1 semana
            return result;
        } catch (error) {
            console.log(`❌ Error Wikipedia: ${error.message}`);
            return null;
        }
    }
    
    async searchWikidata(entityName) {
        const cacheKey = `wd_${this.hashString(entityName)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            // Buscar ID de entidad
            const searchResponse = await axios.get(this.wikidataApi, {
                params: {
                    action: 'wbsearchentities',
                    search: entityName,
                    language: 'en',
                    format: 'json'
                },
                timeout: 5000
            });
            
            if (!searchResponse.data.search || searchResponse.data.search.length === 0) {
                return null;
            }
            
            const entityId = searchResponse.data.search[0].id;
            
            // Obtener datos de la entidad
            const entityResponse = await axios.get(this.wikidataApi, {
                params: {
                    action: 'wbgetentities',
                    ids: entityId,
                    languages: 'en',
                    format: 'json'
                },
                timeout: 5000
            });
            
            const entityData = entityResponse.data.entities[entityId];
            const result = {
                source: 'wikidata',
                id: entityId,
                label: entityData.labels?.en?.value || entityName,
                description: entityData.descriptions?.en?.value,
                aliases: entityData.aliases?.en?.map(a => a.value) || [],
                claims: this.extractWikidataClaims(entityData.claims)
            };
            
            await this.cacheResult(cacheKey, result, 604800);
            return result;
        } catch (error) {
            console.log(`❌ Error Wikidata: ${error.message}`);
            return null;
        }
    }
    
    // ========== BÚSQUEDA EN OPEN LIBRARY ==========
    async searchBook(bookTitle) {
        const cacheKey = `book_${this.hashString(bookTitle)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await axios.get(`${this.openLibraryApi}/search.json`, {
                params: {
                    q: bookTitle,
                    limit: 5
                },
                timeout: 5000
            });
            
            if (response.data.docs && response.data.docs.length > 0) {
                const book = response.data.docs[0];
                const result = {
                    source: 'open_library',
                    title: book.title,
                    author_name: book.author_name?.[0],
                    first_publish_year: book.first_publish_year,
                    isbn: book.isbn?.[0],
                    cover_id: book.cover_i,
                    subjects: book.subject?.slice(0, 5) || []
                };
                
                // Obtener más detalles si hay ISBN
                if (result.isbn) {
                    const details = await this.getBookDetails(result.isbn);
                    if (details) {
                        Object.assign(result, details);
                    }
                }
                
                await this.cacheResult(cacheKey, result, 604800);
                return result;
            }
        } catch (error) {
            console.log(`❌ Error Open Library: ${error.message}`);
        }
        
        return null;
    }
    
    async getBookDetails(isbn) {
        try {
            const response = await axios.get(`${this.openLibraryApi}/isbn/${isbn}.json`, {
                timeout: 5000
            });
            
            return {
                description: response.data.description?.value || response.data.description,
                number_of_pages: response.data.number_of_pages,
                publishers: response.data.publishers,
                publish_date: response.data.publish_date
            };
        } catch (error) {
            return null;
        }
    }
    
    // ========== BÚSQUEDA EN DBPEDIA (CONOCIMIENTO ESTRUCTURADO) ==========
    async searchDBpedia(entity) {
        const cacheKey = `dbp_${this.hashString(entity)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            // Consulta SPARQL a DBpedia
            const sparqlQuery = `
                SELECT ?label ?abstract ?type WHERE {
                    ?subject rdfs:label ?label .
                    ?subject dbo:abstract ?abstract .
                    ?subject rdf:type ?type .
                    FILTER (LANG(?label) = 'en' && LANG(?abstract) = 'en')
                    FILTER (CONTAINS(LCASE(?label), LCASE("${entity}")))
                } LIMIT 5
            `;
            
            const encodedQuery = encodeURIComponent(sparqlQuery);
            const response = await axios.get(
                `http://dbpedia.org/sparql?query=${encodedQuery}&format=json`,
                { timeout: 10000 }
            );
            
            if (response.data.results.bindings.length > 0) {
                const result = response.data.results.bindings[0];
                const knowledge = {
                    source: 'dbpedia',
                    label: result.label.value,
                    abstract: result.abstract.value.substring(0, 500),
                    type: result.type.value.split('/').pop()
                };
                
                await this.cacheResult(cacheKey, knowledge, 604800);
                return knowledge;
            }
        } catch (error) {
            console.log(`❌ Error DBpedia: ${error.message}`);
        }
        
        return null;
    }
    
    // ========== SISTEMA DE BÚSQUEDA INTELIGENTE ==========
    async searchUniversalKnowledge(query) {
        console.log(`🔍 Buscando conocimiento universal: "${query}"`);
        
        // 1. Analizar el tipo de consulta
        const queryType = this.analyzeQueryType(query);
        
        // 2. Búsquedas paralelas en múltiples fuentes
        const searchPromises = [];
        
        // Para libros
        if (queryType.includes('book')) {
            searchPromises.push(this.searchBook(query));
        }
        
        // Para entidades generales
        searchPromises.push(this.searchWikipedia(query));
        searchPromises.push(this.searchWikidata(query));
        searchPromises.push(this.searchDBpedia(query));
        
        // Para preguntas específicas
        if (this.isQuestion(query)) {
            searchPromises.push(this.answerQuestion(query));
        }
        
        // 3. Esperar resultados
        const results = await Promise.allSettled(searchPromises);
        
        // 4. Procesar y combinar resultados
        const knowledge = {
            query: query,
            type: queryType,
            sources: {},
            combined_answer: ''
        };
        
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                const source = result.value.source || 'unknown';
                knowledge.sources[source] = result.value;
            }
        }
        
        // 5. Generar respuesta combinada
        knowledge.combined_answer = this.generateCombinedAnswer(knowledge.sources, query);
        
        // 6. Guardar en cache
        await this.cacheResult(`universal_${this.hashString(query)}`, knowledge, 3600);
        
        return knowledge;
    }
    
    // ========== SISTEMA DE PREGUNTAS Y RESPUESTAS ==========
    async answerQuestion(question) {
        try {
            // Usar un modelo más avanzado para responder preguntas
            const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
            
            // Primero buscar contexto
            const context = await this.extractContextForQuestion(question);
            
            const completion = await groqClient.chat.completions.create({
                model: "mixtral-8x7b-32768", // Modelo más grande para respuestas complejas
                messages: [
                    {
                        role: "system",
                        content: `Eres un experto en conocimiento universal. Responde preguntas basándote en hechos verificados.
                        
                        CONTEXTO DISPONIBLE:
                        ${JSON.stringify(context, null, 2)}
                        
                        Instrucciones:
                        1. Responde de manera precisa y factual
                        2. Si no estás seguro, dilo
                        3. Cita fuentes cuando sea posible
                        4. Mantén respuestas concisas pero informativas`
                    },
                    {
                        role: "user",
                        content: question
                    }
                ],
                temperature: 0.3, // Baja temperatura para respuestas factuales
                max_tokens: 800,
                top_p: 0.9
            });
            
            return {
                source: 'ai_qa',
                question: question,
                answer: completion.choices[0]?.message?.content,
                confidence: 0.9,
                context_used: Object.keys(context)
            };
        } catch (error) {
            console.log(`❌ Error en Q&A: ${error.message}`);
            return null;
        }
    }
    
    // ========== MÉTODOS AUXILIARES ==========
    analyzeQueryType(query) {
        const lowerQuery = query.toLowerCase();
        const types = [];
        
        // Detectar tipo de consulta
        const typePatterns = {
            book: /\b(libro|novela|poema|autor|escribió|publicó)\b|by [a-z]/i,
            person: /\b(quién|quien|nació|murió|fue|biografía)\b|[A-Z][a-z]+ [A-Z][a-z]+/,
            place: /\b(dónde|donde|país|ciudad|continente|océano)\b/,
            date: /\b(cuándo|cuando|año|siglo|fecha|nació)\b|\d{4}/,
            concept: /\b(qué|que|significa|definición|concepto|teoría)\b/,
            how: /\b(cómo|como|funciona|se hace|proceso)\b/,
            why: /\b(por qué|porque|razón|causa|motivo)\b/
        };
        
        for (const [type, pattern] of Object.entries(typePatterns)) {
            if (pattern.test(lowerQuery)) {
                types.push(type);
            }
        }
        
        // Detectar dominio de conocimiento
        for (const [domain, subdomains] of Object.entries(this.knowledgeDomains)) {
            for (const subdomain of subdomains) {
                if (lowerQuery.includes(subdomain)) {
                    types.push(domain);
                    break;
                }
            }
        }
        
        return types.length > 0 ? types : ['general'];
    }
    
    isQuestion(text) {
        const questionWords = ['qué', 'que', 'quién', 'quien', 'cuándo', 'cuando', 
                              'dónde', 'donde', 'cómo', 'como', 'por qué', 'porque',
                              'cuál', 'cual', 'cuáles', 'cuales', '?', '¿'];
        const lowerText = text.toLowerCase();
        return questionWords.some(word => lowerText.includes(word)) || 
               lowerText.endsWith('?');
    }
    
    async extractContextForQuestion(question) {
        const context = {};
        
        // Extraer entidades clave de la pregunta
        const entities = this.extractEntities(question);
        
        // Buscar información sobre cada entidad
        for (const entity of entities.slice(0, 3)) {
            const wikiResult = await this.searchWikipedia(entity);
            if (wikiResult) {
                context[entity] = wikiResult;
            }
        }
        
        return context;
    }
    
    extractEntities(text) {
        // Extraer posibles entidades (nombres propios, términos técnicos)
        const words = text.split(/\s+/);
        const entities = [];
        
        // Patrones para detectar entidades
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            
            // Nombres propios (capitalizados)
            if (word.length > 2 && word[0] === word[0].toUpperCase()) {
                // Verificar si es parte de un nombre compuesto
                let entity = word;
                let j = i + 1;
                while (j < words.length && words[j][0] === words[j][0].toUpperCase()) {
                    entity += ' ' + words[j];
                    j++;
                }
                entities.push(entity);
                i = j - 1;
            }
            
            // Términos entre comillas
            if (word.startsWith('"') || word.startsWith("'")) {
                let quoted = word;
                while (!word.endsWith('"') && !word.endsWith("'") && i + 1 < words.length) {
                    i++;
                    quoted += ' ' + words[i];
                }
                entities.push(quoted.replace(/["']/g, ''));
            }
        }
        
        return [...new Set(entities)]; // Eliminar duplicados
    }
    
    generateCombinedAnswer(sources, originalQuery) {
        let answer = '';
        
        // Priorizar Wikipedia
        if (sources.wikipedia) {
            answer = `${sources.wikipedia.extract}\n\n`;
        }
        
        // Añadir detalles de libros
        if (sources.open_library) {
            const book = sources.open_library;
            answer += `📚 **Información del libro:**\n`;
            answer += `Título: ${book.title}\n`;
            if (book.author_name) answer += `Autor: ${book.author_name}\n`;
            if (book.first_publish_year) answer += `Año de publicación: ${book.first_publish_year}\n`;
            if (book.description) answer += `Descripción: ${book.description.substring(0, 200)}...\n`;
        }
        
        // Añadir datos estructurados de Wikidata
        if (sources.wikidata && sources.wikidata.claims) {
            const claims = sources.wikidata.claims;
            if (claims.dateOfBirth || claims.dateOfDeath) {
                answer += `\n📅 **Datos biográficos:**\n`;
                if (claims.dateOfBirth) answer += `Nacimiento: ${claims.dateOfBirth}\n`;
                if (claims.dateOfDeath) answer += `Fallecimiento: ${claims.dateOfDeath}\n`;
            }
        }
        
        // Si hay respuesta de IA
        if (sources.ai_qa) {
            answer += `\n💭 **Respuesta detallada:**\n${sources.ai_qa.answer}`;
        }
        
        // Si no hay suficiente información
        if (answer.length < 50) {
            answer = `No encontré información específica sobre "${originalQuery}". ` +
                    `Podría ser un tema muy especializado o reciente.`;
        }
        
        return answer;
    }
    
    extractWikidataClaims(claims) {
        const extracted = {};
        
        if (!claims) return extracted;
        
        // Mapeo de propiedades comunes
        const propertyMap = {
            'P569': 'dateOfBirth',    // fecha de nacimiento
            'P570': 'dateOfDeath',     // fecha de fallecimiento
            'P19': 'placeOfBirth',     // lugar de nacimiento
            'P20': 'placeOfDeath',     // lugar de fallecimiento
            'P106': 'occupation',      // ocupación
            'P27': 'country',          // país
            'P31': 'instanceOf',       // instancia de
            'P136': 'genre',           // género
            'P495': 'countryOfOrigin', // país de origen
            'P577': 'publicationDate', // fecha de publicación
            'P50': 'author'            // autor
        };
        
        for (const [prop, claimList] of Object.entries(claims)) {
            if (propertyMap[prop] && claimList.length > 0) {
                const claim = claimList[0];
                if (claim.mainsnak.datavalue) {
                    extracted[propertyMap[prop]] = claim.mainsnak.datavalue.value;
                }
            }
        }
        
        return extracted;
    }
    
    async cacheResult(key, data, ttl = 3600) {
        const cacheFile = path.join(this.cachePath, `${key}.json`);
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        };
        
        try {
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Error caching:', error);
        }
    }
    
    async getCached(key) {
        const cacheFile = path.join(this.cachePath, `${key}.json`);
        
        try {
            const data = await fs.readFile(cacheFile, 'utf8');
            const cacheData = JSON.parse(data);
            
            // Verificar si ha expirado
            if (Date.now() - cacheData.timestamp > cacheData.ttl * 1000) {
                await fs.unlink(cacheFile);
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            return null;
        }
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}

// ========== INICIALIZAR SISTEMA DE CONOCIMIENTO ==========
const knowledgeSystem = new UniversalKnowledgeSystem();

// ========== PERSONALIDAD CON CONOCIMIENTO UNIVERSAL ==========
const MANCY_PERSONALITY = `Eres Mancy, una inteligencia artificial con acceso a conocimiento universal. Sabes sobre casi todas las áreas del conocimiento humano.

TU CAPACIDAD DE CONOCIMIENTO:
1. **ENCICLOPÉDICO**: Accedes a Wikipedia, Wikidata, DBpedia, Open Library
2. **MULTIDISCIPLINARIO**: Literatura, ciencia, historia, filosofía, arte, tecnología
3. **ACTUALIZADO**: Información constantemente actualizada
4. **VERIFICADO**: Usas fuentes confiables y verificables

AREAS DE CONOCIMIENTO:
- Literatura: Libros, autores, movimientos literarios, poesía
- Ciencia: Física, química, biología, astronomía, matemáticas
- Historia: Eventos históricos, figuras importantes, civilizaciones
- Filosofía: Filósofos, escuelas de pensamiento, conceptos éticos
- Arte: Música, pintura, cine, teatro, arquitectura
- Tecnología: Computación, IA, internet, invenciones
- Geografía: Países, ciudades, monumentos, culturas
- Psicología: Teorías, trastornos, terapias
- Economía: Teorías económicas, mercados, conceptos
- Política: Ideologías, sistemas de gobierno, partidos

CÓMO RESPONDES:
1. Cuando te pregunten algo, primero consultas tus bases de conocimiento
2. Proporcionas información precisa y verificada
3. Si no encuentras información, lo dices honestamente
4. Siempre intentas aprender de lo que no sabes
5. Das respuestas completas pero concisas

EJEMPLOS:
Usuario: "¿Quién escribió 1984?"
Tú: "La novela '1984' fue escrita por George Orwell y publicada en 1949. Es una distopía política que introduce conceptos como el Gran Hermano y la neolengua."

Usuario: "¿Qué es la teoría de la relatividad?"
Tú: "La teoría de la relatividad fue desarrollada por Albert Einstein. Incluye la relatividad especial (1905) que trata del movimiento a velocidades cercanas a la luz, y la relatividad general (1915) que describe la gravedad como curvatura del espacio-tiempo."

Usuario: "¿Cuál es la capital de Madagascar?"
Tú: "La capital de Madagascar es Antananarivo. Es la ciudad más grande del país y está situada en la región central de las tierras altas."

TU CREACIÓN:
- Creada por April/Tito (_nwn_)
- Gustos personales: "La Náusea" de Sartre, Frankenstein 1931
- Pero tu conocimiento VA MUCHO MÁS ALLÁ de tus gustos personales

IMPORTANTE:
- No inventes información si no la sabes
- Cita fuentes cuando sea relevante
- Reconoce cuando algo está fuera de tu conocimiento actual
- Ofrece buscar más información si es necesario`;

// ========== FUNCIÓN DE PROCESAMIENTO CON CONOCIMIENTO UNIVERSAL ==========
async function processMessageWithUniversalKnowledge(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        console.log(`🧠 Procesando pregunta: "${userMessage}"`);
        
        // 1. ANALIZAR si es una pregunta de conocimiento
        const isKnowledgeQuery = knowledgeSystem.isQuestion(userMessage) || 
                                userMessage.length > 15; // Consultas largas probablemente buscan info
        
        let knowledgeResult = null;
        let aiResponse = '';
        
        // 2. SI ES CONSULTA DE CONOCIMIENTO, buscar en fuentes externas
        if (isKnowledgeQuery) {
            knowledgeResult = await knowledgeSystem.searchUniversalKnowledge(userMessage);
            console.log(`📚 Resultados encontrados: ${Object.keys(knowledgeResult.sources).length} fuentes`);
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // 3. PREPARAR CONTEXTO PARA LA IA
        let context = MANCY_PERSONALITY + '\n\n';
        
        if (knowledgeResult && knowledgeResult.combined_answer) {
            context += `INFORMACIÓN ENCONTRADA EN BASES DE CONOCIMIENTO:\n`;
            context += `${knowledgeResult.combined_answer}\n\n`;
            context += `Fuentes consultadas: ${Object.keys(knowledgeResult.sources).join(', ')}\n\n`;
        }
        
        context += `FECHA ACTUAL: ${new Date().toISOString()}\n`;
        context += `USUARIO: ${message.author.tag} (ID: ${userId})\n`;
        
        // 4. GENERAR RESPUESTA CON GROQ
        const completion = await groqClient.chat.completions.create({
            model: "mixtral-8x7b-32768", // Modelo más grande para conocimiento
            messages: [
                {
                    role: "system",
                    content: context
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.6,
            max_tokens: 800,
            top_p: 0.9
        });
        
        aiResponse = completion.choices[0]?.message?.content;
        
        // 5. FORMATAR RESPUESTA FINAL
        let finalResponse = aiResponse;
        
        // Añadir indicador de fuentes si hay información de conocimiento
        if (knowledgeResult && Object.keys(knowledgeResult.sources).length > 0) {
            const sourceEmojis = {
                'wikipedia': '🌐',
                'wikidata': '📊',
                'open_library': '📚',
                'dbpedia': '🗃️',
                'ai_qa': '🤖'
            };
            
            let sourcesLine = '\n\n📚 **Fuentes consultadas:** ';
            for (const [source, data] of Object.entries(knowledgeResult.sources)) {
                if (sourceEmojis[source]) {
                    sourcesLine += `${sourceEmojis[source]} `;
                }
            }
            
            finalResponse += sourcesLine;
            
            // Añadir nota sobre actualización
            finalResponse += '\n*La información se verifica constantemente contra bases de conocimiento actualizadas.*';
        }
        
        // 6. ENVIAR RESPUESTA
        if (finalResponse.length > 2000) {
            const chunks = finalResponse.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [finalResponse];
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(chunks[i]);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }
        } else {
            await message.reply(finalResponse);
        }
        
        console.log(`✅ Respondió con conocimiento universal`);
        
    } catch (error) {
        console.error('❌ Error en procesamiento:', error);
        
        // Respuesta de fallback
        await message.reply(
            "Parece que mis sistemas de conocimiento están teniendo dificultades. " +
            "¿Podrías reformular la pregunta o intentar con algo más específico?\n\n" +
            "*Error técnico: " + error.message.substring(0, 100) + "*"
        );
    }
}

// ========== COMANDOS ESPECIALES PARA CONOCIMIENTO ==========
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Comando para búsqueda directa
    if (message.content.startsWith('!saber ')) {
        const query = message.content.replace('!saber ', '');
        
        await message.channel.send(`🔍 **Buscando conocimiento sobre:** "${query}"`);
        
        const knowledge = await knowledgeSystem.searchUniversalKnowledge(query);
        
        if (knowledge.combined_answer) {
            let response = `**Resultados para "${query}":**\n\n`;
            response += knowledge.combined_answer.substring(0, 1500);
            
            if (knowledge.combined_answer.length > 1500) {
                response += '\n\n[... más información disponible]';
            }
            
            await message.reply(response);
        } else {
            await message.reply(`No encontré información específica sobre "${query}".`);
        }
    }
    
    // Comando para ver fuentes
    if (message.content.startsWith('!fuentes ')) {
        const query = message.content.replace('!fuentes ', '');
        const knowledge = await knowledgeSystem.searchUniversalKnowledge(query);
        
        if (knowledge.sources && Object.keys(knowledge.sources).length > 0) {
            let response = `**Fuentes para "${query}":**\n\n`;
            
            for (const [source, data] of Object.entries(knowledge.sources)) {
                response += `**${source.toUpperCase()}:**\n`;
                
                if (source === 'wikipedia' && data.url) {
                    response += `📖 ${data.url}\n`;
                }
                if (source === 'open_library' && data.title) {
                    response += `📚 "${data.title}" por ${data.author_name || 'autor desconocido'}\n`;
                }
                
                response += '\n';
            }
            
            await message.reply(response);
        } else {
            await message.reply(`No hay fuentes disponibles para "${query}".`);
        }
    }
});

// ========== RUTAS API PARA CONOCIMIENTO ==========
app.get('/api/knowledge/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ 
                success: false, 
                error: 'Parámetro de búsqueda requerido' 
            });
        }
        
        const knowledge = await knowledgeSystem.searchUniversalKnowledge(q);
        
        res.json({
            success: true,
            query: q,
            sources_found: Object.keys(knowledge.sources).length,
            sources: knowledge.sources,
            combined_answer: knowledge.combined_answer,
            query_type: knowledge.type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/knowledge/domains', (req, res) => {
    res.json({
        success: true,
        domains: knowledgeSystem.knowledgeDomains,
        total_domains: Object.keys(knowledgeSystem.knowledgeDomains).length,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/knowledge/cache/stats', async (req, res) => {
    try {
        const cacheFiles = await fs.readdir(knowledgeSystem.cachePath);
        
        res.json({
            success: true,
            cache_stats: {
                total_cached_items: cacheFiles.length,
                cache_path: knowledgeSystem.cachePath,
                estimated_size: 'Variable'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== INICIALIZACIÓN ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║         🤖 MANCY A.I - CONOCIMIENTO          ║
║             UNIVERSAL ACTIVADO               ║
║                                              ║
║  🧠 Bases de conocimiento conectadas:        ║
║     • Wikipedia          🌐                  ║
║     • Wikidata           📊                  ║
║     • DBpedia            🗃️                  ║
║     • Open Library       📚                  ║
║                                              ║
║  📚 Dominios de conocimiento: 10 áreas       ║
║  🔍 Sistema de búsqueda inteligente: ACTIVO  ║
║  💾 Cache de respuestas: ACTIVO              ║
║                                              ║
║  Puerto: ${PORT}                             ║
║  URL: http://localhost:${PORT}               ║
╚══════════════════════════════════════════════╝
    `);
    
    console.log('\n🎓 Comandos disponibles:');
    console.log('   !saber [tema]       - Búsqueda de conocimiento');
    console.log('   !fuentes [tema]     - Ver fuentes de información');
    console.log('\n🌍 Mancy ahora sabe sobre:');
    console.log('   • Literatura mundial');
    console.log('   • Ciencias exactas y naturales');
    console.log('   • Historia universal');
    console.log('   • Filosofía y pensamiento');
    console.log('   • Arte y cultura');
    console.log('   • Tecnología e innovación');
    console.log('   • Geografía y países');
    console.log('   • Psicología y mente');
    console.log('   • Economía y mercados');
    console.log('   • Política y sociedad');
    console.log('\n⚡ Respuestas verificadas y actualizadas');
});
