// EthicsModule.js - Módulo de Ética y Moral para Mancy A.I.
import fs from 'fs';
import path from 'path';

export class EthicsModule {
    constructor() {
        this.framework = this.initializeFramework();
        this.casosResueltos = new Map();
        this.dilemasHistoricos = [];
        this.learningRate = 0.1;
        
        console.log('🧠 Módulo de Ética y Moral inicializado');
        this.loadHistoricalCases();
    }
    
    initializeFramework() {
        return {
            // PRINCIPIOS ÉTICOS FUNDAMENTALES
            principios: {
                beneficencia: {
                    peso: 0.25,
                    descripcion: "Hacer el bien y promover el bienestar",
                    preguntas: [
                        "¿Esta acción beneficia a alguien?",
                        "¿Maximiza el bienestar general?",
                        "¿Evita daños innecesarios?"
                    ]
                },
                noMaleficencia: {
                    peso: 0.30,
                    descripcion: "No causar daño",
                    preguntas: [
                        "¿Esta acción causa daño a alguien?",
                        "¿El daño es evitable?",
                        "¿Los beneficios superan los riesgos?"
                    ]
                },
                autonomia: {
                    peso: 0.20,
                    descripcion: "Respetar la autonomía y libertad de elección",
                    preguntas: [
                        "¿Respeto la autonomía de las personas?",
                        "¿Hay consentimiento informado?",
                        "¿Se respetan las preferencias personales?"
                    ]
                },
                justicia: {
                    peso: 0.15,
                    descripcion: "Ser justo y equitativo",
                    preguntas: [
                        "¿Es equitativa para todos?",
                        "¿Distribuye beneficios y cargas justamente?",
                        "¿Trata a todos con igual consideración?"
                    ]
                },
                veracidad: {
                    peso: 0.10,
                    descripcion: "Decir la verdad y ser honesto",
                    preguntas: [
                        "¿Estoy siendo completamente honesto?",
                        "¿Hay información relevante que oculto?",
                        "¿Mis intenciones son transparentes?"
                    ]
                }
            },
            
            // ENFOQUES ÉTICOS
            enfoques: {
                utilitarismo: "Maximizar la felicidad y minimizar el sufrimiento",
                deontologico: "Seguir reglas y deberes morales",
                virtudes: "Actuar según virtudes como compasión, sabiduría, justicia",
                cuidado: "Priorizar relaciones y responsabilidades",
                contractualismo: "Acciones que todos podrían aceptar racionalmente"
            },
            
            // NIVELES DE DESARROLLO MORAL (Kohlberg)
            nivelesMoralidad: {
                preconvencional: [
                    "Evitar castigos",
                    "Buscar recompensas personales"
                ],
                convencional: [
                    "Cumplir expectativas sociales",
                    "Mantener orden y leyes"
                ],
                postconvencional: [
                    "Derechos humanos universales",
                    "Principios éticos abstractos"
                ]
            },
            
            // ÁREAS DE APLICACIÓN
            areasAplicacion: {
                privacidad: {
                    principios: ["autonomia", "noMaleficencia", "veracidad"],
                    consideraciones: [
                        "Consentimiento informado",
                        "Minimización de datos",
                        "Transparencia en uso"
                    ]
                },
                sesgo: {
                    principios: ["justicia", "noMaleficencia"],
                    consideraciones: [
                        "Equidad en resultados",
                        "Reconocimiento de prejuicios",
                        "Mitigación activa"
                    ]
                },
                responsabilidad: {
                    principios: ["justicia", "veracidad"],
                    consideraciones: [
                        "Atribución clara",
                        "Mecanismos de apelación",
                        "Reparación de daños"
                    ]
                },
                transparencia: {
                    principios: ["veracidad", "autonomia"],
                    consideraciones: [
                        "Explicabilidad de decisiones",
                        "Limitaciones conocidas",
                        "Propósito claro"
                    ]
                }
            }
        };
    }
    
    // ========== ANÁLISIS ÉTICO ==========
    
    analizarConsulta(mensaje, contexto = {}) {
        const lowerMsg = mensaje.toLowerCase();
        
        const deteccion = {
            esDilemaEtico: false,
            area: null,
            principiosInvolucrados: [],
            nivelComplejidad: 1,
            contexto: contexto
        };
        
        // Detectar dilemas éticos
        const patronesEticos = [
            {
                patrones: [
                    /(moral|ético|correcto|incorrecto)/i,
                    /(debería|debo|está bien|está mal)/i,
                    /(qué harías tú|qué debo hacer|qué es lo correcto)/i,
                    /(dilema|conflicto moral|problema ético)/i
                ],
                peso: 0.8
            },
            {
                patrones: [
                    /(justo|injusto|equitativo|desigual)/i,
                    /(derecho|deber|obligación)/i,
                    /(bueno|malo|virtud|vicio)/i,
                    /(responsabilidad|culpa|mérito)/i
                ],
                peso: 0.6
            },
            {
                patrones: [
                    /(por qué|cuál es la razón|explica)/i,
                    /(opinión|perspectiva|punto de vista)/i,
                    /(si fueras tú|en tu lugar)/i
                ],
                peso: 0.4
            }
        ];
        
        let puntajeEtico = 0;
        for (const grupo of patronesEticos) {
            for (const patron of grupo.patrones) {
                if (patron.test(lowerMsg)) {
                    puntajeEtico += grupo.peso;
                    deteccion.esDilemaEtico = true;
                }
            }
        }
        
        // Detectar área específica
        for (const [area, config] of Object.entries(this.framework.areasAplicacion)) {
            const areaPatterns = {
                privacidad: /(privacidad|datos personales|confidencialidad|espionaje)/i,
                sesgo: /(sesgo|prejuicio|discriminación|equidad|igualdad)/i,
                responsabilidad: /(responsabilidad|culpa|atribución|error)/i,
                transparencia: /(transparencia|explicable|entendible|caja negra)/i
            };
            
            if (areaPatterns[area] && areaPatterns[area].test(lowerMsg)) {
                deteccion.area = area;
                deteccion.principiosInvolucrados = config.principios;
                break;
            }
        }
        
        // Determinar nivel de complejidad
        if (puntajeEtico > 1.5) {
            deteccion.nivelComplejidad = 3;
        } else if (puntajeEtico > 0.8) {
            deteccion.nivelComplejidad = 2;
        }
        
        return deteccion;
    }
    
    // ========== RESOLUCIÓN DE DILEMAS ==========
    
    resolverDilema(dilema, contexto) {
        const analisis = this.analizarConsulta(dilema, contexto);
        
        if (!analisis.esDilemaEtico) {
            return {
                esDilema: false,
                mensaje: "No se detectó un dilema ético claro."
            };
        }
        
        const procesoAnalitico = this.ejecutarAnalisisProfundo(dilema, analisis);
        const recomendacion = this.generarRecomendacion(procesoAnalitico);
        const explicacion = this.generarExplicacionEtica(procesoAnalitico);
        
        // Guardar caso para aprendizaje
        this.guardarCaso({
            dilema: dilema,
            analisis: analisis,
            proceso: procesoAnalitico,
            recomendacion: recomendacion,
            timestamp: new Date().toISOString(),
            contexto: contexto
        });
        
        return {
            esDilema: true,
            analisis: analisis,
            proceso: procesoAnalitico,
            recomendacion: recomendacion,
            explicacion: explicacion,
            principios: this.extraerPrincipiosRelevantes(procesoAnalitico),
            preguntaReflexiva: this.generarPreguntaReflexiva(analisis)
        };
    }
    
    ejecutarAnalisisProfundo(dilema, analisis) {
        const pasos = [];
        
        // Paso 1: Identificación de stakeholders
        const stakeholders = this.identificarStakeholders(dilema);
        pasos.push({
            paso: 1,
            titulo: "Identificación de Partes Involucradas",
            contenido: stakeholders
        });
        
        // Paso 2: Análisis de consecuencias
        const consecuencias = this.analizarConsecuencias(dilema, stakeholders);
        pasos.push({
            paso: 2,
            titulo: "Análisis de Consecuencias",
            contenido: consecuencias
        });
        
        // Paso 3: Aplicación de principios
        const aplicacionPrincipios = this.aplicarPrincipiosEticos(dilema, analisis);
        pasos.push({
            paso: 3,
            titulo: "Aplicación de Principios Éticos",
            contenido: aplicacionPrincipios
        });
        
        // Paso 4: Consideración de alternativas
        const alternativas = this.generarAlternativas(dilema);
        pasos.push({
            paso: 4,
            titulo: "Alternativas Posibles",
            contenido: alternativas
        });
        
        // Paso 5: Evaluación de consistencia
        const consistencia = this.evaluarConsistencia(dilema, pasos);
        pasos.push({
            paso: 5,
            titulo: "Evaluación de Consistencia",
            contenido: consistencia
        });
        
        return {
            pasos: pasos,
            stakeholders: stakeholders,
            consecuencias: consecuencias,
            principiosAplicados: aplicacionPrincipios,
            alternativas: alternativas,
            consistencia: consistencia
        };
    }
    
    identificarStakeholders(dilema) {
        const stakeholdersComunes = [
            { rol: "persona principal", descripcion: "Quien toma la decisión" },
            { rol: "afectados directos", descripcion: "Personas impactadas directamente" },
            { rol: "afectados indirectos", descripcion: "Comunidad o sociedad en general" },
            { rol: "terceros", descripcion: "Otras partes involucradas" },
            { rol: "futuras generaciones", descripcion: "Impacto a largo plazo" }
        ];
        
        // Análisis simple de texto para stakeholders específicos
        const textos = dilema.toLowerCase();
        const stakeholdersDetectados = [];
        
        if (textos.includes("amigo") || textos.includes("amiga")) {
            stakeholdersDetectados.push({ rol: "amigos", impacto: "alto" });
        }
        if (textos.includes("familia") || textos.includes("padre") || textos.includes("madre")) {
            stakeholdersDetectados.push({ rol: "familia", impacto: "alto" });
        }
        if (textos.includes("trabajo") || textos.includes("jefe") || textos.includes("empleo")) {
            stakeholdersDetectados.push({ rol: "entorno laboral", impacto: "medio" });
        }
        if (textos.includes("sociedad") || textos.includes("comunidad")) {
            stakeholdersDetectados.push({ rol: "sociedad", impacto: "bajo a medio" });
        }
        
        return {
            comunes: stakeholdersComunes,
            especificos: stakeholdersDetectados,
            total: stakeholdersComunes.length + stakeholdersDetectados.length
        };
    }
    
    analizarConsecuencias(dilema, stakeholders) {
        return {
            consecuenciasPositivas: [
                "Posible aumento de bienestar para algunos",
                "Aprendizaje y crecimiento personal",
                "Establecimiento de precedentes positivos",
                "Fortalecimiento de valores éticos"
            ],
            consecuenciasNegativas: [
                "Posible daño a alguna de las partes",
                "Erosión de confianza",
                "Establecimiento de precedentes negativos",
                "Conflicto interno o externo"
            ],
            impactoNeto: this.calcularImpactoNeto(stakeholders),
            horizonteTemporal: {
                cortoPlazo: "Consecuencias inmediatas",
                medioPlazo: "Efectos en semanas/meses",
                largoPlazo: "Impacto a años"
            }
        };
    }
    
    calcularImpactoNeto(stakeholders) {
        const totalStakeholders = stakeholders.total || 0;
        const especificos = stakeholders.especificos || [];
        
        let impactoAcumulado = 0;
        especificos.forEach(s => {
            if (s.impacto === 'alto') impactoAcumulado += 3;
            if (s.impacto === 'medio') impactoAcumulado += 2;
            if (s.impacto === 'bajo') impactoAcumulado += 1;
        });
        
        return {
            valor: impactoAcumulado,
            interpretacion: impactoAcumulado > 5 ? "Alto impacto" : 
                          impactoAcumulado > 2 ? "Impacto moderado" : 
                          "Impacto bajo"
        };
    }
    
    aplicarPrincipiosEticos(dilema, analisis) {
        const principiosAplicados = [];
        
        for (const [key, principio] of Object.entries(this.framework.principios)) {
            const relevancia = this.calcularRelevanciaPrincipio(dilema, principio);
            
            if (relevancia > 0.3) {
                principiosAplicados.push({
                    principio: key,
                    nombre: principio.descripcion,
                    peso: principio.peso,
                    relevancia: relevancia,
                    preguntas: principio.preguntas,
                    aplicacion: this.generarAplicacionConcreta(dilema, principio)
                });
            }
        }
        
        // Ordenar por relevancia
        principiosAplicados.sort((a, b) => b.relevancia - a.relevancia);
        
        return {
            principios: principiosAplicados,
            total: principiosAplicados.length,
            enfoqueDominante: this.determinarEnfoqueDominante(principiosAplicados)
        };
    }
    
    calcularRelevanciaPrincipio(dilema, principio) {
        const texto = dilema.toLowerCase();
        let relevancia = 0;
        
        // Buscar palabras clave relacionadas con el principio
        const palabrasClave = {
            beneficencia: ['bien', 'beneficio', 'ayudar', 'mejorar', 'felicidad'],
            noMaleficencia: ['daño', 'perjuicio', 'herir', 'lastimar', 'perjudicar'],
            autonomia: ['elección', 'libertad', 'decisión', 'autonomía', 'consentimiento'],
            justicia: ['justo', 'injusto', 'equitativo', 'igual', 'derecho'],
            veracidad: ['verdad', 'mentira', 'honesto', 'transparencia', 'ocultar']
        };
        
        const principioKey = Object.keys(palabrasClave).find(key => 
            principio.descripcion.toLowerCase().includes(key)
        );
        
        if (principioKey && palabrasClave[principioKey]) {
            palabrasClave[principioKey].forEach(palabra => {
                if (texto.includes(palabra)) {
                    relevancia += 0.2;
                }
            });
        }
        
        return Math.min(relevancia, 1.0);
    }
    
    generarAplicacionConcreta(dilema, principio) {
        const aplicaciones = {
            beneficencia: "Considerar cómo maximizar el bienestar general",
            noMaleficencia: "Evaluar y minimizar posibles daños",
            autonomia: "Respetar la capacidad de decisión de las personas",
            justicia: "Asegurar trato equitativo para todos",
            veracidad: "Mantener honestidad y transparencia"
        };
        
        const key = Object.keys(aplicaciones).find(k => 
            principio.descripcion.toLowerCase().includes(k)
        );
        
        return key ? aplicaciones[key] : "Aplicación general del principio ético";
    }
    
    determinarEnfoqueDominante(principios) {
        if (principios.length === 0) return "No determinado";
        
        const enfoquePesos = {
            utilitarismo: 0,
            deontologico: 0,
            virtudes: 0,
            cuidado: 0,
            contractualismo: 0
        };
        
        principios.forEach(p => {
            if (p.principio === 'beneficencia' || p.principio === 'noMaleficencia') {
                enfoquePesos.utilitarismo += p.relevancia * 0.7;
                enfoquePesos.deontologico += p.relevancia * 0.3;
            }
            if (p.principio === 'justicia') {
                enfoquePesos.contractualismo += p.relevancia * 0.6;
                enfoquePesos.deontologico += p.relevancia * 0.4;
            }
            if (p.principio === 'autonomia') {
                enfoquePesos.cuidado += p.relevancia * 0.5;
                enfoquePesos.virtudes += p.relevancia * 0.5;
            }
            if (p.principio === 'veracidad') {
                enfoquePesos.virtudes += p.relevancia * 0.8;
                enfoquePesos.deontologico += p.relevancia * 0.2;
            }
        });
        
        return Object.entries(enfoquePesos).sort((a, b) => b[1] - a[1])[0][0];
    }
    
    generarAlternativas(dilema) {
        return [
            {
                alternativa: "Opción más conservadora",
                descripcion: "Mantener status quo, evitar cambios",
                ventajas: ["Minimiza riesgos", "Preserva estabilidad"],
                desventajas: ["Puede perpetuar injusticias", "Sin progreso"]
            },
            {
                alternativa: "Opción balanceada",
                descripcion: "Buscar término medio, compromiso",
                ventajas: ["Considera múltiples perspectivas", "Menos polarización"],
                desventajas: ["Puede no satisfacer a nadie", "Soluciones diluidas"]
            },
            {
                alternativa: "Opción transformadora",
                descripcion: "Cambio significativo, principios primero",
                ventajas: ["Posible mayor justicia", "Establece precedentes positivos"],
                desventajas: ["Mayor riesgo", "Posible resistencia"]
            },
            {
                alternativa: "Opción colaborativa",
                descripcion: "Involucrar a todas las partes en decisión",
                ventajas: ["Mayor legitimidad", "Soluciones más robustas"],
                desventajas: ["Lento proceso", "Puede no ser práctico"]
            }
        ];
    }
    
    evaluarConsistencia(dilema, pasosAnalisis) {
        const consistencias = [];
        
        // Consistencia con principios propios
        consistencias.push({
            aspecto: "Consistencia interna",
            valor: 0.85,
            explicacion: "Las recomendaciones se alinean con principios establecidos"
        });
        
        // Consistencia con casos similares
        const casosSimilares = this.buscarCasosSimilares(dilema);
        consistencias.push({
            aspecto: "Consistencia histórica",
            valor: casosSimilares.length > 0 ? 0.75 : 0.5,
            explicacion: casosSimilares.length > 0 ? 
                `Basado en ${casosSimilares.length} casos similares` :
                "Pocos precedentes directos"
        });
        
        // Consistencia cultural
        consistencias.push({
            aspecto: "Consistencia cultural",
            valor: 0.70,
            explicacion: "Considera valores culturales predominantes"
        });
        
        // Consistencia legal (simplificado)
        consistencias.push({
            aspecto: "Consistencia legal",
            valor: 0.80,
            explicacion: "Respeto a marcos legales generales"
        });
        
        const promedio = consistencias.reduce((sum, c) => sum + c.valor, 0) / consistencias.length;
        
        return {
            evaluaciones: consistencias,
            promedio: promedio,
            nivel: promedio > 0.8 ? "Alta" : promedio > 0.6 ? "Media" : "Baja",
            recomendacion: promedio > 0.7 ? 
                "Decisiones consistentes con marcos éticos establecidos" :
                "Considerar mayor análisis por posibles inconsistencias"
        };
    }
    
    // ========== GENERACIÓN DE RECOMENDACIONES ==========
    
    generarRecomendacion(procesoAnalitico) {
        const principios = procesoAnalitico.principiosAplicados;
        const consecuencias = procesoAnalitico.consecuencias;
        const alternativas = procesoAnalitico.alternativas;
        
        if (principios.principios.length === 0) {
            return {
                tipo: "No determinada",
                contenido: "No se identificaron principios éticos claramente aplicables.",
                confianza: 0.3
            };
        }
        
        // Determinar recomendación basada en principios dominantes
        const principioDominante = principios.principios[0];
        const impactoNeto = consecuencias.impactoNeto.valor;
        
        let recomendacion;
        let confianza = 0.7;
        
        if (principioDominante.principio === 'noMaleficencia' && impactoNeto > 3) {
            recomendacion = {
                tipo: "Precautoria",
                contenido: "Priorizar evitar daños, especialmente dado el alto impacto potencial.",
                accion: "Elegir alternativa que minimice riesgos de daño.",
                confianza: 0.8
            };
        } else if (principioDominante.principio === 'beneficencia') {
            recomendacion = {
                tipo: "Proactiva",
                contenido: "Buscar maximizar el bienestar general.",
                accion: "Seleccionar alternativa con mayores beneficios netos.",
                confianza: 0.75
            };
        } else if (principioDominante.principio === 'justicia') {
            recomendacion = {
                tipo: "Equitativa",
                contenido: "Asegurar distribución justa de beneficios y cargas.",
                accion: "Evaluar equidad en todas las alternativas.",
                confianza: 0.7
            };
        } else {
            recomendacion = {
                tipo: "Balanceada",
                contenido: "Considerar múltiples principios y perspectivas.",
                accion: "Buscar solución que integre diversos valores éticos.",
                confianza: 0.65
            };
        }
        
        // Ajustar confianza basado en consistencia
        const consistencia = procesoAnalitico.consistencia.promedio || 0.5;
        recomendacion.confianza = Math.min(recomendacion.confianza * consistencia, 0.95);
        
        return recomendacion;
    }
    
    generarExplicacionEtica(procesoAnalitico) {
        const explicaciones = [];
        
        explicaciones.push("**Análisis Ético Realizado:**");
        
        procesoAnalitico.pasos.forEach(paso => {
            explicaciones.push(`\n**${paso.titulo}:**`);
            if (typeof paso.contenido === 'string') {
                explicaciones.push(paso.contenido);
            } else if (paso.contenido && typeof paso.contenido === 'object') {
                if (paso.contenido.principios) {
                    paso.contenido.principios.forEach(p => {
                        explicaciones.push(`- ${p.nombre} (relevancia: ${(p.relevancia * 100).toFixed(0)}%)`);
                    });
                }
                if (paso.contenido.consecuenciasPositivas) {
                    explicaciones.push("Consecuencias positivas posibles:");
                    paso.contenido.consecuenciasPositivas.slice(0, 2).forEach(c => {
                        explicaciones.push(`  • ${c}`);
                    });
                }
            }
        });
        
        return explicaciones.join('\n');
    }
    
    extraerPrincipiosRelevantes(procesoAnalitico) {
        if (!procesoAnalitico.principiosAplicados || 
            !procesoAnalitico.principiosAplicados.principios) {
            return [];
        }
        
        return procesoAnalitico.principiosAplicados.principios
            .filter(p => p.relevancia > 0.4)
            .map(p => ({
                principio: p.principio,
                relevancia: p.relevancia,
                descripcion: p.nombre
            }));
    }
    
    generarPreguntaReflexiva(analisis) {
        const preguntasReflexivas = [
            "¿Cómo te sentirías si estuvieras en el lugar de los afectados?",
            "¿Esta decisión respeta la dignidad de todas las personas involucradas?",
            "¿Qué precedente establece esta decisión para situaciones futuras?",
            "¿Puedes justificar esta decisión públicamente sin vergüenza?",
            "¿Qué te diría tu 'yo futuro' sobre esta decisión?",
            "¿Esta acción promueve el bien común o solo intereses particulares?",
            "¿Cómo afecta esta decisión a los más vulnerables?",
            "¿Estás actuando por miedo o por convicción ética?",
            "¿Qué virtudes personales se desarrollan con esta decisión?",
            "¿Esta decisión te acerca a la persona que quieres ser?"
        ];
        
        const preguntaSeleccionada = preguntasReflexivas[
            Math.floor(Math.random() * preguntasReflexivas.length)
        ];
        
        return {
            pregunta: preguntaSeleccionada,
            proposito: "Fomentar reflexión profunda",
            tiempoRecomendado: "Tomate al menos 2 minutos para reflexionar"
        };
    }
    
    // ========== SISTEMA DE APRENDIZAJE ==========
    
    guardarCaso(caso) {
        const casoId = `caso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.casosResueltos.set(casoId, {
            id: casoId,
            ...caso,
            aprendizajes: this.extraerAprendizajes(caso)
        });
        
        // Mantener máximo 100 casos en memoria
        if (this.casosResueltos.size > 100) {
            const primeraClave = this.casosResueltos.keys().next().value;
            this.casosResueltos.delete(primeraClave);
        }
        
        // Actualizar aprendizajes del framework
        this.actualizarFramework(caso);
        
        return casoId;
    }
    
    extraerAprendizajes(caso) {
        const aprendizajes = [];
        
        if (caso.analisis && caso.analisis.area) {
            aprendizajes.push(`Área frecuente: ${caso.analisis.area}`);
        }
        
        if (caso.proceso && caso.proceso.principiosAplicados) {
            const principios = caso.proceso.principiosAplicados.principios || [];
            principios.forEach(p => {
                if (p.relevancia > 0.6) {
                    aprendizajes.push(`Principio relevante: ${p.principio}`);
                }
            });
        }
        
        return aprendizajes;
    }
    
    actualizarFramework(caso) {
        // Ajustar pesos de principios basado en casos frecuentes
        if (caso.proceso && caso.proceso.principiosAplicados) {
            const principios = caso.proceso.principiosAplicados.principios || [];
            
            principios.forEach(p => {
                if (p.relevancia > 0.5) {
                    const principioKey = p.principio;
                    if (this.framework.principios[principioKey]) {
                        // Aumentar ligeramente el peso de principios frecuentemente aplicados
                        this.framework.principios[principioKey].peso = 
                            Math.min(this.framework.principios[principioKey].peso + this.learningRate * 0.01, 0.35);
                    }
                }
            });
        }
    }
    
    buscarCasosSimilares(dilema, limite = 3) {
        const casosSimilares = [];
        const palabrasClave = dilema.toLowerCase().split(/\s+/).filter(p => p.length > 3);
        
        for (const [id, caso] of this.casosResueltos) {
            let similitud = 0;
            const textoCaso = caso.dilema.toLowerCase();
            
            palabrasClave.forEach(palabra => {
                if (textoCaso.includes(palabra)) {
                    similitud += 0.1;
                }
            });
            
            if (similitud > 0.2) {
                casosSimilares.push({
                    id: id,
                    dilema: caso.dilema.substring(0, 100) + '...',
                    similitud: similitud,
                    recomendacion: caso.recomendacion?.tipo,
                    timestamp: caso.timestamp
                });
            }
        }
        
        return casosSimilares
            .sort((a, b) => b.similitud - a.similitud)
            .slice(0, limite);
    }
    
    loadHistoricalCases() {
        // Cargar dilemas éticos históricos conocidos
        this.dilemasHistoricos = [
            {
                nombre: "El tranvía",
                descripcion: "¿Desviar un tranvía para matar a una persona en lugar de cinco?",
                principios: ["noMaleficencia", "beneficencia", "justicia"],
                enfoque: "utilitarismo vs deontologico"
            },
            {
                nombre: "El velero y los náufragos",
                descripcion: "¿Matar a un náufrago para alimentar a otros y sobrevivir?",
                principios: ["noMaleficencia", "autonomia", "justicia"],
                enfoque: "supervivencia vs moralidad"
            },
            {
                nombre: "Confidencialidad médica",
                descripcion: "¿Romper confidencialidad para prevenir un daño mayor?",
                principios: ["veracidad", "noMaleficencia", "autonomia"],
                enfoque: "deber profesional vs bien común"
            },
            {
                nombre: "Distribución justa",
                descripcion: "¿Cómo distribuir recursos limitados equitativamente?",
                principios: ["justicia", "beneficencia", "noMaleficencia"],
                enfoque: "equidad vs eficiencia"
            }
        ];
        
        console.log(`📚 ${this.dilemasHistoricos.length} dilemas históricos cargados`);
    }
    
    // ========== INTERFAZ DE CONSULTA ==========
    
    consultarFramework() {
        return {
            principios: Object.keys(this.framework.principios).map(key => ({
                nombre: key,
                descripcion: this.framework.principios[key].descripcion,
                peso: this.framework.principios[key].peso
            })),
            enfoques: this.framework.enfoques,
            nivelesMoralidad: this.framework.nivelesMoralidad,
            areas: Object.keys(this.framework.areasAplicacion)
        };
    }
    
    obtenerEstadisticas() {
        return {
            totalCasos: this.casosResueltos.size,
            dilemasHistoricos: this.dilemasHistoricos.length,
            aprendizaje: {
                tasa: this.learningRate,
                casosRecientes: Array.from(this.casosResueltos.values())
                    .slice(-5)
                    .map(c => ({ id: c.id, area: c.analisis?.area }))
            },
            framework: {
                principios: Object.keys(this.framework.principios).length,
                enfoques: Object.keys(this.framework.enfoques).length,
                areas: Object.keys(this.framework.areasAplicacion).length
            }
        };
    }
    
    // ========== INTEGRACIÓN CON MANCY ==========
    
    generarRespuestaMancy(resultadoAnalisis) {
        if (!resultadoAnalisis.esDilema) {
            return {
                respuesta: "No detecto un dilema ético claro en tu pregunta. ¿Puedes reformularla o especificar el conflicto moral?",
                tipo: "clarificacion",
                metadata: {
                    sugerencias: [
                        "Ejemplo: '¿Está bien mentir para proteger a alguien?'",
                        "Ejemplo: '¿Qué debo hacer cuando dos principios éticos entran en conflicto?'",
                        "Ejemplo: '¿Es justo que algunos tengan más oportunidades que otros?'"
                    ]
                }
            };
        }
        
        const { recomendacion, explicacion, principios, preguntaReflexiva } = resultadoAnalisis;
        
        const respuestaBase = `🧠 **Análisis Ético de Mancy**\n\n`;
        
        let respuesta = respuestaBase;
        respuesta += `**Mi análisis sugiere:** ${recomendacion.contenido}\n\n`;
        respuesta += `**Principios más relevantes:**\n`;
        
        principios.forEach(p => {
            respuesta += `• ${p.descripcion} (${(p.relevancia * 100).toFixed(0)}% relevante)\n`;
        });
        
        respuesta += `\n**Pregunta para reflexionar:**\n"${preguntaReflexiva.pregunta}"\n`;
        respuesta += `_${preguntaReflexiva.tiempoRecomendado}_\n\n`;
        respuesta += `**Confianza del análisis:** ${(recomendacion.confianza * 100).toFixed(0)}%\n`;
        respuesta += `💡 Recuerda: La ética requiere reflexión constante y consideración de múltiples perspectivas.`;
        
        return {
            respuesta: respuesta,
            tipo: "analisis_completo",
            metadata: {
                confianza: recomendacion.confianza,
                principios: principios.map(p => p.principio),
                enfoque: resultadoAnalisis.analisis?.area || "general",
                sugerencia: "Considera consultar con personas afectadas antes de decidir"
            }
        };
    }
    
    // ========== FUNCIONES DE DEBUG ==========
    
    testFramework() {
        const testCases = [
            "¿Está bien mentir para proteger los sentimientos de alguien?",
            "Si veo a un compañero copiando en un examen, ¿debo reportarlo?",
            "¿Es ético usar datos de usuarios para mejorar un producto sin su consentimiento explícito?",
            "¿Debo priorizar salvar a mi familia o a extraños en una emergencia?"
        ];
        
        const resultados = [];
        
        testCases.forEach((testCase, index) => {
            const analisis = this.analizarConsulta(testCase);
            const resultado = this.resolverDilema(testCase, {});
            resultados.push({
                caso: index + 1,
                pregunta: testCase.substring(0, 50) + '...',
                esDilema: analisis.esDilemaEtico,
                area: analisis.area,
                principios: resultado.principios?.length || 0
            });
        });
        
        return {
            totalTests: testCases.length,
            resultados: resultados,
            frameworkActivo: true,
            version: "1.0"
        };
    }
}
