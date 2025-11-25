const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');
const _supabaseModule = require('../lib/supabaseClient');
const supabase = (_supabaseModule && _supabaseModule.supabase) ? _supabaseModule.supabase : _supabaseModule;

class SearchController {
  /**
   * Global search across disputes, documents, and users
   * GET /api/search?q=query&type=dispute|document|user
   */
  static search = asyncHandler(async (req, res) => {
    const { q: query, type } = req.query;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${query.trim()}%`;
    const results = [];

    try {
      // Search disputes
      if (!type || type === 'dispute') {
        const { data: disputes, error: disputeError } = await supabase
          .from('cases')
          .select('id, case_number, dispute_type, status, description, created_at')
          .or(`case_number.ilike.${searchTerm},dispute_type.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .eq('created_by', userId)
          .limit(10);

        if (!disputeError && disputes) {
          results.push(...disputes.map(d => ({
            id: d.id,
            type: 'dispute',
            title: `Dispute #${d.case_number || d.id.slice(0, 8)}`,
            description: `${d.dispute_type} - ${d.status}`,
            url: `/disputes/${d.id}`,
            metadata: {
              created_at: d.created_at,
              status: d.status,
            },
          })));
        }
      }

      // Search documents
      if (!type || type === 'document') {
        const { data: documents, error: docError } = await supabase
          .from('documents')
          .select('id, filename, file_type, case_id, created_at')
          .ilike('filename', searchTerm)
          .limit(10);

        if (!docError && documents) {
          results.push(...documents.map(d => ({
            id: d.id,
            type: 'document',
            title: d.filename,
            description: `${d.file_type} document`,
            url: `/documents/${d.id}`,
            metadata: {
              created_at: d.created_at,
              case_id: d.case_id,
            },
          })));
        }
      }

      // Search users (if admin or for collaboration)
      if (!type || type === 'user') {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id, name, email')
          .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(10);

        if (!userError && users) {
          results.push(...users.map(u => ({
            id: u.id,
            type: 'user',
            title: u.name || u.email,
            description: u.email,
            url: `/users/${u.id}`,
          })));
        }
      }

      // Sort by relevance (disputes first, then documents, then users)
      const sortedResults = results.sort((a, b) => {
        const typeOrder = { dispute: 1, document: 2, user: 3 };
        return typeOrder[a.type] - typeOrder[b.type];
      });

      return res.json({
        success: true,
        data: sortedResults.slice(0, 20), // Limit to top 20 results
        query,
      });
    } catch (error) {
      console.error('Search error:', error);
      throw new HttpError(500, 'search_failed', 'Search operation failed', error);
    }
  });

  /**
   * Get search suggestions
   * GET /api/search/suggestions?q=query
   */
  static getSuggestions = asyncHandler(async (req, res) => {
    const { q: query } = req.query;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `${query.trim()}%`;

    try {
      // Get recent dispute types and case numbers
      const { data: disputes } = await supabase
        .from('cases')
        .select('case_number, dispute_type')
        .eq('created_by', userId)
        .or(`case_number.ilike.${searchTerm},dispute_type.ilike.${searchTerm}`)
        .limit(5);

      const suggestions = new Set();

      if (disputes) {
        disputes.forEach(d => {
          if (d.case_number && d.case_number.toLowerCase().startsWith(query.toLowerCase())) {
            suggestions.add(d.case_number);
          }
          if (d.dispute_type && d.dispute_type.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(d.dispute_type);
          }
        });
      }

      return res.json({
        success: true,
        data: Array.from(suggestions).slice(0, 5),
      });
    } catch (error) {
      console.error('Suggestions error:', error);
      return res.json({ success: true, data: [] });
    }
  });
}

module.exports = SearchController;
