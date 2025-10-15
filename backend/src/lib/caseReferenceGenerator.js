/**
 * Case Reference Number Generator
 * Generates unique case reference numbers in format: AIDR-YYYY-NNNN
 * Example: AIDR-2025-0001
 */

const { supabase } = require('./supabaseClient');

/**
 * Generate a unique case reference number
 * @returns {Promise<string>} Case reference number (e.g., AIDR-2025-0001)
 */
async function generateCaseReferenceNumber() {
  const year = new Date().getFullYear();
  const prefix = `AIDR-${year}`;

  try {
    // Get the count of cases created this year
    const { count, error } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01T00:00:00Z`)
      .lte('created_at', `${year}-12-31T23:59:59Z`);

    if (error) {
      console.error('Error counting cases:', error);
      // Fallback to timestamp-based number
      return `${prefix}-${Date.now().toString().slice(-4)}`;
    }

    // Increment count and pad to 4 digits
    const sequenceNumber = (count || 0) + 1;
    const paddedNumber = String(sequenceNumber).padStart(4, '0');

    return `${prefix}-${paddedNumber}`;
  } catch (err) {
    console.error('Error generating case reference:', err);
    // Fallback to timestamp-based number
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Calculate response deadline (48 hours from now)
 * @returns {Date} Response deadline
 */
function calculateResponseDeadline() {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 48);
  return deadline;
}

/**
 * Calculate submission deadline (24 hours from a given start time)
 * @param {Date} startTime - Start time for the submission window
 * @returns {Date} Submission deadline
 */
function calculateSubmissionDeadline(startTime = new Date()) {
  const deadline = new Date(startTime);
  deadline.setHours(deadline.getHours() + 24);
  return deadline;
}

module.exports = {
  generateCaseReferenceNumber,
  calculateResponseDeadline,
  calculateSubmissionDeadline
};
