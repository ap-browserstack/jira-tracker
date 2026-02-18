const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// This is the "Permission Slip" that fixes the CORS error
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

const auth = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');

app.get('/api/tickets', async (req, res) => {
  try {
    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
    
    const response = await axios.post(jiraUrl, {
      "jql": `project = "${PROJECT_KEY}" AND status != "Done" AND status != "Launched" AND status != "Invalid/ Dispose" AND duedate is not EMPTY AND created >= -90d ORDER BY created DESC`,
      "fields": ["summary", "assignee", "duedate", "issuetype", "status", "id", "key"],
      "maxResults": 500 // CHANGED FROM 100 TO 500
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check' 
      }
    });

    const jiraTickets = (response.data.issues || []).map(issue => ({
      id: issue.id,
      key: issue.key,
      title: issue.fields.summary || "No Title",
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
      due_date: issue.fields.duedate || 'No Date',
      type: issue.fields.issuetype ? issue.fields.issuetype.name : 'Task',
      status: issue.fields.status ? issue.fields.status.name : 'Open',
      link: `https://${JIRA_DOMAIN}/browse/${issue.key}`
    }));

    res.json(jiraTickets);

  } catch (error) {
    res.status(500).json({ error: "Jira Fetch Failed" });
  }
});

module.exports = app;