const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// 1. CORS: Allow your frontend to connect
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. CREDENTIALS: Read from Vercel Environment Variables
// (Do not hardcode these in the file!)
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

const auth = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');

app.get('/api/tickets', async (req, res) => {
  try {
    // 3. YOUR EXACT ENDPOINT (The one that works locally)
    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
    
    let allIssues = [];
    let nextPageToken = null;
    let isLastPage = false;

    // 4. YOUR EXACT LOOP LOGIC
    while (!isLastPage) {
      const response = await axios.post(jiraUrl, {
        "jql": `project = "${PROJECT_KEY}" AND status != "Done" AND status != "Launched" AND status != "Invalid/ Dispose" AND duedate is not EMPTY AND created >= -90d ORDER BY created DESC`,
        "fields": ["summary", "assignee", "duedate", "issuetype", "status", "id", "key"],
        "maxResults": 100,
        "nextPageToken": nextPageToken // This is what your endpoint needs
      }, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const newIssues = response.data.issues || [];
      allIssues = [...allIssues, ...newIssues];

      // Jira /search/jql uses nextPageToken to signal more data
      if (response.data.nextPageToken) {
        nextPageToken = response.data.nextPageToken;
      } else {
        isLastPage = true;
      }
    }

    const jiraTickets = allIssues.map(issue => {
      const f = issue.fields || {};
      return {
        id: issue.id,
        key: issue.key,
        title: f.summary || "No Title",
        assignee: f.assignee ? f.assignee.displayName : 'Unassigned',
        due_date: f.duedate || 'No Date',
        type: f.issuetype ? f.issuetype.name : 'Task',
        status: f.status ? f.status.name : 'Open',
        link: `https://${JIRA_DOMAIN}/browse/${issue.key}`
      };
    });

    res.json(jiraTickets);

  } catch (error) {
    console.error("Backend Error:", error.message);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// 5. VERCEL CONFIGURATION
// Vercel needs 'module.exports' to run. 
// We only listen on port 5000 if we are NOT on Vercel.
if (process.env.NODE_ENV !== 'production') {
  app.listen(5000, () => console.log('✅ Local Backend Running on 5000'));
}

module.exports = app;