import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../database/connection';
import {
  Persona,
  CreatePersonaRequest,
  UpdatePersonaRequest,
  PersonaResponse,
  PersonaSummary,
  PaginationOptions,
  FilterOptions,
} from '../models';
import { DatabaseError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';
import { BaseRepository } from './BaseRepository';

export class PersonaRepository extends BaseRepository<
  Persona,
  CreatePersonaRequest,
  UpdatePersonaRequest
> {
  protected readonly tableName = 'personas';

  /**
   * Map database row to Persona object
   */
  protected mapRowToEntity(row: RowDataPacket): Persona {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      systemPrompt: row.system_prompt,
      personalityTraits: row.personality_traits ? JSON.parse(row.personality_traits) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDefault: row.is_default,
      usageCount: row.usage_count || 0,
    };
  }

  /**
   * Create a new persona
   */
  async create(personaData: CreatePersonaRequest): Promise<Persona> {
    try {
      const id = this.generateId();

      // If this is set as default, unset other defaults for this user
      if (personaData.isDefault) {
        await this.unsetDefaultForUser(personaData.userId);
      }

      const query = `
        INSERT INTO ${this.tableName} 
        (id, user_id, name, description, system_prompt, personality_traits, is_default) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        id,
        personaData.userId,
        personaData.name,
        personaData.description || null,
        personaData.systemPrompt,
        personaData.personalityTraits ? JSON.stringify(personaData.personalityTraits) : null,
        personaData.isDefault || false,
      ];

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new DatabaseError('Failed to create persona');
      }

      // Fetch and return the created persona
      const createdPersona = await this.findById(id);
      if (!createdPersona) {
        throw new DatabaseError('Persona created but could not be retrieved');
      }

      logger.info(`Persona created successfully: ${personaData.name} (${id})`);
      return createdPersona;
    } catch (error) {
      logger.error('Error creating persona:', error);
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to create persona');
    }
  }

  /**
   * Update persona
   */
  async update(id: string, personaData: UpdatePersonaRequest): Promise<Persona> {
    try {
      // Get current persona to check ownership
      const currentPersona = await this.findById(id);
      if (!currentPersona) {
        throw new NotFoundError('Persona not found');
      }

      // If setting as default, unset other defaults for this user
      if (personaData.isDefault) {
        await this.unsetDefaultForUser(currentPersona.userId);
      }

      const updateFields: string[] = [];
      const params: any[] = [];

      if (personaData.name !== undefined) {
        updateFields.push('name = ?');
        params.push(personaData.name);
      }

      if (personaData.description !== undefined) {
        updateFields.push('description = ?');
        params.push(personaData.description);
      }

      if (personaData.systemPrompt !== undefined) {
        updateFields.push('system_prompt = ?');
        params.push(personaData.systemPrompt);
      }

      if (personaData.personalityTraits !== undefined) {
        updateFields.push('personality_traits = ?');
        params.push(
          personaData.personalityTraits ? JSON.stringify(personaData.personalityTraits) : null
        );
      }

      if (personaData.isDefault !== undefined) {
        updateFields.push('is_default = ?');
        params.push(personaData.isDefault);
      }

      if (updateFields.length === 0) {
        throw new DatabaseError('No fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `
        UPDATE ${this.tableName} 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, params);

      if (result.affectedRows === 0) {
        throw new NotFoundError('Persona not found');
      }

      const updatedPersona = await this.findById(id);
      if (!updatedPersona) {
        throw new DatabaseError('Persona updated but could not be retrieved');
      }

      logger.info(`Persona updated successfully: ${id}`);
      return updatedPersona;
    } catch (error) {
      logger.error('Error updating persona:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error instanceof DatabaseError ? error : new DatabaseError('Failed to update persona');
    }
  }

  /**
   * Find personas by user ID with pagination and filtering
   */
  async findByUserId(userId: string, options: PaginationOptions = {}, filters: FilterOptions = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'ASC' } = options;
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions: string[] = ['user_id = ?'];
      const queryParams: any[] = [userId];

      if (filters.search) {
        whereConditions.push('(name LIKE ? OR description LIKE ?)');
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm);
      }

      if (filters.startDate) {
        whereConditions.push('created_at >= ?');
        queryParams.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push('created_at <= ?');
        queryParams.push(filters.endDate);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Count total records
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`;
      const [countRows] = await db.execute<RowDataPacket[]>(countQuery, queryParams);
      const total = (countRows[0] as any).total;

      // Get paginated data
      const dataQuery = `
        SELECT * FROM ${this.tableName} 
        ${whereClause}
        ORDER BY is_default DESC, ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;
      const [dataRows] = await db.execute<RowDataPacket[]>(dataQuery, [
        ...queryParams,
        limit,
        offset,
      ]);

      const data = dataRows.map(row => this.mapRowToEntity(row));
      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error finding personas by user ID:', error);
      throw new DatabaseError('Failed to find personas');
    }
  }

  /**
   * Find default persona for user
   */
  async findDefaultByUserId(userId: string): Promise<Persona | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE user_id = ? AND is_default = TRUE`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [userId]);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(rows[0]);
    } catch (error) {
      logger.error('Error finding default persona:', error);
      throw new DatabaseError('Failed to find default persona');
    }
  }

  /**
   * Get persona summaries for user (lightweight data for dropdowns)
   */
  async getPersonaSummaries(userId: string): Promise<PersonaSummary[]> {
    try {
      const query = `
        SELECT id, name, description, is_default, usage_count
        FROM ${this.tableName} 
        WHERE user_id = ?
        ORDER BY is_default DESC, name ASC
      `;
      const [rows] = await db.execute<RowDataPacket[]>(query, [userId]);

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isDefault: row.is_default,
        usageCount: row.usage_count || 0,
      }));
    } catch (error) {
      logger.error('Error getting persona summaries:', error);
      throw new DatabaseError('Failed to get persona summaries');
    }
  }

  /**
   * Increment usage count for persona
   */
  async incrementUsageCount(id: string): Promise<void> {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const [result] = await db.execute<ResultSetHeader>(query, [id]);

      if (result.affectedRows === 0) {
        logger.warn(`Attempted to increment usage count for non-existent persona: ${id}`);
      } else {
        logger.debug(`Incremented usage count for persona: ${id}`);
      }
    } catch (error) {
      logger.error('Error incrementing persona usage count:', error);
      // Don't throw error for this non-critical operation
    }
  }

  /**
   * Check if persona belongs to user
   */
  async belongsToUser(id: string, userId: string): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE id = ? AND user_id = ?`;
      const [rows] = await db.execute<RowDataPacket[]>(query, [id, userId]);

      return (rows[0] as any).count > 0;
    } catch (error) {
      logger.error('Error checking persona ownership:', error);
      throw new DatabaseError('Failed to check persona ownership');
    }
  }

  /**
   * Delete persona and handle references
   */
  async deleteWithReferences(id: string, userId: string): Promise<void> {
    try {
      await this.executeTransaction(async connection => {
        // Verify ownership
        const checkQuery = 'SELECT user_id, is_default FROM personas WHERE id = ?';
        const [checkRows] = await connection.execute(checkQuery, [id]) as [RowDataPacket[], any];

        if (checkRows.length === 0) {
          throw new NotFoundError('Persona not found');
        }

        if (checkRows[0].user_id !== userId) {
          throw new NotFoundError('Persona not found');
        }

        const isDefault = checkRows[0].is_default;

        // Update conversations that reference this persona
        await connection.execute(
          'UPDATE conversations SET current_persona_id = NULL WHERE current_persona_id = ?',
          [id]
        );

        // Update messages that reference this persona
        await connection.execute('UPDATE messages SET persona_id = NULL WHERE persona_id = ?', [
          id,
        ]);

        // Delete the persona
        await connection.execute('DELETE FROM personas WHERE id = ?', [id]);

        // If this was the default persona, set another one as default if available
        if (isDefault) {
          await connection.execute(
            'UPDATE personas SET is_default = TRUE WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
            [userId]
          );
        }

        logger.info(`Persona and references updated: ${id}`);
      });
    } catch (error) {
      logger.error('Error deleting persona with references:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete persona');
    }
  }

  /**
   * Unset default flag for all personas of a user
   */
  private async unsetDefaultForUser(userId: string): Promise<void> {
    try {
      const query = `UPDATE ${this.tableName} SET is_default = FALSE WHERE user_id = ?`;
      await db.execute(query, [userId]);
    } catch (error) {
      logger.error('Error unsetting default personas:', error);
      throw new DatabaseError('Failed to unset default personas');
    }
  }

  /**
   * Convert persona to response format
   */
  toPersonaResponse(persona: Persona): PersonaResponse {
    return {
      id: persona.id,
      userId: persona.userId,
      name: persona.name,
      description: persona.description,
      systemPrompt: persona.systemPrompt,
      personalityTraits: persona.personalityTraits,
      createdAt: persona.createdAt,
      updatedAt: persona.updatedAt,
      isDefault: persona.isDefault,
      usageCount: persona.usageCount,
    };
  }
}
