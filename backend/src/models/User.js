// User Model - Handle user operations
const BaseModel = require('./BaseModel');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('email', email)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  // Create user with validation
  async createUser(userData) {
    try {
      // Validate required fields
      if (!userData.email || !userData.name) {
        throw new Error('Email and name are required');
      }

      // Check if user already exists
      const existingUser = await this.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const user = await this.create({
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user',
        user_type: userData.user_type || 'individual',
        verification_status: userData.verification_status || 'pending',
        phone_number: userData.phone_number,
        address: userData.address,
        preferences: userData.preferences || {}
      });

      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Update user profile
  async updateProfile(userId, updates) {
    try {
      const allowedFields = [
        'name', 'phone_number', 'address', 'preferences', 
        'user_type', 'verification_status'
      ];
      
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      return await this.updateById(userId, filteredUpdates);
    } catch (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  // Update last login
  async updateLastLogin(userId) {
    try {
      return await this.updateById(userId, {
        last_login: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  }

  // Get user statistics
  async getUserStats(userId) {
    try {
      const [cases, parties, statements, evidence] = await Promise.all([
        this.supabase.from('cases').select('id').eq('filed_by', userId),
        this.supabase.from('case_parties').select('id').eq('user_id', userId),
        this.supabase.from('statements').select('id').eq('user_id', userId),
        this.supabase.from('evidence').select('id').eq('uploader_id', userId)
      ]);

      return {
        cases_filed: cases.data?.length || 0,
        cases_involved: parties.data?.length || 0,
        statements_submitted: statements.data?.length || 0,
        evidence_uploaded: evidence.data?.length || 0
      };
    } catch (error) {
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }

  // Search users (for admin purposes)
  async searchUsers(searchTerm, limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('id, name, email, role, user_type, verification_status, created_at')
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }
  }
}

module.exports = new User();