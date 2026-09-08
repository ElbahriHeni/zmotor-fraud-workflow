# Suspended Case Workflow Update

## Implemented behavior

- The separate Claim Information step has been removed.
- The Case Overview step keeps the **There is a related claim** checkbox.
- Selecting the checkbox shows only **Claim Number** and **Claim Type**.
- Manual case statuses are **Open**, **Suspended**, and **Closed**.
- **Draft** remains available only through the **Save Draft** action.
- Selecting **Suspended** shows and requires:
  - Suspension Date
  - Suspension Duration in Days (calculated automatically)
  - Suspension Reason
- Selecting **Closed** requires Closure Reason.
- Status changes continue to appear in Case Action Log and the system Audit Log.
- The report previously called Suspended Claims Report is now **Suspended Fraud Report** and returns every case whose current case status is Suspended.
- Insurance Type now defaults to **Not Applicable**.
- Case Source includes **Internal**.
- Fraud Queue uses **From Date** and **To Date** fields against Case Entry Date.

## Database impact

No destructive database migration is required for this update. The existing `fraud_cases` table already contains `has_claim`, `claim_type`, `suspension_date`, and `suspension_reason`. Case status is stored in a text field, so `Suspended` does not require a new lookup-table value.

The old `claim_status` database column may remain for historical compatibility, but the updated application no longer uses it.

## Local run

Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_AUTH_MODE=local
```

Backend:

```bash
cd backend
npm install
npm start
```

Frontend in a separate terminal:

```bash
npm install
npm run dev
```

## Suggested verification

1. Create a case and click Save Draft. Confirm its status is Draft.
2. Open the draft. Confirm Draft is displayed but cannot be selected manually again.
3. Change the status to Open and save.
4. Select Suspended. Confirm date, calculated duration, and reason fields appear.
5. Save without a date or reason and confirm validation prevents the change.
6. Save with the required suspension details.
7. Confirm the Action Log shows Open to Suspended.
8. Confirm the Audit Log contains CASE_STATUS_CHANGED.
9. Open Suspended Fraud Report and confirm the case appears.
10. Test the Fraud Queue From Date and To Date filters.
