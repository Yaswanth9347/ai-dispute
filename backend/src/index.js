require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// mount routes
const casesRouter = require('./routes/cases');
const analyzeRouter = require('./routes/analyze');

app.use('/api/cases', casesRouter);
app.use('/api/analyze', analyzeRouter);

app.get('/', (req, res) => res.send('AI Dispute Resolver backend running'));

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
