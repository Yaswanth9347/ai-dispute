// Case Timeline Model - Handle timeline operations
const BaseModel = require('./BaseModel');

class CaseTimeline extends BaseModel {
  constructor() {
    super('case_timeline');
  }

  // Add timeline event
  async addEvent(eventData) {
    try {
      const event = await this.create({
        case_id: eventData.case_id,
        event_type: eventData.event_type,
        event_title: eventData.event_title,
        event_description: eventData.event_description,
        actor_id: eventData.actor_id,
        actor_name: eventData.actor_name,
        metadata: eventData.metadata || {},
        is_public: eventData.is_public !== false
      });

      return event;
    } catch (error) {
      throw new Error(`Failed to add timeline event: ${error.message}`);
    }
  }

  // Get case timeline
  async getCaseTimeline(caseId, isPublicOnly = true) {
    try {
      const filters = { case_id: caseId };
      if (isPublicOnly) {
        filters.is_public = true;
      }

      return await this.findMany(filters, {
        orderBy: 'created_at',
        ascending: true
      });
    } catch (error) {
      throw new Error(`Failed to get case timeline: ${error.message}`);
    }
  }
}

module.exports = new CaseTimeline();