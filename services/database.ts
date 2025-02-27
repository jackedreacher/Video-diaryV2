import * as SQLite from 'expo-sqlite';
import { VideoEntry } from '../stores/useVideoStore';
import { generateUUID } from '../utils/helpers';

const db = SQLite.openDatabaseSync('videodiary.db');

// Version tracking for migrations
const CURRENT_DB_VERSION = 4;

interface DbVersion {
  version: number;
}

interface CategoryDB {
  id: string;
  key: string;
  name: string;
  icon: string;
  color: string;
}

interface CoreMemory {
  videoId: string;
  note: string;
  color: string;
  createdAt: string;
  typeId: string;
}

interface CustomMemoryType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// Add this helper function at the top of the file
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add this retry function
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error instanceof Error && error.message.includes('database table is locked')) {
        console.log(`Database locked, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}

// First, create an interface for the DatabaseService
interface IDatabaseService {
  setup(): Promise<void>;
  getCategories(): Promise<CategoryDB[]>;
  addVideo(video: VideoEntry): Promise<string>;
  getVideos(categoryId?: string): Promise<VideoEntry[]>;
  deleteVideo(id: string): Promise<void>;
  updateVideo(id: string, updates: Partial<VideoEntry>): Promise<void>;
  clearDatabase(): Promise<void>;
  getCoreMemories(): Promise<CoreMemory[]>;
  addCoreMemory(memory: CoreMemory): Promise<void>;
  updateCoreMemory(videoId: string, updates: Partial<CoreMemory>): Promise<void>;
  deleteCoreMemory(videoId: string): Promise<void>;
  addCategory(category: CategoryDB): Promise<void>;
  updateCategory(id: string, updates: Partial<CategoryDB>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  getCustomMemoryTypes(): Promise<CustomMemoryType[]>;
  addCustomMemoryType(type: CustomMemoryType): Promise<void>;
  updateCustomMemoryType(id: string, updates: Partial<CustomMemoryType>): Promise<void>;
  deleteCustomMemoryType(id: string): Promise<void>;
  migrateCategoryKeys(): Promise<void>;
}

// Create the DatabaseService class
class DatabaseServiceImpl implements IDatabaseService {
  private static instance: DatabaseServiceImpl;
  private _isInitialized: boolean = false;
  private _initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseServiceImpl {
    if (!DatabaseServiceImpl.instance) {
      DatabaseServiceImpl.instance = new DatabaseServiceImpl();
    }
    return DatabaseServiceImpl.instance;
  }

  private async verifyDatabaseHealth(): Promise<boolean> {
    try {
      const tables = await db.getAllAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('categories', 'videos', 'core_memories', 'custom_memory_types', 'db_version');
      `);
      const requiredTables = ['categories', 'videos', 'core_memories', 'custom_memory_types', 'db_version'];
      const existingTables = tables.map(t => t.name);
      return requiredTables.every(table => existingTables.includes(table));
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }

  private async resetDatabase(): Promise<void> {
    try {
      await db.execAsync('BEGIN TRANSACTION;');
      
      // Drop all tables
      await db.execAsync(`
        DROP TABLE IF EXISTS core_memories;
        DROP TABLE IF EXISTS videos;
        DROP TABLE IF EXISTS custom_memory_types;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS db_version;
      `);
      
      await db.execAsync('COMMIT;');
      
      // Reset state
      this._isInitialized = false;
      this._initializationPromise = null;
      
      console.log('✅ Database reset completed');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }

  public async setup(): Promise<void> {
    // If already initialized and database is healthy, return
    if (this._isInitialized) {
      const isHealthy = await this.verifyDatabaseHealth();
      if (isHealthy) {
        return;
      }
      // If not healthy, reset initialization state
      this._isInitialized = false;
      console.log('⚠️ Database health check failed, reinitializing...');
    }

    // If there's an ongoing initialization, wait for it
    if (this._initializationPromise) {
      try {
        await this._initializationPromise;
        const isHealthy = await this.verifyDatabaseHealth();
        if (isHealthy) {
          return;
        }
      } catch (error) {
        this._initializationPromise = null;
        console.error('❌ Previous initialization failed:', error);
      }
    }

    // Start new initialization
    this._initializationPromise = (async () => {
      try {
        // Enable foreign keys and WAL mode for better concurrent access
        await db.execAsync('PRAGMA foreign_keys = ON;');
        await db.execAsync('PRAGMA journal_mode = WAL;');

        // Verify database state and reset if necessary
        const isHealthy = await this.verifyDatabaseHealth();
        if (!isHealthy) {
          console.log('⚠️ Database in inconsistent state, performing reset...');
          await this.resetDatabase();
        }

        // Initialize schema with retry mechanism
        await retryOperation(async () => {
          const tablesExist = await db.getAllAsync(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='db_version';
          `);

          if (tablesExist.length === 0) {
            await this.createInitialSchema();
          } else {
            const version = await db.getAllAsync<DbVersion>('SELECT version FROM db_version;');
            if (version[0].version < CURRENT_DB_VERSION) {
              await this.handleMigration(version[0].version);
            }
          }
        }, 3, 1000); // 3 retries, 1 second delay

        // Verify final state
        const finalCheck = await this.verifyDatabaseHealth();
        if (!finalCheck) {
          throw new Error('Database initialization verification failed');
        }

        this._isInitialized = true;
        console.log('✅ Database initialized and verified successfully');
      } catch (error) {
        this._initializationPromise = null;
        this._isInitialized = false;
        console.error('❌ Database initialization failed:', error);
        throw error;
      }
    })();

    return this._initializationPromise;
  }

  private async createInitialSchema(): Promise<void> {
    // Enable foreign key support
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Begin transaction
    await db.execAsync('BEGIN TRANSACTION;');

    try {
      // Create version table first
      await db.execAsync('CREATE TABLE IF NOT EXISTS db_version (version INTEGER PRIMARY KEY);');
      await db.execAsync(`INSERT OR REPLACE INTO db_version (version) VALUES (${CURRENT_DB_VERSION});`);

      // Create categories table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL
        );
      `);

      // Create videos table with foreign key
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          uri TEXT NOT NULL,
          thumbnail TEXT NOT NULL,
          duration INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          startTime INTEGER NOT NULL DEFAULT 0,
          endTime INTEGER NOT NULL DEFAULT 60,
          categoryId TEXT,
          FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
        );
      `);

      // Create core_memories table with foreign key
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS core_memories (
          videoId TEXT PRIMARY KEY,
          note TEXT NOT NULL,
          color TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          typeId TEXT NOT NULL,
          FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
        );
      `);

      // Create custom_memory_types table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS custom_memory_types (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL
        );
      `);

      // Insert default categories
      await db.execAsync(`
        INSERT OR IGNORE INTO categories (id, key, name, icon, color)
        VALUES 
          ('all', 'all', 'All', 'grid-outline', '#FFB6C1'),
          ('friends', 'friends', 'Friends', 'people-outline', '#ADD8E6'),
          ('family', 'family', 'Family', 'heart-outline', '#98FB98'),
          ('travel', 'travel', 'Travel', 'airplane-outline', '#DDA0DD'),
          ('special', 'special', 'Special', 'star-outline', '#FFD700');
      `);

      // Commit transaction
      await db.execAsync('COMMIT;');
      console.log('✅ Initial schema created successfully');
    } catch (error) {
      // Rollback on error
      await db.execAsync('ROLLBACK;');
      console.error('❌ Error creating initial schema:', error);
      throw error;
    }
  }

  private async handleMigration(fromVersion: number): Promise<void> {
    if (fromVersion < 2) {
      await db.execAsync('ALTER TABLE categories ADD COLUMN key TEXT;');
    }
    await db.execAsync(`UPDATE db_version SET version = ${CURRENT_DB_VERSION};`);
  }

  private async ensureSetup(): Promise<void> {
    try {
      await this.setup();
      const isHealthy = await this.verifyDatabaseHealth();
      if (!isHealthy) {
        throw new Error('Database health check failed after setup');
      }
    } catch (error) {
      console.error('❌ Database setup verification failed:', error);
      throw error;
    }
  }

  public async getCategories(): Promise<CategoryDB[]> {
    try {
      await this.ensureSetup();
      return await db.getAllAsync('SELECT * FROM categories ORDER BY name;');
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  }

  public async getVideos(categoryId?: string): Promise<VideoEntry[]> {
    try {
      await this.ensureSetup();
      const query = categoryId && categoryId !== 'all'
        ? 'SELECT * FROM videos WHERE categoryId = ? ORDER BY createdAt DESC;'
        : 'SELECT * FROM videos ORDER BY createdAt DESC;';
      
      const params = categoryId && categoryId !== 'all' ? [categoryId] : [];
      return await db.getAllAsync<VideoEntry>(query, params);
    } catch (error) {
      console.error('❌ Error fetching videos:', error);
      return [];
    }
  }

  public async addVideo(video: VideoEntry): Promise<string> {
    try {
      await this.ensureSetup();
      await db.execAsync('BEGIN TRANSACTION;');
      
      try {
        // Check if ID exists
        const existing = await db.getAllAsync(
          'SELECT id FROM videos WHERE id = ?;',
          [video.id]
        );

        // Generate new ID if exists
        const videoToInsert = {
          ...video,
          id: existing.length > 0 ? generateUUID() : video.id
        };

        await db.runAsync(
          `INSERT INTO videos (id, uri, thumbnail, duration, createdAt, title, description, startTime, endTime, categoryId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            videoToInsert.id,
            videoToInsert.uri,
            videoToInsert.thumbnail,
            videoToInsert.duration,
            videoToInsert.createdAt,
            videoToInsert.title,
            videoToInsert.description ?? null,
            videoToInsert.startTime,
            videoToInsert.endTime,
            videoToInsert.categoryId ?? 'all'
          ]
        );

        await db.execAsync('COMMIT;');
        console.log(`✅ Video added: ${videoToInsert.title}`);
        return videoToInsert.id;
      } catch (error) {
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    } catch (error) {
      console.error('❌ Error adding video:', error);
      throw error;
    }
  }

  public async deleteVideo(id: string): Promise<void> {
    try {
      await db.runAsync('DELETE FROM videos WHERE id = ?;', [id]);
      console.log(`✅ Video deleted: ${id}`);
    } catch (error) {
      console.error('❌ Error deleting video:', error);
      throw error;
    }
  }

  public async updateVideo(id: string, updates: Partial<VideoEntry>): Promise<void> {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return; // Nothing to update

      const values = Object.values(updates);
      const query = `UPDATE videos SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;

      await db.runAsync(query, [...values, id]);
      console.log(`✅ Video updated: ${id}`);
    } catch (error) {
      console.error('❌ Error updating video:', error);
      throw error;
    }
  }

  public async clearDatabase(): Promise<void> {
    try {
      // Begin transaction
      await db.execAsync('BEGIN TRANSACTION;');

      try {
        // Drop tables in correct order (respecting foreign key constraints)
        await db.execAsync(`
          DROP TABLE IF EXISTS core_memories;
          DROP TABLE IF EXISTS videos;
          DROP TABLE IF EXISTS custom_memory_types;
          DROP TABLE IF EXISTS categories;
          DROP TABLE IF EXISTS db_version;
        `);

        // Reset initialization state
        this._isInitialized = false;
        this._initializationPromise = null;

        // Commit transaction
        await db.execAsync('COMMIT;');

        // Reinitialize database with fresh tables
        await this.setup();
        
        console.log('✅ Database cleared and reinitialized successfully');
      } catch (error) {
        // Rollback on error
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    } catch (error) {
      console.error('❌ Error clearing database:', error);
      throw error;
    }
  }

  public async getCoreMemories(): Promise<CoreMemory[]> {
    try {
      return await db.getAllAsync<CoreMemory>('SELECT * FROM core_memories ORDER BY createdAt DESC;');
    } catch (error) {
      console.error('❌ Error fetching core memories:', error);
      return [];
    }
  }

  public async addCoreMemory(memory: CoreMemory): Promise<void> {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO core_memories (videoId, note, color, createdAt, typeId) VALUES (?, ?, ?, ?, ?);`,
        [memory.videoId, memory.note, memory.color, memory.createdAt, memory.typeId]
      );
      console.log(`✅ Core memory added for video: ${memory.videoId}`);
    } catch (error) {
      console.error('❌ Error adding core memory:', error);
      throw error;
    }
  }

  public async updateCoreMemory(videoId: string, updates: Partial<CoreMemory>): Promise<void> {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return;

      const values = Object.values(updates);
      const query = `UPDATE core_memories SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE videoId = ?`;

      await db.runAsync(query, [...values, videoId]);
      console.log(`✅ Core memory updated: ${videoId}`);
    } catch (error) {
      console.error('❌ Error updating core memory:', error);
      throw error;
    }
  }

  public async deleteCoreMemory(videoId: string): Promise<void> {
    try {
      await db.runAsync('DELETE FROM core_memories WHERE videoId = ?;', [videoId]);
      console.log(`✅ Core memory deleted: ${videoId}`);
    } catch (error) {
      console.error('❌ Error deleting core memory:', error);
      throw error;
    }
  }

  public async addCategory(category: CategoryDB): Promise<void> {
    try {
      const query = `
        INSERT INTO categories (id, key, name, icon, color)
        VALUES (?, ?, ?, ?, ?)
      `;
      await db.runAsync(query, [
        category.id,
        category.key,
        category.name,
        category.icon,
        category.color
      ]);
      console.log('✅ Category added:', category.name);
    } catch (error) {
      console.error('❌ Error adding category:', error);
      throw error;
    }
  }

  public async updateCategory(id: string, updates: Partial<CategoryDB>): Promise<void> {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return;

      const values = Object.values(updates);
      const query = `UPDATE categories SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;

      await db.runAsync(query, [...values, id]);
      console.log(`✅ Category updated: ${id}`);
    } catch (error) {
      console.error('❌ Error updating category:', error);
      throw error;
    }
  }

  public async deleteCategory(id: string): Promise<void> {
    try {
      // Start transaction
      await db.execAsync('BEGIN TRANSACTION;');
      
      try {
        // Update videos in this category to 'all'
        await db.runAsync(
          'UPDATE videos SET categoryId = "all" WHERE categoryId = ?;',
          [id]
        );
        
        // Delete the category
        await db.runAsync('DELETE FROM categories WHERE id = ?;', [id]);
        
        // Commit transaction
        await db.execAsync('COMMIT;');
        console.log(`✅ Category deleted: ${id}`);
      } catch (error) {
        // Rollback on error
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    } catch (error) {
      console.error('❌ Error deleting category:', error);
      throw error;
    }
  }

  public async getCustomMemoryTypes(): Promise<CustomMemoryType[]> {
    try {
      return await db.getAllAsync<CustomMemoryType>('SELECT * FROM custom_memory_types ORDER BY name;');
    } catch (error) {
      console.error('❌ Error fetching custom memory types:', error);
      return [];
    }
  }

  public async addCustomMemoryType(type: CustomMemoryType): Promise<void> {
    try {
      await db.runAsync(
        `INSERT INTO custom_memory_types (id, name, icon, color) VALUES (?, ?, ?, ?);`,
        [type.id, type.name, type.icon, type.color]
      );
      console.log(`✅ Custom memory type added: ${type.name}`);
    } catch (error) {
      console.error('❌ Error adding custom memory type:', error);
      throw error;
    }
  }

  public async updateCustomMemoryType(id: string, updates: Partial<CustomMemoryType>): Promise<void> {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return;

      const values = Object.values(updates);
      const query = `UPDATE custom_memory_types SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;

      await db.runAsync(query, [...values, id]);
      console.log(`✅ Custom memory type updated: ${id}`);
    } catch (error) {
      console.error('❌ Error updating custom memory type:', error);
      throw error;
    }
  }

  public async deleteCustomMemoryType(id: string): Promise<void> {
    try {
      await db.runAsync('DELETE FROM custom_memory_types WHERE id = ?;', [id]);
      console.log(`✅ Custom memory type deleted: ${id}`);
    } catch (error) {
      console.error('❌ Error deleting custom memory type:', error);
      throw error;
    }
  }

  public async migrateCategoryKeys(): Promise<void> {
    try {
      await db.runAsync('ALTER TABLE categories ADD COLUMN key TEXT');
      const categories = await db.getAllAsync<CategoryDB>('SELECT * FROM categories');
      
      for (const category of categories) {
        const key = category.name.toLowerCase().replace(/\s+/g, '_');
        await db.runAsync(
          'UPDATE categories SET key = ? WHERE id = ?',
          [key, category.id]
        );
      }
      console.log('✅ Category keys migration completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

// Export the singleton instance
export const DatabaseService = DatabaseServiceImpl.getInstance();
