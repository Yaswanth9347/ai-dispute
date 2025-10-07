// Advanced Document Features Service - Phase 5.3 Implementation
const { supabase } = require('../lib/supabaseClient');
const documentGeneratorService = require('./DocumentGeneratorService');
const geminiService = require('./GeminiService');
const fs = require('fs').promises;
const path = require('path');

class AdvancedDocumentService {
  constructor() {
    this.collaborationCache = new Map();
    this.versionStoragePath = process.env.DOCUMENT_VERSION_STORAGE_PATH || './storage/document_versions';
    this.initializeStorage();
  }

  async initializeStorage() {
    try {
      await fs.mkdir(this.versionStoragePath, { recursive: true });
      await fs.mkdir(path.join(this.versionStoragePath, 'collaborations'), { recursive: true });
      await fs.mkdir(path.join(this.versionStoragePath, 'approvals'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize advanced document storage:', error);
    }
  }

  // Start collaborative editing session
  async startCollaboration(options) {
    try {
      const {
        documentId,
        collaborators = [],
        permissions = {},
        sessionDuration = 3600, // 1 hour default
        initiatedBy
      } = options;

      // Validate document exists
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Create collaboration session
      const { data: collaboration, error } = await supabase
        .from('document_collaborations')
        .insert({
          document_id: documentId,
          initiated_by: initiatedBy,
          collaborators: collaborators,
          permissions: permissions,
          session_expires_at: new Date(Date.now() + sessionDuration * 1000).toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Initialize real-time collaboration room
      await this.initializeCollaborationRoom(collaboration.id, documentId, collaborators);

      return {
        success: true,
        collaborationId: collaboration.id,
        sessionUrl: `/documents/${documentId}/collaborate/${collaboration.id}`,
        expiresAt: collaboration.session_expires_at,
        collaborators: collaborators.length,
        permissions
      };

    } catch (error) {
      throw new Error(`Failed to start collaboration: ${error.message}`);
    }
  }

  // Initialize real-time collaboration room
  async initializeCollaborationRoom(collaborationId, documentId, collaborators) {
    try {
      // This would integrate with Socket.IO for real-time collaboration
      // For now, we'll set up the basic structure
      
      const roomConfig = {
        roomId: `collab_${collaborationId}`,
        documentId,
        collaborators,
        features: {
          realTimeEditing: true,
          cursorTracking: true,
          commentSystem: true,
          changeTracking: true
        },
        createdAt: new Date().toISOString()
      };

      // Cache collaboration configuration
      this.collaborationCache.set(collaborationId, roomConfig);

      return roomConfig;

    } catch (error) {
      console.error('Failed to initialize collaboration room:', error);
    }
  }

  // Submit document for approval
  async submitForApproval(options) {
    try {
      const {
        documentId,
        approvers = [],
        approvalType = 'sequential', // sequential or parallel
        deadline,
        instructions = '',
        submittedBy
      } = options;

      // Validate document exists
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Create approval workflow
      const { data: approval, error } = await supabase
        .from('document_approvals')
        .insert({
          document_id: documentId,
          approval_type: approvalType,
          approvers: approvers,
          approval_deadline: deadline,
          instructions: instructions,
          submitted_by: submittedBy,
          current_approver_index: 0,
          approval_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Create individual approval tasks
      const approvalTasks = await this.createApprovalTasks(approval, approvers, approvalType);

      // Send notifications to approvers
      await this.notifyApprovers(approval, approvalTasks, approvalType);

      return {
        success: true,
        approvalId: approval.id,
        approvalType,
        approvers: approvers.length,
        deadline,
        nextApprover: approvalType === 'sequential' ? approvers[0] : null,
        pendingApprovals: approvalTasks.length
      };

    } catch (error) {
      throw new Error(`Failed to submit for approval: ${error.message}`);
    }
  }

  // Create approval tasks for approvers
  async createApprovalTasks(approval, approvers, approvalType) {
    const tasks = [];

    for (let i = 0; i < approvers.length; i++) {
      const approver = approvers[i];
      
      const taskStatus = approvalType === 'sequential' && i > 0 ? 'waiting' : 'pending';
      
      const task = {
        approval_id: approval.id,
        approver_user_id: approver.userId,
        approver_role: approver.role || 'reviewer',
        status: taskStatus,
        sequence_order: i + 1,
        created_at: new Date().toISOString()
      };

      tasks.push(task);
    }

    // Insert all tasks
    const { data: createdTasks, error } = await supabase
      .from('document_approval_tasks')
      .insert(tasks)
      .select();

    if (error) throw error;

    return createdTasks;
  }

  // Process approval response
  async processApprovalResponse(options) {
    try {
      const {
        approvalId,
        taskId,
        approved,
        comments = '',
        suggestedChanges = [],
        respondedBy
      } = options;

      // Get approval workflow
      const { data: approval, error: approvalError } = await supabase
        .from('document_approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (approvalError || !approval) {
        throw new Error('Approval workflow not found');
      }

      // Update approval task
      const { error: taskError } = await supabase
        .from('document_approval_tasks')
        .update({
          status: approved ? 'approved' : 'rejected',
          response: approved ? 'approved' : 'rejected',
          comments,
          suggested_changes: suggestedChanges,
          responded_at: new Date().toISOString(),
          responded_by: respondedBy
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Check if all approvals are complete
      const workflowStatus = await this.checkApprovalWorkflowStatus(approvalId);

      // If rejected, stop the workflow
      if (!approved) {
        await this.updateApprovalWorkflow(approvalId, {
          approval_status: 'rejected',
          completed_at: new Date().toISOString(),
          final_result: 'rejected'
        });

        return {
          success: true,
          approved: false,
          workflowStatus: 'rejected',
          message: 'Document approval rejected',
          comments,
          suggestedChanges
        };
      }

      // If approved and workflow complete, finalize
      if (workflowStatus.allApproved) {
        await this.updateApprovalWorkflow(approvalId, {
          approval_status: 'approved',
          completed_at: new Date().toISOString(),
          final_result: 'approved'
        });

        // Mark document as approved
        await this.markDocumentApproved(approval.document_id, approvalId);

        return {
          success: true,
          approved: true,
          workflowStatus: 'approved',
          message: 'Document fully approved',
          finalApproval: true
        };
      }

      // If sequential approval, activate next approver
      if (approval.approval_type === 'sequential') {
        await this.activateNextApprover(approvalId);
      }

      return {
        success: true,
        approved: true,
        workflowStatus: 'in_progress',
        message: 'Approval recorded, waiting for remaining approvals',
        pendingApprovals: workflowStatus.pendingCount
      };

    } catch (error) {
      throw new Error(`Failed to process approval: ${error.message}`);
    }
  }

  // Check approval workflow status
  async checkApprovalWorkflowStatus(approvalId) {
    const { data: tasks, error } = await supabase
      .from('document_approval_tasks')
      .select('*')
      .eq('approval_id', approvalId);

    if (error) throw error;

    const approvedCount = tasks.filter(t => t.status === 'approved').length;
    const rejectedCount = tasks.filter(t => t.status === 'rejected').length;
    const pendingCount = tasks.filter(t => t.status === 'pending').length;

    return {
      totalTasks: tasks.length,
      approvedCount,
      rejectedCount,
      pendingCount,
      allApproved: approvedCount === tasks.length,
      anyRejected: rejectedCount > 0
    };
  }

  // Create new document version
  async createDocumentVersion(options) {
    try {
      const {
        documentId,
        changes = {},
        versionNotes = '',
        createdBy,
        major = false
      } = options;

      // Get current document
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get latest version number
      const { data: latestVersion } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1);

      const currentVersion = latestVersion?.[0]?.version_number || '1.0';
      const newVersion = this.calculateNextVersion(currentVersion, major);

      // Apply changes to document content
      const updatedContent = this.applyChangesToContent(document.content, changes);

      // Create new version record
      const { data: version, error } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          version_number: newVersion,
          content: updatedContent,
          changes_summary: changes,
          version_notes: versionNotes,
          created_by: createdBy,
          is_current: false // Will be set to true if this becomes the active version
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        versionId: version.id,
        versionNumber: newVersion,
        changes: Object.keys(changes).length,
        createdAt: version.created_at
      };

    } catch (error) {
      throw new Error(`Failed to create document version: ${error.message}`);
    }
  }

  // Calculate next version number
  calculateNextVersion(currentVersion, major = false) {
    const [majorNum, minorNum] = currentVersion.split('.').map(Number);
    
    if (major) {
      return `${majorNum + 1}.0`;
    } else {
      return `${majorNum}.${minorNum + 1}`;
    }
  }

  // Apply changes to document content
  applyChangesToContent(originalContent, changes) {
    let updatedContent = JSON.parse(JSON.stringify(originalContent));

    for (const [path, newValue] of Object.entries(changes)) {
      // Simple path-based updates (e.g., "sections.0.title" -> sections[0].title)
      const pathParts = path.split('.');
      let current = updatedContent;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      current[pathParts[pathParts.length - 1]] = newValue;
    }

    return updatedContent;
  }

  // Activate current document version
  async activateDocumentVersion(documentId, versionId) {
    try {
      // Get version content
      const { data: version, error: versionError } = await supabase
        .from('document_versions')
        .select('*')
        .eq('id', versionId)
        .eq('document_id', documentId)
        .single();

      if (versionError || !version) {
        throw new Error('Version not found');
      }

      // Update all versions to not current
      await supabase
        .from('document_versions')
        .update({ is_current: false })
        .eq('document_id', documentId);

      // Set this version as current
      await supabase
        .from('document_versions')
        .update({ is_current: true })
        .eq('id', versionId);

      // Update main document with version content
      await supabase
        .from('generated_documents')
        .update({
          content: version.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      return {
        success: true,
        activeVersion: version.version_number,
        activatedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to activate version: ${error.message}`);
    }
  }

  // Compare document versions
  async compareVersions(documentId, version1Id, version2Id) {
    try {
      const [version1, version2] = await Promise.all([
        this.getDocumentVersion(version1Id),
        this.getDocumentVersion(version2Id)
      ]);

      if (!version1 || !version2) {
        throw new Error('One or both versions not found');
      }

      const differences = this.calculateContentDifferences(version1.content, version2.content);

      return {
        success: true,
        comparison: {
          version1: {
            number: version1.version_number,
            createdAt: version1.created_at,
            createdBy: version1.created_by
          },
          version2: {
            number: version2.version_number,
            createdAt: version2.created_at,
            createdBy: version2.created_by
          },
          differences,
          changeCount: differences.length
        }
      };

    } catch (error) {
      throw new Error(`Failed to compare versions: ${error.message}`);
    }
  }

  // Calculate differences between content
  calculateContentDifferences(content1, content2) {
    const differences = [];
    
    // Simple difference calculation for sections
    if (content1.sections && content2.sections) {
      for (let i = 0; i < Math.max(content1.sections.length, content2.sections.length); i++) {
        const section1 = content1.sections[i];
        const section2 = content2.sections[i];

        if (!section1) {
          differences.push({
            type: 'added',
            path: `sections[${i}]`,
            value: section2
          });
        } else if (!section2) {
          differences.push({
            type: 'removed',
            path: `sections[${i}]`,
            value: section1
          });
        } else {
          // Check for changes in section content
          if (section1.title !== section2.title) {
            differences.push({
              type: 'modified',
              path: `sections[${i}].title`,
              oldValue: section1.title,
              newValue: section2.title
            });
          }
          
          if (section1.content !== section2.content) {
            differences.push({
              type: 'modified',
              path: `sections[${i}].content`,
              oldValue: section1.content,
              newValue: section2.content
            });
          }
        }
      }
    }

    return differences;
  }

  // Smart document review using AI
  async performSmartReview(documentId, reviewType = 'comprehensive') {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      const reviewPrompts = {
        comprehensive: `Perform a comprehensive legal document review of the following document. Analyze for:
1. Legal accuracy and compliance
2. Clarity and readability
3. Completeness of required clauses
4. Potential risks or issues
5. Suggestions for improvement

Document content:`,
        
        compliance: `Review this legal document for compliance with applicable laws and regulations. Focus on:
1. Jurisdictional requirements
2. Mandatory clauses and disclosures
3. Regulatory compliance
4. Industry standards

Document content:`,
        
        clarity: `Review this document for clarity, readability, and effectiveness. Analyze:
1. Language clarity and precision
2. Structure and organization
3. Consistency in terminology
4. Potential ambiguities

Document content:`
      };

      const prompt = reviewPrompts[reviewType] || reviewPrompts.comprehensive;
      const documentText = this.extractTextFromContent(document.content);

      const reviewResult = await geminiService.generateResponse(`${prompt}\n\n${documentText}`, {
        temperature: 0.3,
        maxOutputTokens: 2000
      });

      if (!reviewResult.success) {
        throw new Error('AI review failed');
      }

      // Save review results
      const { data: review, error } = await supabase
        .from('document_reviews')
        .insert({
          document_id: documentId,
          review_type: reviewType,
          ai_review: reviewResult.content,
          review_score: this.calculateReviewScore(reviewResult.content),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        reviewId: review.id,
        reviewType,
        score: review.review_score,
        summary: this.extractReviewSummary(reviewResult.content),
        fullReview: reviewResult.content,
        recommendations: this.extractRecommendations(reviewResult.content)
      };

    } catch (error) {
      throw new Error(`Smart review failed: ${error.message}`);
    }
  }

  // Extract text content from document structure
  extractTextFromContent(content) {
    if (!content || !content.sections) {
      return '';
    }

    return content.sections
      .map(section => `${section.title}\n${section.content}`)
      .join('\n\n');
  }

  // Calculate review score based on AI feedback
  calculateReviewScore(reviewText) {
    // Simple scoring based on keywords and sentiment
    const positiveKeywords = ['excellent', 'good', 'clear', 'comprehensive', 'compliant'];
    const negativeKeywords = ['unclear', 'missing', 'error', 'issue', 'problem'];
    
    const text = reviewText.toLowerCase();
    
    let score = 70; // Base score
    
    positiveKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 5;
    });
    
    negativeKeywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
      score -= matches * 10;
    });
    
    return Math.max(0, Math.min(100, score));
  }

  // Extract review summary
  extractReviewSummary(reviewText) {
    const lines = reviewText.split('\n');
    return lines.slice(0, 3).join(' ').substring(0, 200) + '...';
  }

  // Extract recommendations from review
  extractRecommendations(reviewText) {
    const recommendations = [];
    const lines = reviewText.split('\n');
    
    for (const line of lines) {
      if (line.includes('recommend') || line.includes('suggest') || line.includes('should')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  // Helper methods
  async getDocument(documentId) {
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) return null;
    return document;
  }

  async getDocumentVersion(versionId) {
    const { data: version, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) return null;
    return version;
  }

  async markDocumentApproved(documentId, approvalId) {
    await supabase
      .from('generated_documents')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approval_id: approvalId
      })
      .eq('id', documentId);
  }

  async updateApprovalWorkflow(approvalId, updates) {
    await supabase
      .from('document_approvals')
      .update(updates)
      .eq('id', approvalId);
  }

  async activateNextApprover(approvalId) {
    // Get next pending task in sequence
    const { data: nextTask, error } = await supabase
      .from('document_approval_tasks')
      .select('*')
      .eq('approval_id', approvalId)
      .eq('status', 'waiting')
      .order('sequence_order', { ascending: true })
      .limit(1);

    if (error || !nextTask || nextTask.length === 0) return;

    // Activate next task
    await supabase
      .from('document_approval_tasks')
      .update({ status: 'pending' })
      .eq('id', nextTask[0].id);
  }

  async notifyApprovers(approval, tasks, approvalType) {
    // Implementation would send notifications to approvers
    // For now, just log the notification intent
    console.log(`Notifying ${tasks.length} approvers for ${approvalType} approval of document ${approval.document_id}`);
  }

  // Health check
  async healthCheck() {
    try {
      const checks = {
        service: 'Advanced Document Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {}
      };

      // Check database connectivity
      try {
        const { data, error } = await supabase
          .from('document_collaborations')
          .select('count')
          .limit(1);
        checks.components.database = error ? 'failed' : 'operational';
      } catch (error) {
        checks.components.database = 'failed';
      }

      // Check AI service
      try {
        const aiHealth = await geminiService.healthCheck();
        checks.components.ai_service = aiHealth.status === 'healthy' ? 'operational' : 'degraded';
      } catch (error) {
        checks.components.ai_service = 'failed';
      }

      // Check storage
      try {
        await fs.access(this.versionStoragePath);
        checks.components.storage = 'operational';
      } catch (error) {
        checks.components.storage = 'failed';
      }

      const failedComponents = Object.values(checks.components).filter(status => status === 'failed');
      if (failedComponents.length > 0) {
        checks.status = failedComponents.length === Object.keys(checks.components).length ? 'unhealthy' : 'degraded';
      }

      return checks;

    } catch (error) {
      return {
        service: 'Advanced Document Service',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new AdvancedDocumentService();