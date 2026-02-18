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
    const jiraUrl = `https://${JIRA_DOMAIN}/rest/api/3/search`;
    let allIssues = [];
    let startAt = 0;
    const maxResults = 100; // Max per page
    let total = 0;

    // The "Loop" that keeps fetching until everything is caught
    do {
      const response = await axios.post(jiraUrl, {
        "jql": `project = "${PROJECT_KEY}" AND status != "Done" AND status != "Launched" AND status != "Invalid/ Dispose" AND duedate is not EMPTY AND created >= -90d ORDER BY created DESC`,
        "fields": ["summary", "assignee", "duedate", "issuetype", "status", "id", "key"],
        "maxResults": maxResults,
        "startAt": startAt
      }, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Atlassian-Token': 'no-check'
        }
      });

      const issues = response.data.issues || [];
      allIssues = [...allIssues, ...issues];
      total = response.data.total; // Total tickets matching the query in Jira
      startAt += maxResults; // Move to the next page (101, 201, etc.)

    } while (allIssues.length < total); // Stop when we have everything

    // Map the results as before
    const jiraTickets = allIssues.map(issue => ({
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
    console.error("Fetch Error:", error.message);
    res.status(500).json({ error: "Failed to fetch all pages" });
  }
});

module.exports = app;