// Case Communication Model - Handle case communications
const BaseModel = require('./BaseModel');

class CaseCommunication extends BaseModel {
  constructor() {
    super('case_communications');
  }

  // Send message
  async sendMessage(messageData) {
    try {
      const message = await this.create({
        case_id: messageData.case_id,
        sender_id: messageData.sender_id,
        sender_type: messageData.sender_type || 'user',
        recipient_ids: messageData.recipient_ids || [],
        message_type: messageData.message_type || 'message',
        subject: messageData.subject,
        content: messageData.content,
        is_internal: messageData.is_internal || false,
        is_automated: messageData.is_automated || false,
        read_by: {},
        metadata: messageData.metadata || {}
      });

      return message;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  // Get case messages
  async getCaseMessages(caseId, userId = null) {
    try {
      let messages = await this.findMany(
        { case_id: caseId },
        { orderBy: 'created_at', ascending: true }
      );

      // Filter messages based on user access if provided
      if (userId) {
        messages = messages.filter(msg => 
          !msg.is_internal || 
          msg.sender_id === userId || 
          msg.recipient_ids.includes(userId)
        );
      }

      return messages;
    } catch (error) {
      throw new Error(`Failed to get case messages: ${error.message}`);
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId) {
    try {
      const message = await this.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const readBy = {
        ...message.read_by,
        [userId]: new Date().toISOString()
      };

      return await this.updateById(messageId, { read_by: readBy });
    } catch (error) {
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }
}

module.exports = new CaseCommunication();