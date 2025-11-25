// Authentication Middleware
const jwt = require('jsonwebtoken');
const { supabase } = require('../lib/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// Authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Support both sub (new format) and user_id/userId (legacy format)
      const userId = decoded.sub || decoded.user_id || decoded.userId || decoded.id;
      
      // Verify user exists
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token - user not found'
        });
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name,
        role: user.role
      };

      next();

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Support both sub (new format) and user_id/userId (legacy format)
        const userId = decoded.sub || decoded.user_id || decoded.userId || decoded.id;
        
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.full_name || user.name,
            role: user.role
          };
        }
      } catch (jwtError) {
        // Invalid token, but continue without user
      }
    }

    next();

  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};
