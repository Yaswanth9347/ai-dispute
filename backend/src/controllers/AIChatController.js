const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

// AI Chat endpoint
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, caseId, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // In production, integrate with OpenAI/Claude/other AI service
    // For now, return a mock response
    
    const responses = {
      "strengths": "Based on my analysis, your case has several strong points:\n\n1. **Clear Documentation**: You have substantial evidence supporting your claims.\n2. **Legal Precedent**: Similar cases have ruled in favor of plaintiffs in this jurisdiction.\n3. **Timeline**: Your prompt action strengthens your position.\n4. **Witness Testimony**: Multiple witnesses corroborate your account.\n\nI recommend proceeding with settlement negotiations while maintaining this strong position.",
      
      "precedents": "Relevant legal precedents for your case include:\n\n1. **Smith v. Jones (2022)**: Established similar liability standards\n2. **Brown v. County (2021)**: Set damages framework for comparable cases\n3. **State v. Corporation (2020)**: Clarified duty of care requirements\n\nThese precedents generally favor your position and could strengthen settlement negotiations.",
      
      "settlement": "Settlement options to consider:\n\n1. **Full Compensation**: Demand 100% of claimed damages ($50,000)\n2. **Reduced Settlement**: Accept 75% ($37,500) for quicker resolution\n3. **Structured Payment**: Monthly payments over 12-24 months\n4. **Non-Monetary Terms**: Include future preventive measures\n\nGiven the strength of your case, I'd recommend starting with option 1 and being willing to negotiate to option 2.",
      
      "timeline": "Expected timeline for your case:\n\n1. **Discovery Phase**: 2-3 months for evidence exchange\n2. **Mediation**: 1-2 months for settlement discussions\n3. **Trial Preparation**: 2-3 months if settlement fails\n4. **Trial**: 1-2 weeks of court time\n5. **Appeals**: 6-12 months if either party appeals\n\n**Total Estimate**: 6-8 months for settlement, 12-18 months for full trial.\n\nI recommend pursuing settlement to save time and costs.",
      
      "default": `I understand your question about "${message}". Based on the ${caseId ? 'case details' : 'information provided'}, here's my analysis:\n\nYour situation involves important legal considerations that require careful examination. ${conversationHistory && conversationHistory.length > 2 ? 'Building on our previous discussion, ' : ''}I recommend:\n\n1. **Document Everything**: Keep detailed records of all interactions\n2. **Consider Mediation**: Often faster and less costly than litigation\n3. **Know Your Rights**: Familiarize yourself with relevant laws\n4. **Seek Resolution**: Focus on practical solutions\n\nWould you like me to elaborate on any specific aspect?`
    };
    
    // Simple keyword matching for demo
    const lowerMessage = message.toLowerCase();
    let response;
    
    if (lowerMessage.includes('strength')) {
      response = responses.strengths;
    } else if (lowerMessage.includes('precedent') || lowerMessage.includes('legal')) {
      response = responses.precedents;
    } else if (lowerMessage.includes('settlement') || lowerMessage.includes('option')) {
      response = responses.settlement;
    } else if (lowerMessage.includes('long') || lowerMessage.includes('timeline') || lowerMessage.includes('time')) {
      response = responses.timeline;
    } else {
      response = responses.default;
    }
    
    res.json({
      success: true,
      data: {
        response,
        confidence: 0.87,
        sources: [
          'Legal precedent database',
          'Case law analysis',
          'Settlement statistics'
        ]
      }
    });
    
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze evidence (used by Evidence Upload component)
router.post('/analyze-evidence', requireAuth, async (req, res) => {
  try {
    const { evidenceId, fileUrl, fileName } = req.body;
    
    // In production, integrate with AI service for actual analysis
    // For now, return mock analysis
    
    const analysisResults = {
      relevanceScore: Math.floor(Math.random() * 30) + 70, // 70-100
      summary: `Document "${fileName}" contains important information relevant to the case. Key points have been extracted and categorized.`,
      keyPoints: [
        'Document establishes timeline of events',
        'Contains statements from involved parties',
        'Provides supporting evidence for claims',
        'Identifies potential witnesses'
      ],
      extractedText: `This is a sample of extracted text from ${fileName}. In production, this would contain actual OCR results and document content analysis.`,
      categories: ['Evidence', 'Testimony', 'Documentation'],
      confidence: 0.92
    };
    
    res.json({
      success: true,
      data: analysisResults
    });
    
  } catch (error) {
    console.error('Error analyzing evidence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
