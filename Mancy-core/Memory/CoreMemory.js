// memory/CoreMemory.js
const SQLite = require('better-sqlite3');
const path = require('path');

class CoreMemory {
    constructor() {
        // Conectar a SQLite (simple, eficiente, persistente)
        this.db = new SQLite(path.join(__dirname, '../memory.db'));
        this.initDatabase();
        
        // Memoria a corto plazo (en RAM, para velocidad)
        this.shortTerm = new Map(); // sessionId -> datos
        this.userContexts = new Map(); // userId -> contexto actual
    }
    
    initDatabase() {
        // Tabla de usuarios (quiénes son)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                interaction_count INTEGER DEFAULT 0,
                preferences TEXT DEFAULT '{}'
            )
        `);
        
        // Tabla de conversaciones (qué se habló)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                session_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_message TEXT,
                bot_response TEXT,
                context TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Tabla de hechos importantes (qué sabe Mancy sobre cada usuario)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                fact TEXT,
                category TEXT,
                confidence REAL DEFAULT 1.0,
                source TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used DATETIME,
                usage_count INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Tabla de estado de Mancy (su propia "mente")
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS mancy_state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Memoria inicializada');
    }
    
    // ================== USUARIOS ==================
    
    async getUser(userId) {
        // Buscar en memoria corta primero
        if (this.userContexts.has(userId)) {
            return this.userContexts.get(userId);
        }
        
        // Buscar en base de datos
        const user = this.db.prepare(
            'SELECT * FROM users WHERE id = ?'
        ).get(userId);
        
        if (user) {
            // Parsear preferencias
            user.preferences = JSON.parse(user.preferences || '{}');
            // Guardar en memoria corta
            this.userContexts.set(userId, user);
            return user;
        }
        
        // Si no existe, crear usuario nuevo
        return this.createUser(userId);
    }
    
    async createUser(userId, name = 'Usuario') {
        const newUser = {
            id: userId,
            name: name,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            interaction_count: 0,
            preferences: {}
        };
        
        this.db.prepare(`
            INSERT OR IGNORE INTO users (id, name) 
            VALUES (?, ?)
        `).run(userId, name);
        
        this.userContexts.set(userId, newUser);
        return newUser;
    }
    
    async updateUser(userId, updates) {
        const user = await this.getUser(userId);
        
        if (updates.name) {
            this.db.prepare(
                'UPDATE users SET name = ? WHERE id = ?'
            ).run(updates.name, userId);
        }
        
        if (updates.preferences) {
            const prefString = JSON.stringify({
                ...user.preferences,
                ...updates.preferences
            });
            this.db.prepare(
                'UPDATE users SET preferences = ? WHERE id = ?'
            ).run(prefString, userId);
        }
        
        // Actualizar last_seen y contar interacción
        this.db.prepare(`
            UPDATE users 
            SET last_seen = CURRENT_TIMESTAMP,
                interaction_count = interaction_count + 1
            WHERE id = ?
        `).run(userId);
        
        // Actualizar memoria corta
        this.userContexts.delete(userId);
        return await this.getUser(userId);
    }
    
    // ================== CONVERSACIONES ==================
    
    async saveConversation(userId, sessionId, userMsg, botResp, context = {}) {
        const contextStr = JSON.stringify(context);
        
        this.db.prepare(`
            INSERT INTO conversations 
            (user_id, session_id, user_message, bot_response, context)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, sessionId, userMsg, botResp, contextStr);
        
        // Mantener solo últimas 1000 conversaciones por usuario
        this.db.prepare(`
            DELETE FROM conversations 
            WHERE id NOT IN (
                SELECT id FROM conversations 
                WHERE user_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1000
            ) AND user_id = ?
        `).run(userId, userId);
        
        console.log(`💾 Conversación guardada para ${userId}`);
    }
    
    async getRecentConversations(userId, limit = 10) {
        const rows = this.db.prepare(`
            SELECT * FROM conversations 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `).all(userId, limit);
        
        return rows.map(row => ({
            ...row,
            context: JSON.parse(row.context || '{}')
        }));
    }
    
    async getConversationContext(userId, windowSize = 5) {
        const recent = await this.getRecentConversations(userId, windowSize);
        
        return {
            recentMessages: recent,
            summary: this.summarizeConversations(recent),
            topics: this.extractTopics(recent)
        };
    }
    
    // ================== HECHOS (FACTS) ==================
    
    async learnFact(userId, fact, category, confidence = 1.0, source = 'conversation') {
        // Verificar si ya existe un hecho similar
        const existing = this.db.prepare(`
            SELECT * FROM facts 
            WHERE user_id = ? AND fact LIKE ? 
            LIMIT 1
        `).get(userId, `%${fact.substring(0, 20)}%`);
        
        if (existing) {
            // Actualizar confianza y uso
            const newConfidence = (existing.confidence + confidence) / 2;
            this.db.prepare(`
                UPDATE facts 
                SET confidence = ?, 
                    last_used = CURRENT_TIMESTAMP,
                    usage_count = usage_count + 1
                WHERE id = ?
            `).run(newConfidence, existing.id);
            return false; // Ya existía
        }
        
        // Insertar nuevo hecho
        this.db.prepare(`
            INSERT INTO facts 
            (user_id, fact, category, confidence, source)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, fact, category, confidence, source);
        
        console.log(`🧠 Nuevo hecho aprendido: ${fact.substring(0, 50)}...`);
        return true;
    }
    
    async getRelevantFacts(userId, query = '', limit = 5) {
        let sql = `
            SELECT * FROM facts 
            WHERE user_id = ? 
            ORDER BY last_used DESC, usage_count DESC 
            LIMIT ?
        `;
        
        let params = [userId, limit];
        
        if (query) {
            sql = `
                SELECT * FROM facts 
                WHERE user_id = ? AND (
                    fact LIKE ? OR 
                    category LIKE ?
                )
                ORDER BY confidence DESC 
                LIMIT ?
            `;
            params = [userId, `%${query}%`, `%${query}%`, limit];
        }
        
        const rows = this.db.prepare(sql).all(...params);
        return rows;
    }
    
    // ================== MEMORIA DE CORTO PLAZO ==================
    
    startSession(sessionId, initialContext = {}) {
        this.shortTerm.set(sessionId, {
            started: new Date(),
            context: initialContext,
            messages: [],
            metadata: {}
        });
        
        return sessionId;
    }
    
    addToSession(sessionId, role, content) {
        const session = this.shortTerm.get(sessionId);
        if (!session) return;
        
        session.messages.push({
            role: role,
            content: content,
            timestamp: new Date()
        });
        
        // Mantener solo últimos 20 mensajes en memoria corta
        if (session.messages.length > 20) {
            session.messages.shift();
        }
    }
    
    getSession(sessionId) {
        return this.shortTerm.get(sessionId);
    }
    
    // ================== UTILIDADES ==================
    
    summarizeConversations(conversations) {
        if (conversations.length === 0) return "Sin conversaciones previas";
        
        const lastMsg = conversations[0];
        const timeAgo = this.timeSince(new Date(lastMsg.timestamp));
        
        return `Última conversación ${timeAgo}: "${lastMsg.user_message.substring(0, 50)}..."`;
    }
    
    extractTopics(conversations) {
        // Simple extractor de temas (puedes mejorarlo después)
        const topics = new Set();
        const commonTopics = ['trabajo', 'familia', 'música', 'programación', 'videojuegos', 'escuela'];
        
        conversations.forEach(conv => {
            const msg = conv.user_message.toLowerCase();
            commonTopics.forEach(topic => {
                if (msg.includes(topic)) {
                    topics.add(topic);
                }
            });
        });
        
        return Array.from(topics);
    }
    
    timeSince(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " años";
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " meses";
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " días";
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " horas";
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutos";
        
        return Math.floor(seconds) + " segundos";
    }
    
    // ================== ESTADO DE MANCY ==================
    
    async getMancyState(key) {
        const row = this.db.prepare(
            'SELECT value FROM mancy_state WHERE key = ?'
        ).get(key);
        
        return row ? JSON.parse(row.value) : null;
    }
    
    async setMancyState(key, value) {
        const valueStr = JSON.stringify(value);
        
        this.db.prepare(`
            INSERT OR REPLACE INTO mancy_state (key, value)
            VALUES (?, ?)
        `).run(key, valueStr);
    }
    
    // ================== MÉTODOS DE MANTENIMIENTO ==================
    
    cleanupOldData(daysToKeep = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        
        this.db.prepare(`
            DELETE FROM conversations 
            WHERE timestamp < ?
        `).run(cutoff.toISOString());
        
        console.log(`🧹 Datos antiguos limpiados (manteniendo últimos ${daysToKeep} días)`);
    }
    
    getStats() {
        const userCount = this.db.prepare(
            'SELECT COUNT(*) as count FROM users'
        ).get().count;
        
        const convCount = this.db.prepare(
            'SELECT COUNT(*) as count FROM conversations'
        ).get().count;
        
        const factCount = this.db.prepare(
            'SELECT COUNT(*) as count FROM facts'
        ).get().count;
        
        return {
            users: userCount,
            conversations: convCount,
            facts: factCount,
            shortTermSessions: this.shortTerm.size
        };
    }
}

module.exports = CoreMemory;
