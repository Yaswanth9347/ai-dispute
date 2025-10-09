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
}

module.exports = new AIAnalysis();