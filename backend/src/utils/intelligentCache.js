/**
 * INTELLIGENT CACHE SYSTEM
 * Sistema de cache con límites, TTL y limpieza automática para prevenir memory leaks
 */

class IntelligentCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 15 * 60 * 1000; // 15 minutos
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutos

    this.cache = new Map();
    this.accessCount = new Map(); // Para LRU
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      cleanups: 0,
      totalSets: 0
    };

    // Iniciar limpieza automática
    this.startCleanupTimer();
  }

  /**
   * Almacenar un valor en el cache
   */
  set(key, value, customTTL = null) {
    const ttl = customTTL || this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    // Si el cache está lleno, liberar espacio usando LRU
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    const cacheItem = {
      value,
      expiresAt,
      createdAt: Date.now(),
      accessCount: 0
    };

    this.cache.set(key, cacheItem);
    this.accessCount.set(key, 0);
    this.stats.totalSets++;

    return true;
  }

  /**
   * Obtener un valor del cache
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Verificar si expiró
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Actualizar estadísticas de acceso (LRU)
    item.accessCount++;
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);

    this.stats.hits++;
    return item.value;
  }

  /**
   * Verificar si existe una clave (sin actualizar LRU)
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    // Verificar si expiró
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Eliminar una clave específica
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    this.accessCount.delete(key);
    return deleted;
  }

  /**
   * Limpiar cache expirado y realizar mantenimiento
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.accessCount.delete(key);
        expiredCount++;
      }
    }

    this.stats.cleanups++;

    return {
      expiredItems: expiredCount,
      remainingItems: this.cache.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Limpiar todo el cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessCount.clear();
    return size;
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      cleanups: this.stats.cleanups,
      totalSets: this.stats.totalSets,
      utilizationPercent: ((this.cache.size / this.maxSize) * 100).toFixed(1)
    };
  }

  /**
   * Obtener información detallada de las claves
   */
  getKeyInfo() {
    const keys = [];
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      keys.push({
        key,
        ageSeconds: Math.floor((now - item.createdAt) / 1000),
        ttlSeconds: Math.floor((item.expiresAt - now) / 1000),
        accessCount: item.accessCount,
        expired: now > item.expiresAt
      });
    }

    return keys.sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Evict Least Recently Used item
   */
  _evictLRU() {
    if (this.cache.size === 0) return;

    // Encontrar la clave con menor acceso
    let lruKey = null;
    let minAccess = Infinity;

    for (const [key, accessCount] of this.accessCount.entries()) {
      if (accessCount < minAccess) {
        minAccess = accessCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessCount.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Iniciar timer de limpieza automática
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Detener timer de limpieza automática
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Configurar cache con múltiples valores
   */
  mset(entries) {
    const results = [];
    for (const [key, value, ttl] of entries) {
      results.push(this.set(key, value, ttl));
    }
    return results;
  }

  /**
   * Obtener múltiples valores
   */
  mget(keys) {
    const results = {};
    for (const key of keys) {
      results[key] = this.get(key);
    }
    return results;
  }

  /**
   * Actualizar TTL de una clave existente
   */
  updateTTL(key, newTTL) {
    const item = this.cache.get(key);
    if (!item) return false;

    item.expiresAt = Date.now() + newTTL;
    return true;
  }

  /**
   * Obtener tiempo restante de una clave
   */
  getRemainingTTL(key) {
    const item = this.cache.get(key);
    if (!item) return -1;

    const remaining = item.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}

module.exports = IntelligentCache;