// Base Model Class - Common database operations
const { supabase } = require('../lib/supabaseClient');
const { v4: uuidv4 } = require('uuid');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.supabase = supabase;
  }

  // Create a new record
  async create(data) {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert({
          id: uuidv4(),
          ...data,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
    }
  }

  // Find record by ID
  async findById(id) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by ID: ${error.message}`);
    }
  }

  // Find multiple records with filters
  async findMany(filters = {}, options = {}) {
    try {
      let query = this.supabase.from(this.tableName).select('*');

      // Apply filters
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined) {
          query = query.eq(key, filters[key]);
        }
      });

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending !== false });
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName}: ${error.message}`);
    }
  }

  // Update record by ID
  async updateById(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
    }
  }

  // Delete record by ID (soft delete if column exists)
  async deleteById(id) {
    try {
      // Check if table has deleted_at column for soft delete
      const { data: tableInfo } = await this.supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', this.tableName)
        .eq('column_name', 'deleted_at');

      if (tableInfo && tableInfo.length > 0) {
        // Soft delete
        return await this.updateById(id, { deleted_at: new Date().toISOString() });
      } else {
        // Hard delete
        const { data, error } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
    }
  }

  // Count records with filters
  async count(filters = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined) {
          query = query.eq(key, filters[key]);
        }
      });

      const { count, error } = await query;

      if (error) throw error;
      return count;
    } catch (error) {
      throw new Error(`Failed to count ${this.tableName}: ${error.message}`);
    }
  }

  // Execute custom query
  async executeQuery(queryBuilder) {
    try {
      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }
}

module.exports = BaseModel;