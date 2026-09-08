# Motor Fraud Workflow

Menu: one item only: **Motor Fraud** -> Motor Fraud Cases. Creation is available from the list page to users with `motor_fraud.create`.

Workflow:
1. Motor Agent creates the case, completes the Motor fields, adds documents, and submits.
2. First escalation timestamp is automatically created on first submission to Legal.
3. Legal adds a private internal comment and either approves or returns to Motor with a separate Motor-visible request.
4. Legal approval automatically creates the second escalation timestamp and routes the case to Fraud.
5. Fraud adds a private internal comment and can close, reject/close, or return to Motor with a Motor-visible request.
6. When Legal or Fraud returns the case, the Motor initiator can update/add documents and resubmit to the team that returned it, or close the request.
7. Motor never receives Legal/Fraud internal comments from the API. Return requests are deliberately separate and visible to Motor.
8. Workflow activity is stored in `motor_fraud_history`; Motor Fraud API traffic is also written to the general Audit Log.

System roles seeded by the backend:
- `MOTOR_AGENT`
- `LEGAL_REVIEWER`
- Existing Fraud Manager / Fraud Investigator roles receive Fraud-review permissions.

The indicator hierarchy is sourced from the uploaded Insurance Authority appendix and is enforced server-side as well as through cascading UI dropdowns.

## Workflow evidence and final closure update (31-Aug-2026)

- Motor may upload evidence while a case is Draft or returned to Motor.
- Legal reviewers may upload evidence while the case status is `With Legal`.
- Fraud reviewers may upload evidence while the case status is `With Fraud`.
- Selected Legal/Fraud files are uploaded before a review decision changes the workflow stage.
- Fraud is the final workflow team and can close the case directly (`Closed`) or reject and close it (`Rejected`).
- Motor may still close a request only after Legal or Fraud returns it to Motor.
- Legal/Fraud internal comments remain filtered from the Motor initiator; document uploads are logged in the workflow history.
