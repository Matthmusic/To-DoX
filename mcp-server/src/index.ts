#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TodoxClient } from './api.js';
import { registerReviewTools } from './tools/review.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerTimesheetTools } from './tools/timesheet.js';

// Configuration par variables d'environnement (définies dans la config du client MCP) :
//   TODOX_API_URL   URL du backend To-DoX (même valeur que VITE_API_URL de l'app)
//   TODOX_EMAIL     + TODOX_PASSWORD : identifiants To-DoX
//   TODOX_TOKEN     (alternative) JWT déjà obtenu
const client = new TodoxClient({
  baseUrl: (process.env.TODOX_API_URL || 'http://localhost:3001').replace(/\/+$/, ''),
  email: process.env.TODOX_EMAIL,
  password: process.env.TODOX_PASSWORD,
  token: process.env.TODOX_TOKEN,
});

const server = new McpServer(
  { name: 'todox', version: '0.1.0' },
  {
    instructions:
      "Serveur MCP de To-DoX (Kanban + feuilles d'heures). Les noms de projets et titres de tâches sont en MAJUSCULES. " +
      'Statuts : todo → doing → review → done. Les dates sont au format YYYY-MM-DD. ' +
      "Pour remplir une feuille d'heures : get_activity pour voir ce qui a été fait, list_projects pour les noms exacts, " +
      "proposer la répartition à l'utilisateur, puis set_time_entries une fois validée.",
  }
);

registerTaskTools(server, client);
registerReviewTools(server, client);
registerTimesheetTools(server, client);

await server.connect(new StdioServerTransport());
// stdout est réservé au protocole MCP : les logs vont sur stderr.
// eslint-disable-next-line no-console
console.error(`[todox-mcp] prêt — backend ${client.baseUrl}`);
