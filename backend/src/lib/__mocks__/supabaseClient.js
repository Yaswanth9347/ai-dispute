// Manual jest mock for supabase client used in tests
module.exports = {
  auth: undefined,
  from: jest.fn(() => ({ select: jest.fn().mockResolvedValue({ data: null, error: null }), insert: jest.fn().mockResolvedValue({ data: null, error: null }) })),
  health: jest.fn().mockResolvedValue(true),
};
