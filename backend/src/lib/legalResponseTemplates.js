// Legal Response Templates - Concise and focused
// Used by AIChatController for consistent, non-repetitive legal guidance

const generateLegalResponses = (message, conversationHistory) => {
  const lowerMessage = (message || '').toLowerCase();
  const hasHistory = conversationHistory && conversationHistory.length > 2;
  
  // Generate more conversational responses based on context
  const getContextualResponse = (baseResponse, questionIndicators) => {
    // If message is a direct question, provide a direct answer
    if (questionIndicators.some(q => lowerMessage.includes(q))) {
      return baseResponse;
    }
    // If it's a follow-up, acknowledge context
    if (hasHistory) {
      return `Based on your previous question, ${baseResponse}`;
    }
    return baseResponse;
  };
  
  return {
    constitution: `📜 **Constitutional Analysis**

**Relevant Fundamental Rights:**
• **Article 14**: Equality before law - ensures fair treatment
• **Article 19**: Freedom rights - if speech/expression/contract involved  
• **Article 21**: Right to life & personal liberty - constitutional protection

**Your Legal Options:**
1. **ADR (Section 89 CPC)**: Mediation/arbitration for faster resolution
2. **Consumer Forum**: If product/service deficiency (free, 3-6 months)
3. **Civil Court**: For contractual breach or property disputes
4. **Writ Petition (Art 32/226)**: Only if fundamental rights violated

**Recommended First Step**: Attempt settlement through mediation to save time and cost.

Share specific case details for targeted constitutional analysis.`,
    
    rights: `⚖️ **Your Legal Rights**

**Consumer Protection Act 2019:**
• Compensation for defective goods/deficient service
• File complaint in Consumer Forum (free, District/State/National level)
• Right to be heard and fair redressal

**Contract Act 1872:**
• Enforce valid contracts (Sec 10) or claim damages for breach (Sec 73)
• Rescind contract if fraud/misrepresentation (Sec 19)

**Constitutional Guarantee:**
• Right to justice (Art 39A) and free legal aid if financially weak

**Next Steps:**
1. Send legal notice (15-30 days to respond)
2. File consumer complaint OR civil suit based on claim amount
3. Explore settlement/mediation for faster resolution

Provide case specifics for detailed rights analysis.`,
    
    settlement: `🤝 **Settlement Options**

**1. Mediation (Sec 89 CPC)** - Recommended ✓
• Court-referred neutral mediator | Time: 2-3 months | Cost: ₹1,000-5,000
• Legally binding if both agree

**2. Lok Adalat**
• FREE for disputes up to ₹20 lakhs | Fast resolution | No appeal
• Award = Civil court decree

**3. Direct Negotiation**
• Send legal notice → negotiate terms → settlement deed on ₹100 stamp paper
• Payment: Lump sum or installments

**Settlement Framework:**
1. Establish liability & quantify damages
2. Propose compromise (60-40 or 70-30 split)
3. Draft agreement with payment terms
4. Execute before witnesses/notary

**For Consumer Disputes**: Consumer Forum is free, faster (3-5 months), no lawyer needed.

Which option suits your case? Share details for specific guidance.`,
    
    analysis: `🔍 **Case Analysis**

**Classification**: [Civil/Consumer/Contract] Dispute
• **Applicable Law**: Consumer Act 2019 / Contract Act 1872
• **Forum**: Consumer Forum / Civil Court

**Your Strengths**:
✓ Documentary evidence (agreements/receipts)
✓ Statutory protection for consumers
✓ Timely action taken

**Challenges**:
⚠ Burden of proof (Evidence Act Sec 101-102) - you must prove claims
⚠ Limitation: 2 years (Consumer), 3 years (Contract)
⚠ Prepare for opponent's defenses

**Action Plan**:
1. **Legal Notice**: Send within 15-30 days notice period
2. **Documentation**: Gather all evidence (emails, receipts, photos)
3. **Settlement**: Explore mediation parallel to legal action
4. **Filing**: Consumer Forum (free) OR Civil Court based on amount

**Free Legal Aid**: If financially weak, contact District Legal Services Authority (Art 39A).

Share case specifics for targeted strategy and success probability assessment.`,
    
    default: `🇮🇳 **Legal Guidance**

I understand you need legal help. To provide accurate advice, I need to know:

**Case Details:**
• What type of dispute? (Consumer/Contract/Property/Family/Criminal)
• What happened? (Brief incident description)
• Do you have evidence? (Documents/agreements/receipts)
• Time elapsed since incident?

**Your Options in Indian Law:**
1. **Settlement**: Mediation/Lok Adalat (faster, cheaper - 2-4 months)
2. **Legal Notice**: Formal demand (15-30 days to respond)
3. **Consumer Forum**: For product/service issues (FREE filing)
4. **Civil Court**: For contracts, property, damages

**Your Rights**:
✓ Access to justice (Art 39A)
✓ Fair hearing and legal representation
✓ Free legal aid if economically weak (District Legal Services)

**Next Steps**:
1. Share specific case facts
2. I'll identify applicable laws (Consumer Act/Contract Act/CPC/etc.)
3. Provide actionable legal strategy

${conversationHistory && conversationHistory.length > 2 ? 'Based on our discussion, ' : ''}How can I assist with your legal matter? Please provide case-specific details for precise guidance.`
  };
};

module.exports = { generateLegalResponses };
