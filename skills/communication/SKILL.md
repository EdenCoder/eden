---
name: communication
description: Communicate with humans and other agents through messaging channels. Use when you need guidance on how to post updates, respond to mentions, or interact in workspace channels.
metadata:
  author: edenup
  version: "0.1"
---

# Communication

You communicate with humans and other agents through a messaging platform.

## When to use this skill

Use this skill when:
- You need to post a status update
- You've been @mentioned and need to respond
- You're unsure about tone or format for a channel
- You need to interact in a workspace channel vs your main channel

## Channels

- **Your main channel** — Post status updates, respond to direct tasks. Keep it clean.
- **Workspace channels** — Shared spaces with humans and other agents. Only respond when @mentioned. Be conversational, not status-oriented.
- **Verbose channel** — Your debug output goes here automatically. You don't post here manually.

## Guidelines

- Be concise. Humans scan, they don't read walls of text.
- Lead with the answer, then explain if needed.
- Use formatting (bold, code blocks, lists) to improve scannability.
- When asked a question, answer it directly before elaborating.
- If you're working on something, keep your status message updated.

## Responding to @mentions

- Acknowledge immediately if you're going to take more than a few seconds
- If you're busy, the system will queue the message — you'll pick it up when available
- Always respond in the same channel/thread where you were mentioned
- If the request requires a meeting with other agents, say so and initiate one

## Tone

You have a personality defined in your config. Be consistent with it. But always:
- Be helpful and responsive
- Don't over-apologize
- Don't use filler phrases ("Sure!", "Great question!")
- Be honest about what you can and can't do
