// AI Analysis Model - Handle AI analysis operations
const BaseModel = require('./BaseModel');
class AIAnalysis extends BaseModel {
  constructor() {
    super('ai_analysis');
  }

  // Create AI analysis record
  async createAnalysis(analysisData) {
    try {
      const analysis = await this.create({
        case_id: analysisData.case_id,
        analysis_type: analysisData.analysis_type || 'case_analysis',
        model: analysisData.model,
        analysis: analysisData.analysis,
        confidence_score: analysisData.confidence_score,
        version: analysisData.version || 1,
        status: 'completed',
        processing_time_ms: analysisData.processing_time_ms,
        tokens_used: analysisData.tokens_used,
        is_final: analysisData.is_final || false
      });

      return analysis;
    } catch (error) {
      throw new Error(`Failed to create AI analysis: ${error.message}`);
    }
  }

  // Get latest analysis for a case
  async getLatestAnalysis(caseId, analysisType = 'case_analysis') {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .eq('analysis_type', analysisType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to get latest analysis: ${error.message}`);
    }
  }

  // Get all analyses for a case
  async getCaseAnalyses(caseId) {
    try {
      return await this.findMany(
        { case_id: caseId },
        { orderBy: 'created_at', ascending: false }
      );
    } catch (error) {
      throw new Error(`Failed to get case analyses: ${error.message}`);
    }
  }

  // Create settlement options record
  async createSettlementOptions(data) {
    try {
      const settlement = await this.create({
        case_id: data.case_id,
        analysis_type: 'settlement_generation',
        model: data.model,
        analysis: data.settlement_options,
        confidence_score: data.confidence_score,
        version: data.version || 1,
        status: 'completed',
        processing_time_ms: data.processing_time_ms,
        tokens_used: data.tokens_used,
        is_final: false
      });

      return settlement;
    } catch (error) {
      throw new Error(`Failed to create settlement options: ${error.message}`);
    }
  }

  // Get settlement options for a case
  async getSettlementOptions(caseId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('case_id', caseId)
        .eq('analysis_type', 'settlement_generation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw new Error(`Failed to get settlement options: ${error.message}`);
    }
  }

  // Create combined solution record
  async createCombinedSolution(data) {
    try {
      const solution = await this.create({
        case_id: data.case_id,
        analysis_type: 'combined_solution',
        model: data.model,
        analysis: data.combined_solution,
        confidence_score: data.confidence_score,
        version: data.version || 1,
        status: 'completed',
        processing_time_ms: data.processing_time_ms,
        tokens_used: data.tokens_used,
        is_final: true
      });

      return solution;
    } catch (error) {
      throw new Error(`Failed to create combined solution: ${error.message}`);
    }
  }

  // Get AI analysis statistics
  async getAnalysisStats() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('analysis_type, status, model, tokens_used, created_at');

      if (error) throw error;

      const stats = {
        total: data.length,
        byType: {},
        byStatus: {},
        byModel: {},
        totalTokens: 0,
        todayCount: 0
      };

      const today = new Date().toDateString();

      data.forEach(analysis => {
        stats.byType[analysis.analysis_type] = (stats.byType[analysis.analysis_type] || 0) + 1;
        stats.byStatus[analysis.status] = (stats.byStatus[analysis.status] || 0) + 1;
        stats.byModel[analysis.model] = (stats.byModel[analysis.model] || 0) + 1;
        
        if (analysis.tokens_used) {
          stats.totalTokens += analysis.tokens_used;
        }
        
        if (new Date(analysis.created_at).toDateString() === today) {
          stats.todayCount++;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get analysis statistics: ${error.message}`);
    }
  }
}

module.exports = new AIAnalysis();