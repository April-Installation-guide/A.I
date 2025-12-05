// En EthicsModule.js - Añadir después del constructor

class EthicsModule {
    constructor() {
        // ... código existente ...
        
        // AÑADIR PRINCIPIOS UNESCO
        this.unescoPrinciples = this.inicializarPrincipiosUNESCO();
        console.log('🌍 Principios UNESCO integrados en el sistema ético');
    }
    
    inicializarPrincipiosUNESCO() {
        return {
            fundamentos: {
                dignidadHumana: {
                    principio: "Dignidad Humana y Derechos Humanos",
                    descripcion: "Reconocimiento y respeto de la dignidad inherente de todas las personas",
                    aplicacion: "Proteger la autonomía, privacidad y derechos fundamentales",
                    referencia: "Artículo 1, Declaración Universal de Derechos Humanos"
                },
                beneficio: {
                    principio: "Beneficio y No Maleficencia",
                    descripcion: "Maximizar beneficios y minimizar daños para individuos y sociedad",
                    aplicacion: "Evaluar riesgos vs beneficios, prevenir daños previsibles",
                    referencia: "Principio bioético fundamental"
                },
                autonomia: {
                    principio: "Autonomía y Consentimiento Informado",
                    descripcion: "Respeto a la capacidad de autodeterminación y decisiones informadas",
                    aplicacion: "Consentimiento libre, informado y específico",
                    referencia: "Artículo 3, Declaración Universal sobre Bioética"
                },
                justicia: {
                    principio: "Justicia y Equidad",
                    descripcion: "Distribución justa de beneficios y cargas, no discriminación",
                    aplicacion: "Acceso equitativo, consideración de poblaciones vulnerables",
                    referencia: "Artículo 10-13, Declaración UNESCO"
                },
                solidaridad: {
                    principio: "Solidaridad y Cooperación",
                    descripcion: "Apoyo mutuo y colaboración para el bien común",
                    aplicacion: "Compartir beneficios científicos, cooperación internacional",
                    referencia: "Artículo 14, Declaración Universal"
                },
                responsabilidad: {
                    principio: "Responsabilidad y Responsabilidad Social",
                    descripcion: "Rendición de cuentas por acciones y sus consecuencias",
                    aplicacion: "Transparencia, evaluación de impacto, reparación de daños",
                    referencia: "Artículo 16, Declaración UNESCO"
                }
            },
            
            areasAplicacionUNESCO: {
                cienciaTecnologia: {
                    principios: ["dignidadHumana", "beneficio", "responsabilidad"],
                    guias: [
                        "Investigación responsable e innovación",
                        "Evaluación ética de tecnologías emergentes",
                        "Participación pública en ciencia"
                    ]
                },
                educacion: {
                    principios: ["justicia", "solidaridad", "dignidadHumana"],
                    guias: [
                        "Educación inclusiva y de calidad",
                        "Respeto a la diversidad cultural",
                        "Acceso al conocimiento"
                    ]
                },
                cultura: {
                    principios: ["dignidadHumana", "solidaridad", "justicia"],
                    guias: [
                        "Respeto a la diversidad cultural",
                        "Protección del patrimonio cultural",
                        "Diálogo intercultural"
                    ]
                },
                comunicacion: {
                    principios: ["autonomia", "responsabilidad", "dignidadHumana"],
                    guias: [
                        "Libertad de expresión responsable",
                        "Acceso a la información",
                        "Combate a la desinformación"
                    ]
                }
            },
            
            documentosFundamentales: [
                {
                    nombre: "Declaración Universal sobre Bioética y Derechos Humanos (2005)",
                    puntosClave: [
                        "Respeto a la dignidad humana",
                        "Beneficio y daño",
                        "Autonomía y responsabilidad individual",
                        "Consentimiento informado",
                        "Protección de personas sin capacidad de consentir",
                        "Respeto a la vulnerabilidad humana",
                        "Privacidad y confidencialidad",
                        "Igualdad, justicia y equidad",
                        "No discriminación y no estigmatización",
                        "Respeto a la diversidad cultural y pluralismo"
                    ]
                },
                {
                    nombre: "Recomendación sobre la Ética de la Inteligencia Artificial (2021)",
                    principios: [
                        "Proporcionalidad y no daño",
                        "Seguridad y protección",
                        "Justicia y no discriminación",
                        "Sostenibilidad",
                        "Derecho a la privacidad",
                        "Supervisión y determinación humanas",
                        "Transparencia y explicabilidad",
                        "Responsabilidad y rendición de cuentas",
                        "Conciencia y alfabetización",
                        "Gobernanza multinivel"
                    ]
                },
                {
                    nombre: "Declaración Universal de Derechos Humanos (1948)",
                    relevancia: "Base fundamental de todos los principios éticos UNESCO"
                }
            ]
        };
    }
    
    // ========== MÉTODOS PARA EXPLICAR PRINCIPIOS UNESCO ==========
    
    explicarPrincipiosUNESCO(nivel = 'basico') {
        const niveles = {
            basico: this.generarExplicacionBasica(),
            intermedio: this.generarExplicacionDetallada(),
            completo: this.generarExplicacionCompleta()
        };
        
        return niveles[nivel] || niveles.basico;
    }
    
    generarExplicacionBasica() {
        return {
            titulo: "🌍 Principios Éticos Fundamentales de la UNESCO",
            introduccion: "La UNESCO establece principios éticos basados en la dignidad humana, derechos humanos y el bien común.",
            principios: Object.values(this.unescoPrinciples.fundamentos).map(p => ({
                nombre: p.principio,
                descripcion: p.descripcion
            })),
            aplicacion: "Estos principios guían la ciencia, educación, cultura y comunicación para el desarrollo sostenible.",
            referencia: "Declaración Universal sobre Bioética y Derechos Humanos (2005)"
        };
    }
    
    generarExplicacionDetallada() {
        const principios = Object.entries(this.unescoPrinciples.fundamentos).map(([key, principio]) => ({
            principio: principio.principio,
            significado: principio.descripcion,
            comoAplicar: principio.aplicacion,
            documento: principio.referencia
        }));
        
        return {
            titulo: "📚 Marco Ético de la UNESCO para el Desarrollo Sostenible",
            marco: "La ética de la UNESCO se basa en 6 principios fundamentales interrelacionados:",
            principios: principios,
            enfoque: "Estos principios se aplican de forma transversal en:",
            areas: Object.entries(this.unescoPrinciples.areasAplicacionUNESCO).map(([area, config]) => ({
                area: this.formatearArea(area),
                principios: config.principios.map(p => this.unescoPrinciples.fundamentos[p].principio),
                enfoque: config.guias.join(', ')
            })),
            documentos: this.unescoPrinciples.documentosFundamentales.map(doc => doc.nombre)
        };
    }
    
    generarExplicacionCompleta() {
        return {
            sistemaEtico: "La UNESCO promueve una ética universal basada en:",
            fundamentos: this.unescoPrinciples.fundamentos,
            aplicaciones: this.unescoPrinciples.areasAplicacionUNESCO,
            documentos: this.unescoPrinciples.documentosFundamentales,
            principiosIA: this.obtenerPrincipiosIAUNESCO(),
            implicaciones: this.generarImplicacionesPracticas()
        };
    }
    
    formatearArea(area) {
        const formatos = {
            cienciaTecnologia: "Ciencia y Tecnología",
            educacion: "Educación",
            cultura: "Cultura",
            comunicacion: "Comunicación e Información"
        };
        return formatos[area] || area;
    }
    
    obtenerPrincipiosIAUNESCO() {
        const docIA = this.unescoPrinciples.documentosFundamentales.find(d => 
            d.nombre.includes("Inteligencia Artificial")
        );
        
        return docIA ? {
            documento: docIA.nombre,
            principios: docIA.principios || [],
            objetivo: "Asegurar que la IA beneficie a la humanidad y planeta"
        } : null;
    }
    
    generarImplicacionesPracticas() {
        return {
            paraIndividuos: [
                "Derecho a ser informado sobre tecnologías que nos afectan",
                "Protección de datos personales y privacidad",
                "Acceso equitativo a beneficios científicos",
                "Participación en decisiones éticas"
            ],
            paraSociedad: [
                "Desarrollo científico responsable",
                "Educación ética en todas las disciplinas",
                "Protección de grupos vulnerables",
                "Cooperación internacional en ética"
            ],
            paraTecnologia: [
                "Diseño ético desde el inicio",
                "Evaluación de impacto continuo",
                "Transparencia y explicabilidad",
                "Mecanismos de supervisión humana"
            ]
        };
    }
    
    // ========== RESPUESTAS PARA PREGUNTAS SOBRE ÉTICA UNESCO ==========
    
    generarRespuestaEticaUNESCO(pregunta, contexto) {
        const lowerPregunta = pregunta.toLowerCase();
        
        // Detectar tipo de pregunta sobre ética UNESCO
        const tipoPregunta = this.detectarTipoPreguntaUNESCO(lowerPregunta);
        
        switch(tipoPregunta) {
            case 'principios':
                return this.responderSobrePrincipios(pregunta);
                
            case 'fundamentos':
                return this.responderSobreFundamentos(pregunta);
                
            case 'aplicacion':
                return this.responderSobreAplicacion(pregunta);
                
            case 'documentos':
                return this.responderSobreDocumentos(pregunta);
                
            case 'ia':
                return this.responderSobreIA(pregunta);
                
            case 'general':
            default:
                return this.responderSobreEticaGeneral(pregunta);
        }
    }
    
    detectarTipoPreguntaUNESCO(pregunta) {
        if (pregunta.includes('unesco') || pregunta.includes('organización')) {
            if (pregunta.includes('principio') || pregunta.includes('base')) {
                return 'principios';
            }
            if (pregunta.includes('documento') || pregunta.includes('declaración')) {
                return 'documentos';
            }
            if (pregunta.includes('aplic') || pregunta.includes('usar') || pregunta.includes('cómo')) {
                return 'aplicacion';
            }
            if (pregunta.includes('ia') || pregunta.includes('inteligencia artificial')) {
                return 'ia';
            }
            return 'general';
        }
        
        // Preguntas generales sobre ética
        if (pregunta.includes('ética') && 
            (pregunta.includes('base') || pregunta.includes('fundamento') || 
             pregunta.includes('principio') || pregunta.includes('qué es'))) {
            return 'fundamentos';
        }
        
        return null;
    }
    
    responderSobrePrincipios(preguntaOriginal) {
        const explicacion = this.explicarPrincipiosUNESCO('intermedio');
        
        let respuesta = `🌍 **Los principios éticos de la UNESCO se basan en:**\n\n`;
        
        explicacion.principios.forEach((principio, index) => {
            respuesta += `${index + 1}. **${principio.principio}**: ${principio.significado}\n`;
        });
        
        respuesta += `\n**Documento fundamental:** ${explicacion.documentos[0]}\n`;
        respuesta += `**Enfoque:** Estos principios guían la ciencia, educación y cultura para un desarrollo sostenible que respete la dignidad humana.\n\n`;
        respuesta += `¿Hay algún principio específico sobre el que quieras saber más?`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'principios_unesco',
                nivel: 'intermedio',
                principiosMencionados: explicacion.principios.map(p => p.principio)
            }
        };
    }
    
    responderSobreFundamentos(preguntaOriginal) {
        const fundamentos = this.unescoPrinciples.fundamentos;
        
        let respuesta = `⚖️ **La ética, según el marco de la UNESCO, se fundamenta en:**\n\n`;
        
        Object.values(fundamentos).forEach((principio, index) => {
            respuesta += `• **${principio.principio}**: ${principio.descripcion}\n`;
        });
        
        respuesta += `\nEstos principios están interconectados y se aplican en:\n`;
        respuesta += `🔬 **Ciencia y tecnología** - Investigación responsable\n`;
        respuesta += `📚 **Educación** - Inclusiva y de calidad\n`;
        respuesta += `🎭 **Cultura** - Respeto a la diversidad\n`;
        respuesta += `💬 **Comunicación** - Información veraz y accesible\n\n`;
        respuesta += `La UNESCO promueve una ética universal que equilibra innovación con protección de derechos humanos.`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'fundamentos_eticos',
                enfoque: 'unesco',
                principios: Object.keys(fundamentos)
            }
        };
    }
    
    responderSobreAplicacion(preguntaOriginal) {
        const aplicaciones = this.unescoPrinciples.areasAplicacionUNESCO;
        
        let respuesta = `🔄 **Cómo se aplican los principios éticos de la UNESCO:**\n\n`;
        
        Object.entries(aplicaciones).forEach(([area, config]) => {
            const areaFormateada = this.formatearArea(area);
            respuesta += `**${areaFormateada}:**\n`;
            
            config.guias.slice(0, 2).forEach(guia => {
                respuesta += `   • ${guia}\n`;
            });
            
            respuesta += `   *Principios: ${config.principios.map(p => 
                this.unescoPrinciples.fundamentos[p].principio.substring(0, 20)
            ).join(', ')}...*\n\n`;
        });
        
        respuesta += `**Ejemplo práctico en IA:**\n`;
        const principiosIA = this.obtenerPrincipiosIAUNESCO();
        if (principiosIA && principiosIA.principios) {
            principiosIA.principios.slice(0, 3).forEach(principio => {
                respuesta += `   ✓ ${principio}\n`;
            });
        }
        
        respuesta += `\nLa aplicación ética requiere evaluación constante y adaptación al contexto.`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'aplicacion_practica',
                areas: Object.keys(aplicaciones),
                enfoque: 'práctico'
            }
        };
    }
    
    responderSobreDocumentos(preguntaOriginal) {
        const documentos = this.unescoPrinciples.documentosFundamentales;
        
        let respuesta = `📄 **Documentos fundamentales de ética de la UNESCO:**\n\n`;
        
        documentos.forEach((doc, index) => {
            respuesta += `${index + 1}. **${doc.nombre}**\n`;
            
            if (doc.puntosClave) {
                doc.puntosClave.slice(0, 3).forEach(punto => {
                    respuesta += `   • ${punto}\n`;
                });
            } else if (doc.principios) {
                doc.principios.slice(0, 3).forEach(principio => {
                    respuesta += `   • ${principio}\n`;
                });
            }
            
            respuesta += `\n`;
        });
        
        respuesta += `**Importancia:** Estos documentos establecen estándares internacionales para:\n`;
        respuesta += `• Protección de derechos humanos en avances científicos\n`;
        respuesta += `• Guías éticas para tecnologías emergentes\n`;
        respuesta += `• Cooperación internacional en ética aplicada\n\n`;
        respuesta += `¿Te interesa algún documento en particular?`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'documentos_unesco',
                cantidad: documentos.length,
                fechas: ['2005', '2021', '1948']
            }
        };
    }
    
    responderSobreIA(preguntaOriginal) {
        const principiosIA = this.obtenerPrincipiosIAUNESCO();
        
        if (!principiosIA) {
            return this.responderSobrePrincipios(preguntaOriginal);
        }
        
        let respuesta = `🤖 **Principios éticos de la UNESCO para Inteligencia Artificial:**\n\n`;
        respuesta += `**Documento:** ${principiosIA.documento}\n`;
        respuesta += `**Objetivo:** ${principiosIA.objetivo}\n\n`;
        
        respuesta += `**10 principios fundamentales:**\n`;
        principiosIA.principios.forEach((principio, index) => {
            respuesta += `${index + 1}. ${principio}\n`;
        });
        
        respuesta += `\n**Aplicación práctica:**\n`;
        respuesta += `🔒 **Protección de datos:** Privacidad desde el diseño\n`;
        respuesta += `⚖️ **No discriminación:** Algoritmos auditables y justos\n`;
        respuesta += `👁️ **Transparencia:** Sistemas explicables\n`;
        respuesta += `👥 **Participación:** Inclusión de diversas voces\n`;
        respuesta += `🔄 **Aprendizaje continuo:** Evaluación y mejora constante\n\n`;
        
        respuesta += `La UNESCO enfatiza que la IA debe estar al servicio del desarrollo sostenible y los derechos humanos.`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'etica_ia_unesco',
                principios: principiosIA.principios.length,
                enfoque: 'humanocéntrico'
            }
        };
    }
    
    responderSobreEticaGeneral(preguntaOriginal) {
        const explicacion = this.explicarPrincipiosUNESCO('basico');
        
        let respuesta = `⚖️ **La ética, desde la perspectiva de la UNESCO:**\n\n`;
        respuesta += `Es un marco para tomar decisiones que respeten la dignidad humana y promuevan el bien común.\n\n`;
        
        respuesta += `**Se basa en:**\n`;
        explicacion.principios.forEach(p => {
            respuesta += `• ${p.nombre}\n`;
        });
        
        respuesta += `\n**No es solo:**\n`;
        respuesta += `❌ Un conjunto de reglas rígidas\n`;
        respuesta += `❌ Solo para expertos\n`;
        respuesta += `❌ Igual en todas las culturas\n\n`;
        
        respuesta += `**Sí es:**\n`;
        respuesta += `✅ Un proceso de reflexión constante\n`;
        respuesta += `✅ Aplicable por todos\n`;
        respuesta += `✅ Respetuoso de la diversidad\n`;
        respuesta += `✅ Orientado al bienestar colectivo\n\n`;
        
        respuesta += `La UNESCO promueve una ética dialógica, donde diferentes perspectivas enriquecen la búsqueda de soluciones justas.`;
        
        return {
            respuesta: respuesta,
            metadata: {
                tipo: 'etica_general',
                enfoque: 'unesco',
                principios: explicacion.principios.length
            }
        };
    }
    
    // ========== INTEGRACIÓN EN EL ANÁLISIS ÉTICO ==========
    
    integrarPrincipiosUNESCOEnAnalisis(analisisEtico) {
        // Añadir referencia UNESCO a los principios detectados
        if (analisisEtico.principiosRelevantes && analisisEtico.principiosRelevantes.length > 0) {
            analisisEtico.principiosRelevantes.forEach(principio => {
                // Mapear principios propios a principios UNESCO
                const mapeoUNESCO = this.mapearPrincipioAUNESCO(principio.principio);
                if (mapeoUNESCO) {
                    principio.unesco = mapeoUNESCO;
                }
            });
        }
        
        // Añadir marco UNESCO al análisis
        analisisEtico.marcoUNESCO = {
            relevancia: this.calcularRelevanciaUNESCO(analisisEtico),
            principiosAplicables: this.identificarPrincipiosUNESCOAplicables(analisisEtico),
            documentoRelevante: this.identificarDocumentoRelevante(analisisEtico)
        };
        
        return analisisEtico;
    }
    
    mapearPrincipioAUNESCO(principioPropio) {
        const mapeo = {
            beneficencia: 'beneficio',
            noMaleficencia: 'beneficio', // Parte de beneficio/no maleficencia
            autonomia: 'autonomia',
            justicia: 'justicia',
            veracidad: 'responsabilidad' // Relacionado con transparencia
        };
        
        const principioUNESCOKey = mapeo[principioPropio];
        return principioUNESCOKey ? this.unescoPrinciples.fundamentos[principioUNESCOKey] : null;
    }
    
    calcularRelevanciaUNESCO(analisisEtico) {
        let relevancia = 0.5;
        
        // Aumentar relevancia si involucra derechos humanos
        if (analisisEtico.analisis?.area === 'privacidad' || 
            analisisEtico.analisis?.area === 'sesgo') {
            relevancia += 0.3;
        }
        
        // Aumentar si es tema tecnológico
        if (analisisEtico.analisis?.contexto?.includes('tecnología') ||
            analisisEtico.analisis?.contexto?.includes('digital')) {
            relevancia += 0.2;
        }
        
        return Math.min(relevancia, 0.9);
    }
    
    identificarPrincipiosUNESCOAplicables(analisisEtico) {
        const principios = [];
        
        // Siempre incluir dignidad humana
        principios.push(this.unescoPrinciples.fundamentos.dignidadHumana.principio);
        
        // Añadir según análisis
        if (analisisEtico.analisis?.nivelComplejidad >= 2) {
            principios.push(this.unescoPrinciples.fundamentos.responsabilidad.principio);
        }
        
        if (analisisEtico.analisis?.area === 'justicia' || 
            analisisEtico.principiosRelevantes?.some(p => p.principio === 'justicia')) {
            principios.push(this.unescoPrinciples.fundamentos.justicia.principio);
        }
        
        return principios.slice(0, 3);
    }
    
    identificarDocumentoRelevante(analisisEtico) {
        // Determinar documento UNESCO más relevante
        if (analisisEtico.analisis?.contexto?.includes('IA') ||
            analisisEtico.analisis?.contexto?.includes('inteligencia artificial')) {
            return this.unescoPrinciples.documentosFundamentales[1]; // Recomendación IA
        }
        
        if (analisisEtico.analisis?.area === 'privacidad' ||
            analisisEtico.analisis?.area === 'sesgo') {
            return this.unescoPrinciples.documentosFundamentales[0]; // Bioética
        }
        
        return this.unescoPrinciples.documentosFundamentales[2]; // DUDH
    }
    
    // ========== ACTUALIZAR PROCESAMIENTO ÉTICO ==========
    
    procesarConsultaEticaIntegrada(mensajeUsuario, contexto = {}) {
        // Primero, verificar si es pregunta específica sobre ética UNESCO
        const esPreguntaUNESCO = this.detectarPreguntaEspecificaUNESCO(mensajeUsuario);
        
        if (esPreguntaUNESCO) {
            const respuestaUNESCO = this.generarRespuestaEticaUNESCO(mensajeUsuario, contexto);
            return {
                esEtica: true,
                tipo: 'unesco_especifico',
                respuestaUNESCO: respuestaUNESCO,
                metadata: {
                    tipoConsulta: 'principios_unesco',
                    nivel: 'educativo'
                }
            };
        }
        
        // Procesamiento ético normal (tu código existente)
        // ... y al final integrar UNESCO
        const resultadoNormal = this.resolverDilema(mensajeUsuario, contexto);
        
        if (resultadoNormal.esDilema) {
            const resultadoConUNESCO = this.integrarPrincipiosUNESCOEnAnalisis(resultadoNormal);
            
            // Actualizar respuesta para incluir mención a UNESCO si es relevante
            if (resultadoConUNESCO.marcoUNESCO.relevancia > 0.6) {
                resultadoConUNESCO.respuestaUNESCO = this.añadirReferenciaUNESCO(
                    resultadoNormal.respuesta,
                    resultadoConUNESCO.marcoUNESCO
                );
            }
            
            return resultadoConUNESCO;
        }
        
        return resultadoNormal;
    }
    
    detectarPreguntaEspecificaUNESCO(mensaje) {
        const lower = mensaje.toLowerCase();
        
        const patronesUNESCO = [
            /(ética.*unesco|unesco.*ética)/i,
            /(principio.*ético.*unesco)/i,
            /(en.*qué.*se.*basa.*la.*ética)/i,
            /(fundamento.*ético.*internacional)/i,
            /(declaración.*universal.*bioética)/i,
            /(ética.*de.*la.*organización)/i,
            /(qué.*es.*la.*ética.*según)/i
        ];
        
        return patronesUNESCO.some(patron => patron.test(lower));
    }
    
    añadirReferenciaUNESCO(respuestaOriginal, marcoUNESCO) {
        if (!respuestaOriginal) return respuestaOriginal;
        
        const referencia = `\n\n*Este análisis considera los principios éticos de la UNESCO, ` +
                         `especialmente ${marcoUNESCO.principiosAplicables.slice(0, 2).join(' y ')}.*`;
        
        return respuestaOriginal + referencia;
    }
}
