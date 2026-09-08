# Decisions Step Removal

The separate **Decisions** step has been removed from the case workflow.

## New behavior

- Case status is managed only from **Case Overview**.
- Users can manually select **Open** or **Closed**.
- Saving as draft still creates a **Draft** case.
- Closing a case requires a closure reason.
- Reopening a case is done by changing the status back to **Open**.
- Fraud Unit Notes were moved to **Case Overview** so existing business information is not lost.
- The old decision API is no longer exposed. The existing database column is retained for backward compatibility and historical data; no destructive database migration is required.
- The action log now displays previous/new status only for case creation and real status changes.
