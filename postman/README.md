# Postman And Codex Setup

This folder lets Postman and Codex work from the same source-controlled API collection.

## Import Into Postman

1. Open Postman.
2. Click `Import`.
3. Import:

```txt
postman/AI-Enabled-Wound-APIs.postman_collection.json
postman/AI-Enabled-Wound-APIs.postman_environment.json
```

4. Select the environment `AI-Enabled Wound APIs - Local`.
5. Start the API server:

```bash
npm start
```

6. Run requests from the imported collection.

## How Codex Can Help

Codex can update these files whenever you add/change routes:

```txt
postman/AI-Enabled-Wound-APIs.postman_collection.json
postman/AI-Enabled-Wound-APIs.postman_environment.json
```

You can ask:

```txt
Add new doctor APIs to the Postman collection.
Add tests for subscription APIs.
Update Postman examples from current controllers.
```

## Running From Codex Or Terminal

Postman app can run the collection from UI. For command-line runs, install Newman or Postman CLI.

Newman example:

```bash
npx newman run postman/AI-Enabled-Wound-APIs.postman_collection.json -e postman/AI-Enabled-Wound-APIs.postman_environment.json
```

If `newman` is not installed, Codex will ask for approval before downloading it.

## Secrets

Do not commit real production tokens, API keys, passwords, or Postman API keys. Keep those in your local Postman environment or `.env`.
