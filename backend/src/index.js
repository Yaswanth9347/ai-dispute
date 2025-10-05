// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS for your dev frontend before any other middleware
app.use(cors({
  origin: 'http://localhost:3000', // restrict to your frontend during dev
  credentials: true,
}));

// Parse JSON bodies after CORS
app.use(express.json());

// mount routes
const casesRouter = require('./routes/cases');
const analyzeRouter = require('./routes/analyze');
const processCaseRouter = require('./routes/processCase'); // NEW
const evidenceRouter = require('./routes/evidence');
const evidenceStatusRouter = require('./routes/evidenceStatus');
const caseEvidenceListRouter = require('./routes/caseEvidenceList');
const evidenceDownloadRouter = require('./routes/evidenceDownload');
const evidenceSignedRouter = require('./routes/evidenceSigned');
const authRouter = require('./routes/auth');
const caseDecisionsRouter = require('./routes/caseDecisions');
const { requireAuth } = require('./lib/authMiddleware');
const healthRouter = require('./routes/health');
const settlementRouter = require('./routes/settlement');
const settlementSignRouter = require('./routes/settlementSign');


// route mounting
app.use('/api/cases', settlementRouter);
app.use('/health', healthRouter);
app.use('/api/cases', casesRouter);
app.use('/api/cases', processCaseRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/evidence', evidenceStatusRouter);
app.use('/api/cases', caseEvidenceListRouter);
app.use('/api/evidence', evidenceDownloadRouter);
app.use('/api/evidence', evidenceSignedRouter);
app.use('/api/auth', authRouter);
app.use('/debug', require('./routes/debug'));
app.use('/api/cases', caseDecisionsRouter);
app.use('/api/cases', settlementSignRouter);


app.get('/', (req, res) => res.send('AI Dispute Resolver backend running'));

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
