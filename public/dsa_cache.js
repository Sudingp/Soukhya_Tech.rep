// lib/dsa_cache.js — High-Performance DSA Engine
// Zero dependencies: Doubly-Linked List + Map LRU Cache with Active/Passive TTL,
// Prefix Trie Search, and Early-Exit Vector Distance Algorithms.

class LRUNode {
  constructor(key, value, expiresAt = null, tags = []) {
    this.key = key;
    this.value = value;
    this.expiresAt = expiresAt; // Timestamp in ms or null
    this.tags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor({ capacity = 2000, defaultTTL = 300000, sweepInterval = 30000 } = {}) {
    this.capacity = Math.max(1, capacity);
    this.defaultTTL = defaultTTL; // Default 5 minutes in ms
    this.map = new Map(); // key -> LRUNode
    this.tagIndex = new Map(); // tag -> Set<key>

    // Dummy head and tail for clean O(1) pointer updates
    this.head = new LRUNode(null, null);
    this.tail = new LRUNode(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // Metrics
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;

    // Active sweep timer
    if (sweepInterval > 0 && typeof setInterval !== 'undefined') {
      this._timer = setInterval(() => this.pruneExpired(), sweepInterval);
      if (this._timer.unref) this._timer.unref(); // Don't hold Node process open
    }
  }

  // ── Doubly Linked List Operations O(1) ──────────
  _attachNode(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _detachNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = null;
    node.next = null;
  }

  _moveToHead(node) {
    this._detachNode(node);
    this._attachNode(node);
  }

  _indexTags(key, tags) {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(key);
    }
  }

  _unindexTags(key, tags) {
    for (const tag of tags) {
      const set = this.tagIndex.get(tag);
      if (set) {
        set.delete(key);
        if (set.size === 0) this.tagIndex.delete(tag);
      }
    }
  }

  // ── Public Cache API ───────────────────────────
  get(key) {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return null;
    }

    // Passive TTL expiration check
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    this._moveToHead(node);
    return node.value;
  }

  set(key, value, ttlMs = null, tags = []) {
    const effectiveTTL = ttlMs !== null ? ttlMs : this.defaultTTL;
    const expiresAt = effectiveTTL > 0 ? Date.now() + effectiveTTL : null;

    let node = this.map.get(key);
    if (node) {
      this._unindexTags(key, node.tags);
      node.value = value;
      node.expiresAt = expiresAt;
      node.tags = Array.isArray(tags) ? tags : [tags];
      this._indexTags(key, node.tags);
      this._moveToHead(node);
      return this;
    }

    // New node insertion
    node = new LRUNode(key, value, expiresAt, tags);
    this.map.set(key, node);
    this._indexTags(key, node.tags);
    this._attachNode(node);

    // Eviction if over capacity O(1)
    if (this.map.size > this.capacity) {
      const oldest = this.tail.prev;
      if (oldest && oldest !== this.head) {
        this.delete(oldest.key);
        this.evictions++;
      }
    }

    return this;
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;

    this._detachNode(node);
    this._unindexTags(key, node.tags);
    this.map.delete(key);
    return true;
  }

  has(key) {
    const node = this.map.get(key);
    if (!node) return false;
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  clear() {
    this.map.clear();
    this.tagIndex.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // Invalidate all keys tagged with a specific tag (e.g. "employees")
  invalidateTag(tag) {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;
    let count = 0;
    for (const key of Array.from(keys)) {
      if (this.delete(key)) count++;
    }
    return count;
  }

  // Invalidate all keys matching a prefix string (e.g. "emp:")
  invalidateByPrefix(prefix) {
    let count = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        if (this.delete(key)) count++;
      }
    }
    return count;
  }

  // Active sweep of all expired keys
  pruneExpired() {
    const now = Date.now();
    let pruned = 0;
    for (const [key, node] of this.map.entries()) {
      if (node.expiresAt && now > node.expiresAt) {
        this.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    return {
      size: this.map.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate.toFixed(2)}%`,
      evictions: this.evictions
    };
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this.clear();
  }
}

// ── Prefix Trie for Instant Lookup O(L) ──────────
class TrieNode {
  constructor() {
    this.children = new Map();
    this.values = new Set();
    this.isTerminal = false;
  }
}

class PrefixTrie {
  constructor() {
    this.root = new TrieNode();
    this.size = 0;
  }

  insert(word, ref) {
    if (!word) return;
    const clean = String(word).trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
      current.values.add(ref);
    }
    current.isTerminal = true;
    this.size++;
  }

  search(prefix) {
    if (!prefix) return [];
    const clean = String(prefix).trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char);
    }

    return Array.from(current.values);
  }

  clear() {
    this.root = new TrieNode();
    this.size = 0;
  }
}

// ── Biometric Vector Math with Early-Cutoff ───────
class VectorComparator {
  // Cosine distance between two normalized 128-d vectors (range 0.0 to 2.0)
  // Distance = 1.0 - dot_product
  static cosineDistance(a, b) {
    if (!a || !b || a.length !== b.length) return 1.0;
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    const len = a.length;

    for (let i = 0; i < len; i++) {
      const ai = a[i];
      const bi = b[i];
      dot += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    if (normA === 0 || normB === 0) return 1.0;
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0.0, 1.0 - sim);
  }

  // Euclidean Distance with Early Cutoff:
  // If accumulated sum of squared differences exceeds maxDist^2, abort immediately.
  static euclideanDistanceEarlyCutoff(a, b, maxDist = 0.6) {
    if (!a || !b || a.length !== b.length) return 999.0;
    const maxSq = maxDist * maxDist;
    let sumSq = 0.0;
    const len = a.length;

    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
      if (sumSq > maxSq) {
        return 999.0; // Early exit: distance already exceeds threshold
      }
    }

    return Math.sqrt(sumSq);
  }
}

// Universal export for Node.js CommonJS & Browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LRUCache, PrefixTrie, VectorComparator };
} else if (typeof window !== 'undefined') {
  window.LRUCache = LRUCache;
  window.PrefixTrie = PrefixTrie;
  window.VectorComparator = VectorComparator;
}
