const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`Hello from AWS DevOps pipeline! Build: ${process.env.BUILD_ID || 'local'}`);
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));