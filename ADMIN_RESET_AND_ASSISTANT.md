# Administrator Password Reset and Read-Only Intelligent Assistant

## 1. Password recovery policy

There is no public **Forgot Password** workflow. Local passwords are never recoverable because only a bcrypt hash is stored.

When a local user forgets a password:

1. A System Administrator opens **User Management**.
2. The administrator opens the user record.
3. Under **Reset Password**, the administrator either:
   - enters and confirms a new temporary password; or
   - selects **Generate temporary password and reset**.
4. A server-generated password is shown once and can be copied.
5. Existing sessions are invalidated by increasing the user's token version.
6. The user must change the temporary password at the next login.
7. The reset is written to the Audit Log as `USER_PASSWORD_RESET`.

Microsoft AD passwords are not reset by this application.

## 2. Intelligent assistant scope

The assistant is available as a floating **AI** button to users with `assistant.use`.

It is read-only and supports:

- Application guidance, including case creation, statuses, attachments, reports, assignments, queue filters, roles, permissions, and administrator password reset.
- Authorized case-status lookup.
- Authorized case summarization without reporter email, mobile number, or national ID.
- Listing cases assigned to the signed-in user.
- Operational case counts: total, open, suspended, closed, personal drafts, and high-priority cases.

It cannot create, edit, assign, suspend, close, or delete cases.

## 3. Assistant permissions

- `assistant.use`
- `assistant.view_case_status`
- `assistant.summarize_cases`
- `assistant.view_assigned_cases`
- `assistant.view_operational_statistics`

The assistant also enforces the underlying module permissions. For example, case lookup requires both the assistant permission and `cases.view`.

Draft privacy is preserved: another user's draft cannot be retrieved or summarized by the assistant.

## 4. Built-in secure mode

The default configuration is:

```env
ASSISTANT_PROVIDER=rules
```

This mode works locally without an API key and without sending case data outside the application. It recognizes common English and Arabic questions and calls controlled read-only backend tools.

Example questions:

- `How do I create a fraud case?`
- `What is the status of case FC-20260623-4625?`
- `Summarize case FC-20260623-4625.`
- `Show the cases assigned to me.`
- `How many cases are open, suspended, and closed?`

## 5. Optional OpenAI mode

For more flexible natural-language understanding, configure:

```env
ASSISTANT_PROVIDER=openai
OPENAI_API_KEY=YOUR_API_KEY
OPENAI_MODEL=gpt-5.5
```

The backend uses read-only function tools. The model never connects directly to the database. The application executes each tool after checking the signed-in user's permissions.

Only sanitized case data is supplied to assistant tools. Reporter personal details and credentials are excluded. Confirm customer information-security and data-residency approval before enabling an external AI provider in a production environment.

If the AI provider is unavailable, the system automatically falls back to the built-in rules assistant.

## 6. Audit events

Assistant activity is recorded without storing the full user question in the audit details:

- `ASSISTANT_GUIDANCE_REQUEST`
- `ASSISTANT_CASE_STATUS_LOOKUP`
- `ASSISTANT_CASE_SUMMARY`
- `ASSISTANT_ASSIGNED_CASES_LOOKUP`
- `ASSISTANT_OPERATIONAL_STATISTICS`
- `ASSISTANT_ACCESS_DENIED`
- `ASSISTANT_QUESTION`

## 7. Deployment

Restart the backend so `ensureRbacSchemaDb` inserts the new assistant permissions and assigns them to the standard roles.

If the application database user cannot update RBAC records automatically, run the appropriate migration:

- `backend/migration_rbac_mssql.sql`
- `backend/migration_rbac_postgres.sql`

Users should sign out and sign back in after the backend restarts so their security context reflects the new permissions.
