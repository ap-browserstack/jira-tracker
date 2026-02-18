const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION (SECURE) ---
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

const auth = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');

// --- THE API ROUTE ---

app.get('/api/tickets', async (req, res) => {
  try {
    // Keeping your exact endpoint and logic
    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
    
    let allIssues = [];
    let nextPageToken = null;
    let isLastPage = false;

    console.log("--- STARTING BULK FETCH ---");

    while (!isLastPage) {
      
      const response = await axios.post(jiraUrl, {
        "jql": `project = "${PROJECT_KEY}" AND status != "Done" AND status != "Launched" AND status != "Invalid/ Dispose" AND duedate is not EMPTY AND created >= -90d ORDER BY created DESC`,
        "fields": ["summary", "assignee", "duedate", "issuetype", "status", "id", "key"],
        "maxResults": 100,
        "nextPageToken": nextPageToken 
      }, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const newIssues = response.data.issues || [];
      allIssues = [...allIssues, ...newIssues];
      
      console.log(`Fetched batch of ${newIssues.length} tickets...`);

      if (response.data.nextPageToken) {
        nextPageToken = response.data.nextPageToken;
      } else {
        isLastPage = true;
      }
    }

    console.log(`--- FETCH COMPLETE: ${allIssues.length} TICKETS FOUND ---`);

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
    console.error("--- ERROR ---");
    // Enhanced error logging for Vercel logs
    if (error.response) {
      console.error(error.response.status);
      console.error(JSON.stringify(error.response.data));
    } else {
      console.error(error.message);
    }
    res.status(500).json({ message: "Failed to fetch data from Jira" });
  }
});

// --- VERCEL EXPORT ---
// This allows the app to work on Vercel Serverless
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Backend running locally at http://localhost:${PORT}`);
  });
}

module.exports = app;