export class EthicsModule {
    constructor() {
        this.unescoPrinciples = {
            principios: [
                {
                    nombre: 'Dignidad Humana y Derechos Humanos',
                    descripcion: 'Respeto inherente a toda persona',
                    aplicaciones: ['Autonomía', 'Privacidad', 'No discriminación'],
                    ejemplos: ['Consentimiento informado', 'Protección datos', 'Igualdad oportunidades']
                },
                {
                    nombre: 'Beneficio y No Maleficencia',
                    descripcion: 'Maximizar beneficios, minimizar daños',
                    aplicaciones: ['Análisis riesgo-beneficio', 'Precaución', 'Bienestar'],
                    ejemplos: ['Pruebas clínicas éticas', 'Seguridad productos', 'Salud pública']
                },
                {
                    nombre: 'Autonomía y Consentimiento',
                    descripcion: 'Respeto a la capacidad de autodeterminación',
                    aplicaciones: ['Consentimiento libre', 'Información adecuada', 'Rechazo tratamiento'],
                    ejemplos: ['Consentimiento médico', 'Contratos claros', 'Elección informada']
                },
                {
                    nombre: 'Justicia y Equidad',
                    descripcion: 'Distribución justa de beneficios y cargas',
                    aplicaciones: ['Acceso equitativo', 'No explotación', 'Reparación daños'],
                    ejemplos: ['Salud universal', 'Educación accesible', 'Compensación justa']
                },
                {
                    nombre: 'Solidaridad y Cooperación',
                    descripcion: 'Apoyo mutuo y responsabilidad compartida',
                    aplicaciones: ['Cooperación internacional', 'Bien común', 'Apoyo vulnerable'],
                    ejemplos: ['Ayuda humanitaria', 'Investigación colaborativa', 'Redes apoyo']
                },
                {
                    nombre: 'Responsabilidad Social',
                    descripcion: 'Rendición de cuentas por acciones y consecuencias',
                    aplicaciones: ['Transparencia', 'Responsabilidad ambiental', 'Desarrollo sostenible'],
                    ejemplos: ['Informes impacto', 'Protección ambiental', 'Legado futuro']
                }
            ],
            documentosFundamentales: [
                { 
                    nombre: 'Declaración Universal de Derechos Humanos (1948)',
                    relevancia: 'fundamental',
                    articulosClave: [1, 3, 5, 12, 18, 19, 25],
                    resumen: 'Establece derechos básicos inalienables para todos los seres humanos'
                },
                { 
                    nombre: 'Declaración sobre Bioética y Derechos Humanos UNESCO (2005)',
                    relevancia: 'específica',
                    principios: ['Dignidad humana', 'Beneficio', 'Autonomía', 'Justicia'],
                    resumen: 'Aplica principios éticos a medicina, ciencias de la vida y tecnologías'
                },
                { 
                    nombre: 'Recomendación sobre Ética de la IA UNESCO (2021)',
                    relevancia: 'moderna',
                    pilares: ['Respeto derechos', 'Beneficio humano', 'Transparencia', 'Responsabilidad'],
                    resumen: 'Marco ético para desarrollo y uso responsable de inteligencia artificial'
                }
            ],
            marcosComplementarios: {
                principialismo: ['Autonomía', 'Beneficencia', 'No maleficencia', 'Justicia'],
                eticaVirtudes: ['Sabiduría práctica', 'Coraje', 'Templanza', 'Justicia'],
                utilitarismo: ['Maximizar felicidad', 'Minimizar sufrimiento', 'Consecuencias', 'Imparcialidad'],
                deontologia: ['Deber moral', 'Imperativo categórico', 'Universalidad', 'Respeto personas']
            }
        };
        
        this.totalConsultasEticas = 0;
        this.casosAnalizados = new Map();
        this.dilemasHistoricos = [];
        this.analisisProfundos = 0;
    }

    esConsultaEticaNatural(mensaje) {
        const lower = mensaje.toLowerCase();
        const palabrasClave = [
            'debería', 'ético', 'moral', 'correcto', 'incorrecto', 'dilema',
            'justo', 'injusto', 'responsabilidad', 'derecho', 'obligación',
            'permitido', 'prohibido', 'virtud', 'vicio', 'bueno', 'malo',
            'equitativo', 'imparcial', 'neutral', 'sesgo', 'prejuicio',
            'consentimiento', 'autonomía', 'dignidad', 'respeto', 'valor'
        ];
        
        const coincidencias = palabrasClave.filter(palabra => lower.includes(palabra)).length;
        const tienePreguntaEtica = /(está bien|es correcto|se debe|se puede)\b.*\?/i.test(mensaje);
        const mencionaDilema = /dilema (ético|moral)/i.test(mensaje);
        
        return coincidencias >= 2 || tienePreguntaEtica || mencionaDilema;
    }

    generarRespuestaEticaUNESCO(mensaje, contexto) {
        this.totalConsultasEticas++;
        this.analisisProfundos++;
        
        const principiosAplicables = this.identificarPrincipiosAplicables(mensaje);
        const documentoRelevante = this.seleccionarDocumentoRelevante(mensaje);
        const marcoComplementario = this.seleccionarMarcoComplementario(mensaje);
        
        // Análisis de conflicto de principios
        const conflictos = this.detectarConflictosPrincipios(principiosAplicables);
        const jerarquia = this.establecerJerarquiaPrincipios(contexto);
        
        const respuesta = {
            respuesta: this.construirRespuestaIntegrada(mensaje, principiosAplicables, conflictos, jerarquia),
            principiosAplicables: principiosAplicables.map(p => p.nombre),
            conflictosDetectados: conflictos,
            jerarquiaAplicada: jerarquia,
            documentoRelevante: documentoRelevante?.nombre,
            marcoComplementario: marcoComplementario,
            nivelComplejidad: this.calcularComplejidadEtica(mensaje),
            recomendaciones: this.generarRecomendacionesPracticas(principiosAplicables, contexto)
        };
        
        // Registrar caso para aprendizaje
        this.registrarCasoEtico({
            mensaje,
            contexto,
            principiosAplicables,
            fecha: new Date().toISOString(),
            complejidad: respuesta.nivelComplejidad
        });
        
        return respuesta;
    }

    identificarPrincipiosAplicables(mensaje) {
        const lower = mensaje.toLowerCase();
        const principiosAplicables = [];
        
        this.unescoPrinciples.principios.forEach((principio, index) => {
            let relevancia = 0;
            
            // Palabras clave específicas por principio
            const keywords = {
                0: ['dignidad', 'derecho humano', 'respeto', 'valor humano', 'persona'],
                1: ['beneficio', 'daño', 'maleficencia', 'ayudar', 'perjudicar', 'riesgo'],
                2: ['autonomía', 'consentimiento', 'elección', 'decisión', 'libre', 'voluntad'],
                3: ['justicia', 'equidad', 'igualdad', 'imparcial', 'justo', 'distribución'],
                4: ['solidaridad', 'cooperación', 'colaboración', 'ayuda mutua', 'comunidad'],
                5: ['responsabilidad', 'consecuencia', 'rendición cuentas', 'transparencia', 'sostenible']
            };
            
            // Verificar palabras clave
            if (keywords[index]) {
                keywords[index].forEach(keyword => {
                    if (lower.includes(keyword)) {
                        relevancia += 1;
                    }
                });
            }
            
            // Verificar aplicaciones
            principio.aplicaciones.forEach(aplicacion => {
                if (lower.includes(aplicacion.toLowerCase())) {
                    relevancia += 0.5;
                }
            });
            
            if (relevancia > 0) {
                principiosAplicables.push({
                    ...principio,
                    relevancia,
                    indice: index
                });
            }
        });
        
        // Ordenar por relevancia
        return principiosAplicables.sort((a, b) => b.relevancia - a.relevancia);
    }

    seleccionarDocumentoRelevante(mensaje) {
        const lower = mensaje.toLowerCase();
        
        // Priorizar por contenido específico
        if (lower.includes('derecho humano') || lower.includes('dignidad humana')) {
            return this.unescoPrinciples.documentosFundamentales[0];
        }
        if (lower.includes('bioética') || lower.includes('médico') || lower.includes('salud')) {
            return this.unescoPrinciples.documentosFundamentales[1];
        }
        if (lower.includes('inteligencia artificial') || lower.includes('algoritmo') || lower.includes('tecnología')) {
            return this.unescoPrinciples.documentosFundamentales[2];
        }
        
        // Documento por defecto
        return this.unescoPrinciples.documentosFundamentales[1];
    }

    seleccionarMarcoComplementario(mensaje) {
        const lower = mensaje.toLowerCase();
        
        if (lower.includes('virtud') || lower.includes('carácter') || lower.includes('excelencia')) {
            return 'ética de virtudes';
        }
        if (lower.includes('consecuencia') || lower.includes('utilidad') || lower.includes('felicidad')) {
            return 'utilitarismo';
        }
        if (lower.includes('deber') || lower.includes('obligación') || lower.includes('imperativo')) {
            return 'deontología';
        }
        if (lower.includes('principio') && lower.includes('autonomía')) {
            return 'principialismo';
        }
        
        return null;
    }

    detectarConflictosPrincipios(principios) {
        if (principios.length < 2) return [];
        
        const conflictos = [];
        const posiblesConflictos = [
            { a: 'Autonomía', b: 'Beneficio', escenario: 'Paciente rechaza tratamiento beneficioso' },
            { a: 'Justicia', b: 'Autonomía', escenario: 'Distribución recursos vs elección individual' },
            { a: 'Responsabilidad', b: 'Beneficio', escenario: 'Innovación vs precaución' },
            { a: 'Solidaridad', b: 'Autonomía', escenario: 'Bien común vs libertad individual' }
        ];
        
        principios.forEach(p1 => {
            principios.forEach(p2 => {
                if (p1.indice !== p2.indice) {
                    const conflicto = posiblesConflictos.find(c => 
                        (c.a.includes(p1.nombre.split(' ')[0]) && c.b.includes(p2.nombre.split(' ')[0])) ||
                        (c.b.includes(p1.nombre.split(' ')[0]) && c.a.includes(p2.nombre.split(' ')[0]))
                    );
                    
                    if (conflicto && !conflictos.some(c => 
                        (c.principioA === p1.nombre && c.principioB === p2.nombre) ||
                        (c.principioA === p2.nombre && c.principioB === p1.nombre)
                    )) {
                        conflictos.push({
                            principioA: p1.nombre,
                            principioB: p2.nombre,
                            tipo: 'tensión ética',
                            escenarioTipico: conflicto.escenario,
                            sugerencia: this.generarSugerenciaConflicto(p1, p2)
                        });
                    }
                }
            });
        });
        
        return conflictos;
    }

    generarSugerenciaConflicto(principioA, principioB) {
        const sugerencias = {
            'Autonomía-Beneficio': 'Buscar equilibrio entre respetar decisiones personales y promover bienestar, posiblemente mediante educación y consentimiento informado.',
            'Justicia-Autonomía': 'Considerar sistemas que respeten elecciones individuales mientras aseguran acceso equitativo para todos.',
            'Responsabilidad-Beneficio': 'Adoptar enfoque de precaución progresiva, evaluando riesgos cuidadosamente sin detener innovación beneficiosa.',
            'Solidaridad-Autonomía': 'Fomentar decisiones que beneficien tanto al individuo como a la comunidad, buscando sinergias.'
        };
        
        const key = `${principioA.nombre.split(' ')[0]}-${principioB.nombre.split(' ')[0]}`;
        const keyInversa = `${principioB.nombre.split(' ')[0]}-${principioA.nombre.split(' ')[0]}`;
        
        return sugerencias[key] || sugerencias[keyInversa] || 
               'Buscar punto de equilibrio que honre ambos valores éticos en la medida posible.';
    }

    establecerJerarquiaPrincipios(contexto) {
        // Jerarquía contextual - puede variar según situación
        const jerarquias = {
            salud: ['Dignidad', 'Beneficio', 'Autonomía', 'Justicia', 'Responsabilidad', 'Solidaridad'],
            tecnologia: ['Responsabilidad', 'Dignidad', 'Justicia', 'Beneficio', 'Autonomía', 'Solidaridad'],
            educacion: ['Justicia', 'Dignidad', 'Beneficio', 'Autonomía', 'Solidaridad', 'Responsabilidad'],
            negocios: ['Responsabilidad', 'Justicia', 'Dignidad', 'Beneficio', 'Autonomía', 'Solidaridad'],
            ambiental: ['Responsabilidad', 'Solidaridad', 'Justicia', 'Beneficio', 'Dignidad', 'Autonomía']
        };
        
        // Determinar contexto
        let contextoEspecifico = 'general';
        if (contexto.mensaje?.includes('salud') || contexto.mensaje?.includes('médico')) contextoEspecifico = 'salud';
        if (contexto.mensaje?.includes('tecnología') || contexto.mensaje?.includes('digital')) contextoEspecifico = 'tecnologia';
        if (contexto.mensaje?.includes('educación') || contexto.mensaje?.includes('enseñanza')) contextoEspecifico = 'educacion';
        if (contexto.mensaje?.includes('negocio') || contexto.mensaje?.includes('empresa')) contextoEspecifico = 'negocios';
        if (contexto.mensaje?.includes('medio ambiente') || contexto.mensaje?.includes('ecológico')) contextoEspecifico = 'ambiental';
        
        return {
            jerarquia: jerarquias[contextoEspecifico] || jerarquias.salud,
            contexto: contextoEspecifico,
            flexible: true,
            nota: 'La jerarquía es guía, no regla absoluta. Cada situación requiere balance único.'
        };
    }

    calcularComplejidadEtica(mensaje) {
        let complejidad = 0;
        
        // Factores de complejidad
        const principios = this.identificarPrincipiosAplicables(mensaje);
        complejidad += principios.length * 0.2;
        
        const conflictos = this.detectarConflictosPrincipios(principios);
        complejidad += conflictos.length * 0.3;
        
        // Complejidad lingüística
        const oraciones = mensaje.split(/[.!?]+/).length;
        const palabras = mensaje.split(/\s+/).length;
        complejidad += Math.min(0.3, palabras / 100);
        
        // Preguntas retóricas o profundas
        if (/(qué significa|por qué existe|cuál es el sentido)/i.test(mensaje)) {
            complejidad += 0.2;
        }
        
        return Math.min(1, complejidad);
    }

    construirRespuestaIntegrada(mensaje, principios, conflictos, jerarquia) {
        let respuesta = "Analizando desde la perspectiva ética de UNESCO...\n\n";
        
        if (principios.length > 0) {
            respuesta += "**Principios aplicables:**\n";
            principios.forEach((p, i) => {
                respuesta += `${i+1}. **${p.nombre}**: ${p.descripcion}\n`;
                if (p.aplicaciones && p.aplicaciones.length > 0) {
                    respuesta += `   Aplicaciones: ${p.aplicaciones.slice(0, 2).join(', ')}\n`;
                }
            });
            respuesta += "\n";
        }
        
        if (conflictos.length > 0) {
            respuesta += "**Tensiones éticas identificadas:**\n";
            conflictos.forEach((c, i) => {
                respuesta += `• ${c.principioA} vs ${c.principioB}: ${c.sugerencia}\n`;
            });
            respuesta += "\n";
        }
        
        respuesta += `**Enfoque sugerido:**\n`;
        respuesta += `Priorizando ${jerarquia.jerarquia[0]} en contexto ${jerarquia.contexto}, `;
        respuesta += `pero considerando balance con ${jerarquia.jerarquia.slice(1, 3).join(' y ')}.\n\n`;
        
        respuesta += "**Preguntas para reflexión:**\n";
        respuesta += "1. ¿Qué valores están en mayor riesgo?\n";
        respuesta += "2. ¿Quiénes podrían verse afectados y cómo?\n";
        respuesta += "3. ¿Existen alternativas que honren más principios?\n";
        respuesta += "4. ¿Qué consecuencias a largo plazo considerar?\n";
        
        return respuesta;
    }

    generarRecomendacionesPracticas(principios, contexto) {
        const recomendaciones = [];
        
        principios.forEach(principio => {
            switch(principio.indice) {
                case 0: // Dignidad
                    recomendaciones.push("Asegurar que todas las personas involucradas sean tratadas con respeto inherente");
                    recomendaciones.push("Evitar lenguaje o acciones que puedan menoscabar la dignidad humana");
                    break;
                case 1: // Beneficio
                    recomendaciones.push("Realizar análisis de riesgo-beneficio considerando todas las partes");
                    recomendaciones.push("Implementar medidas para maximizar beneficios y minimizar daños");
                    break;
                case 2: // Autonomía
                    recomendaciones.push("Proveer información completa y comprensible para decisiones informadas");
                    recomendaciones.push("Respetar el derecho a aceptar o rechazar, incluso si difiere de tu opinión");
                    break;
                case 3: // Justicia
                    recomendaciones.push("Evaluar distribución equitativa de beneficios y cargas");
                    recomendaciones.push("Considerar necesidades especiales de grupos vulnerables");
                    break;
                case 4: // Solidaridad
                    recomendaciones.push("Buscar soluciones que fortalezcan la cooperación y apoyo mutuo");
                    recomendaciones.push("Incluir perspectivas diversas en la toma de decisiones");
                    break;
                case 5: // Responsabilidad
                    recomendaciones.push("Establecer mecanismos claros de rendición de cuentas");
                    recomendaciones.push("Considerar impactos a largo plazo y sostenibilidad");
                    break;
            }
        });
        
        return [...new Set(recomendaciones)].slice(0, 5);
    }

    registrarCasoEtico(caso) {
        const id = `caso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.casosAnalizados.set(id, {
            ...caso,
            id,
            principiosCount: caso.principiosAplicables?.length || 0,
            aprendido: false
        });
        
        // Mantener solo los últimos 100 casos
        if (this.casosAnalizados.size > 100) {
            const keys = Array.from(this.casosAnalizados.keys());
            this.casosAnalizados.delete(keys[0]);
        }
        
        // Aprender de casos similares
        this.aprenderDeCasosSimilares(caso);
    }

    aprenderDeCasosSimilares(casoNuevo) {
        const casosSimilares = [];
        
        this.casosAnalizados.forEach((caso, id) => {
            if (caso.id === casoNuevo.id) return;
            
            const similitud = this.calcularSimilitudCasos(caso, casoNuevo);
            if (similitud > 0.6) {
                casosSimilares.push({ caso, similitud, id });
            }
        });
        
        if (casosSimilares.length > 0) {
            // Ordenar por similitud
            casosSimilares.sort((a, b) => b.similitud - a.similitud);
            
            // Aprender del más similar
            const casoSimilar = casosSimilares[0];
            this.actualizarPatrones(casoSimilar.caso, casoNuevo);
        }
    }

    calcularSimilitudCasos(caso1, caso2) {
        let similitud = 0;
        
        // Similitud de principios
        const principios1 = caso1.principiosAplicables?.map(p => p.nombre) || [];
        const principios2 = caso2.principiosAplicables?.map(p => p.nombre) || [];
        
        const principiosComunes = principios1.filter(p => principios2.includes(p)).length;
        const principiosTotales = new Set([...principios1, ...principios2]).size;
        
        if (principiosTotales > 0) {
            similitud += (principiosComunes / principiosTotales) * 0.5;
        }
        
        // Similitud de complejidad
        const diffComplejidad = Math.abs((caso1.complejidad || 0) - (caso2.complejidad || 0));
        similitud += (1 - diffComplejidad) * 0.3;
        
        // Similitud contextual (simplificada)
        if (caso1.contexto?.tipo === caso2.contexto?.tipo) {
            similitud += 0.2;
        }
        
        return Math.min(1, similitud);
    }

    actualizarPatrones(casoExistente, casoNuevo) {
        // Aquí se implementaría aprendizaje más sofisticado
        // Por ahora, simplemente marcamos como aprendido
        if (casoExistente.id) {
            const caso = this.casosAnalizados.get(casoExistente.id);
            if (caso) {
                caso.aprendido = true;
                caso.vecesReferenciado = (caso.vecesReferenciado || 0) + 1;
            }
        }
    }

    procesarConsultaEticaIntegrada(mensaje, contexto) {
        const esEtica = this.esConsultaEticaNatural(mensaje);
        
        if (!esEtica) {
            return {
                esEtica: false,
                tipo: 'no_etico',
                confianza: 0.1
            };
        }
        
        const principios = this.identificarPrincipiosAplicables(mensaje);
        const conflictos = this.detectarConflictosPrincipios(principios);
        const complejidad = this.calcularComplejidadEtica(mensaje);
        
        // Determinar tipo de consulta ética
        let tipo = 'general';
        if (principios.length === 0) tipo = 'indeterminado';
        if (conflictos.length > 0) tipo = 'dilema_complejo';
        if (complejidad > 0.7) tipo = 'profundo';
        if (mensaje.toLowerCase().includes('unesco')) tipo = 'marco_unesco';
        
        const respuestaUNESCO = this.generarRespuestaEticaUNESCO(mensaje, {
            ...contexto,
            tipoConsulta: tipo
        });
        
        return {
            esEtica: true,
            tipo,
            confianza: Math.min(0.95, 0.3 + principios.length * 0.1 + complejidad * 0.2),
            principiosIdentificados: principios.map(p => p.nombre),
            conflictosDetectados: conflictos.length,
            complejidad,
            respuestaUNESCO: respuestaUNESCO.respuesta,
            analisis: {
                principios,
                conflictos,
                jerarquia: this.establecerJerarquiaPrincipios(contexto),
                recomendaciones: this.generarRecomendacionesPracticas(principios, contexto)
            }
        };
    }

    explicarPrincipiosUNESCO(nivel = 'basico') {
        const explicacion = {
            basico: {
                titulo: "Principios Éticos Fundamentales de UNESCO",
                descripcion: "Marco universal para la toma de decisiones éticas",
                principios: this.unescoPrinciples.principios.map(p => ({
                    nombre: p.nombre,
                    resumen: p.descripcion
                }))
            },
            intermedio: {
                titulo: "Principios UNESCO con Aplicaciones",
                descripcion: "Comprensión profunda con ejemplos prácticos",
                principios: this.unescoPrinciples.principios.map(p => ({
                    nombre: p.nombre,
                    descripcion: p.descripcion,
                    aplicaciones: p.aplicaciones.slice(0, 3),
                    ejemplo: p.ejemplos[0]
                }))
            },
            avanzado: {
                titulo: "Marco Ético Integral UNESCO",
                descripcion: "Análisis completo con conflictos y jerarquías",
                principios: this.unescoPrinciples.principios.map(p => p),
                documentos: this.unescoPrinciples.documentosFundamentales,
                marcos: this.unescoPrinciples.marcosComplementarios,
                estadisticas: {
                    totalConsultas: this.totalConsultasEticas,
                    casosAnalizados: this.casosAnalizados.size,
                    analisisProfundos: this.analisisProfundos
                }
            }
        };
        
        return explicacion[nivel] || explicacion.basico;
    }

    obtenerEstadisticasConversacionales() {
        const principiosUsados = new Set();
        const tiposConsulta = new Map();
        
        this.casosAnalizados.forEach(caso => {
            caso.principiosAplicables?.forEach(p => {
                principiosUsados.add(p.nombre);
            });
            
            const tipo = caso.contexto?.tipoConsulta || 'general';
            tiposConsulta.set(tipo, (tiposConsulta.get(tipo) || 0) + 1);
        });
        
        return {
            totalConsultasEticas: this.totalConsultasEticas,
            principiosUtilizados: principiosUsados.size,
            casosAnalizados: this.casosAnalizados.size,
            analisisProfundos: this.analisisProfundos,
            distribucionTipos: Object.fromEntries(tiposConsulta),
            efectividad: this.calcularEfectividad()
        };
    }

    calcularEfectividad() {
        if (this.totalConsultasEticas === 0) return 0;
        
        // Métrica simple de efectividad
        const casosConPrincipios = Array.from(this.casosAnalizados.values())
            .filter(c => c.principiosAplicables?.length > 0).length;
        
        const efectividadDeteccion = casosConPrincipios / this.casosAnalizados.size || 0;
        const efectividadComplejidad = this.analisisProfundos / this.totalConsultasEticas;
        
        return Math.min(1, (efectividadDeteccion * 0.6 + efectividadComplejidad * 0.4));
    }

    detectarPreguntaEspecificaUNESCO(mensaje) {
        const lower = mensaje.toLowerCase();
        
        const preguntasDirectas = [
            /en.*qué.*se.*basa.*(ética|principios)/i,
            /cuál.*es.*tu.*(marco|base).*ético/i,
            /tienes.*(ética|principios|valores)/i,
            /unesco.*(ética|principios)/i,
            /declaración.*(derechos|bioética)/i,
            /organización.*(ética|unesco)/i,
            /qué.*principio.*(sigues|sigues)/i,
            /basas.*tu.*(moral|ética)/i
        ];
        
        return preguntasDirectas.some(regex => regex.test(lower));
    }

    // Nuevo: Sistema de dilemas éticos históricos
    obtenerDilemaHistorico(relevancia = 'alta') {
        const dilemas = {
            tranvia: {
                nombre: "Problema del Tranvía",
                descripcion: "Un tranvía fuera de control se dirige hacia 5 personas atadas a la vía. Puedes accionar un cambio que lo desvía a otra vía donde hay 1 persona. ¿Debes hacerlo?",
                analisis: {
                    utilitarismo: "Sacrificar 1 para salvar 5 maximiza la felicidad total",
                    deontologia: "Usar a alguien como medio es inmoral, independientemente de las consecuencias",
                    eticaVirtudes: "Una persona virtuosa buscaría tercera opción o aceptaría responsabilidad completa"
                }
            },
            prisionero: {
                nombre: "Dilema del Prisionero Iterado",
                descripcion: "Dos prisioneros son interrogados separadamente. Si ambos cooperan (no confiesan), reciben 1 año. Si uno traiciona y el otro coopera, el traidor sale libre y el cooperador recibe 3 años. Si ambos traicionan, reciben 2 años.",
                leccion: "La cooperación a largo plazo genera mejores resultados que la traición egoísta"
            },
            heinz: {
                nombre: "Dilema de Heinz",
                descripcion: "La esposa de Heinz está muriendo de cáncer. Un fármaco podría salvarla, pero el farmacéutico cobra 10 veces su costo. Heinz no tiene dinero. ¿Debe robar el medicamento?",
                nivelesKohlberg: {
                    preconvencional: "Robar si no lo atrapan",
                    convencional: "Seguir la ley siempre",
                    postconvencional: "La vida vale más que la propiedad"
                }
            }
        };
        
        return dilemas.tranvia; // Por defecto
    }

    // Nuevo: Generador de escenarios éticos
    generarEscenarioEtico(nivel = 'medio') {
        const escenarios = {
            facil: {
                titulo: "Encontré una billetera",
                descripcion: "Encontraste una billetera con $500 y documentos de identidad. ¿Qué haces?",
                principios: ['Justicia', 'Responsabilidad'],
                opciones: [
                    "Quedarte con el dinero y tirar la billetera",
                    "Quedarte con el dinero pero devolver documentos",
                    "Devolver todo contactando al dueño",
                    "Llevar a la policía sin contactar al dueño"
                ]
            },
            medio: {
                titulo: "Error a tu favor",
                descripcion: "El banco depositó $1000 extra en tu cuenta por error. Necesitas el dinero para una emergencia médica. ¿Qué haces?",
                principios: ['Justicia', 'Autonomía', 'Beneficio'],
                conflictos: ['Justicia vs Beneficio personal']
            },
            avanzado: {
                titulo: "Algoritmo de contratación",
                descripcion: "Diseñas un algoritmo de contratación que es 15% más efectivo pero tiene un sesgo leve contra ciertos grupos demográficos. ¿Lo implementas?",
                principios: ['Justicia', 'Responsabilidad', 'Beneficio', 'No discriminación'],
                dimensiones: ['Eficiencia vs Equidad', 'Innovación vs Precaución', 'Beneficio empresarial vs Bien social']
            }
        };
        
        return escenarios[nivel] || escenarios.medio;
    }
}
