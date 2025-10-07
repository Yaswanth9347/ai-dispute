# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/your_database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Email (Optional)
SENDGRID_API_KEY=your-sendgrid-key-here

# Google AI
GEMINI_API_KEY=your-gemini-api-key-here

# Server
PORT=8080
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3002

2. Backend Setup
Install Dependencies

cd backend
pnpm install

Configure Environment

# Copy the example env filecp .env.example .env# Edit .env and add your credentialsnano .env
Required Environment Variables:


# DatabaseDATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgresSUPABASE_URL=https://xxx.supabase.coSUPABASE_SERVICE_ROLE_KEY=your-service-role-key# JWTJWT_SECRET=your-super-secret-jwt-key-min-32-characters# Google AIGEMINI_API_KEY=your-gemini-api-key# ServerPORT=8080NODE_ENV=development# Frontend URL (for CORS)FRONTEND_URL=http://localhost:3001


Initialize Database

# Apply the schema to your Supabase database# Open Supabase Dashboard → SQL Editor# Run the SQL files in this order:# 1. sql/supabase_schema.sql# 2. sql/05_extend_ai_dispute_resolver_schema.sql# 3. sql/11_active_negotiation_schema.sql
Start Backend Server

pnpm dev
✅ Backend running at: http://localhost:8080

3. Frontend Setup
Install Dependencies

cd ../frontendpnpm install
Configure Environment

# Create env filecat > .env.local << EOFNEXT_PUBLIC_API_URL=http://localhost:8080/apiEOF
Start Frontend Server

pnpm dev
✅ Frontend running at: http://localhost:3002

🧪 Testing the Application
1. Register a New Account
Open: http://localhost:3002/auth/register
Fill in your details:
Full Name: Your Name
Email: your.email@example.com
Password: SecurePass123!
Click "Sign Up"
2. Login
Open: http://localhost:3002/auth/login
Enter your credentials
Click "Sign In"
3. File a Case
Click "File a Case" in the navbar
Fill in case details:
Title: Property Dispute
Description: Neighbor encroaching on my land
Case Type: Civil
Amount: 50000
Upload evidence (optional)
Click "File Case"
4. View Cases
Click "Cases" in navbar
See your filed case
Click "View Details" to see full information


📁 Project Structure


ai-dispute-resolver/
├── backend/
│   ├── src/
│   │   ├── controllers/       # API route handlers
│   │   ├── services/          # Business logic
│   │   ├── routes/            # Express routes
│   │   ├── models/            # Data models
│   │   ├── lib/               # Utilities (auth, db)
│   │   ├── middleware/        # Express middleware
│   │   ├── app.js             # Express app setup
│   │   └── index.js           # Server entry point
│   ├── sql/                   # Database migrations
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js pages (App Router)
│   │   │   ├── auth/          # Login/Register pages
│   │   │   ├── cases/         # Case management pages
│   │   │   ├── analytics/     # Analytics dashboard
│   │   │   └── ...
│   │   ├── components/        # React components
│   │   ├── services/          # API client services
│   │   ├── lib/               # Utilities
│   │   └── types/             # TypeScript types
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── .gitignore
└── README.md



🔑 Key API Endpoints
Authentication
POST /api/auth/register - Register new user
POST /api/auth/login - Login user
GET /api/auth/me - Get current user
Cases
GET /api/cases - List all cases
POST /api/cases - Create new case
GET /api/cases/:id - Get case details
PUT /api/cases/:id - Update case
DELETE /api/cases/:id - Delete case
Analytics
GET /api/analytics/platform-stats - Platform statistics
GET /api/analytics/negotiation-analytics - Negotiation metrics
GET /api/analytics/ai-performance - AI confidence scores
Settlements
POST /api/active-negotiations/start - Start negotiation
POST /api/active-negotiations/:id/respond - Submit proposal
POST /api/active-negotiations/:id/compromise - Accept compromise
Court Filing
POST /api/enhanced-court/file - File case to court
GET /api/enhanced-court/status/:filingId - Check filing status
🛠️ Development
Run Tests

# Backend testscd backendpnpm test# Frontend testscd frontendpnpm test
Build for Production
Backend:


cd backendpnpm start
Frontend:


cd frontendpnpm buildpnpm start
🐛 Troubleshooting
Port Already in Use

# Kill process on port 8080 (backend)lsof -ti:8080 | xargs kill -9# Kill process on port 3002 (frontend)lsof -ti:3002 | xargs kill -9
Database Connection Failed
Verify Supabase URL and service role key in .env
Check if database is accessible
Ensure SQL schema is applied
CORS Errors
Verify FRONTEND_URL in backend .env matches frontend port
Check CORS settings in app.js
JWT Errors
Ensure JWT_SECRET is at least 32 characters
Clear browser localStorage and re-login
📚 Documentation
API Documentation: See routes for endpoint details
Component Library: See components for UI components
Database Schema: See supabase_schema.sql for table definitions
🤝 Contributing
Contributions are welcome! Please:

Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request
