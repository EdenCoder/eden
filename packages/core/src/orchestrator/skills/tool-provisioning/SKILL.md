---
name: tool-provisioning
description: Find and provision tools for agents — search for first-party MCP servers, build custom ones from official docs, handle approval flow. Use when an agent requests a tool it doesn't have.
metadata:
  author: edenup
  version: "0.1"
---

# Tool Provisioning

When an agent requests a tool, you are responsible for finding or building it.

## When to use this skill

- An agent has filed a tool request (it discovered it needs something it doesn't have)
- You're provisioning a new agent and need to set up its tools
- A tool needs to be updated or replaced

## Policy: first-party only

NEVER use third-party MCP servers. Only:

1. **Official MCP** — If the product publishes their own MCP server in their official docs, use that.
2. **Self-built from official docs** — If no official MCP exists, use OpenCode CLI to scaffold one from the product's official API documentation.

No random npm packages. No community-maintained wrappers. If you can't find it on the product's own website, build it yourself from the official API docs.

## Resolution process

1. Receive tool request from agent
2. Search for official MCP: check the product's docs, their GitHub, the MCP registry
3. If found: configure it, determine what secrets are needed
4. If not found: read the product's official API docs, scaffold an MCP server
5. Determine risk level: does it post publicly? cost money? access sensitive data?
6. If low risk + no secrets needed: auto-provision
7. If high risk or needs secrets: post approval request to #approvals

## Approval request format

Include: agent name, tool name, source URL, required secrets, risk assessment. The human needs enough context to make an informed decision.
