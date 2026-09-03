# Supabase backend

`schema.sql` is the source-controlled backend for the GitHub Pages version of
the AI Star scorecard. It creates the shared tables, explicit Data API grants,
Row Level Security policies, approval RPCs, and audit triggers.

Runtime data and API secrets are deliberately excluded from Git. The browser
uses only the project's publishable key; the service-role key is never used by
the site.

Production Auth must allow this exact redirect URL:

`https://ycyoon.github.io/ai-star-scoreboard/`

Email confirmation should remain enabled. Configure a custom SMTP provider for
production delivery if the project's default email service is insufficient.
