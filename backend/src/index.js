require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// mount routes
const casesRouter = require('./routes/cases');
const analyzeRouter = require('./routes/analyze');
const processCaseRouter = require('./routes/processCase'); // NEW
const evidenceRouter = require('./routes/evidence');
const evidenceStatusRouter = require('./routes/evidenceStatus');
const cors = require('cors');
const caseEvidenceListRouter = require('./routes/caseEvidenceList');
const evidenceDownloadRouter = require('./routes/evidenceDownload');
const evidenceSignedRouter = require('./routes/evidenceSigned');
const authRouter = require('./routes/auth');
const { requireAuth } = require('./lib/authMiddleware');


app.use('/api/cases', casesRouter);
app.use('/api/cases', processCaseRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/evidence', evidenceStatusRouter);
app.use(cors({ origin: true }));
app.use('/api/cases', caseEvidenceListRouter);
app.use('/api/evidence', evidenceDownloadRouter);
app.use('/api/evidence', evidenceSignedRouter);
app.use('/api/auth', authRouter);

app.get('/', (req, res) => res.send('AI Dispute Resolver backend running'));

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});