# Assistant routing fix

The built-in assistant previously searched recent conversation history for a case number before determining the user's current intent. Once a case had been discussed, unrelated questions such as "How many open cases are there?" and "Who are you?" could incorrectly return that earlier case's status.

The fix:

- Uses a case number from the current message by default.
- Reuses a previous case number only for explicit follow-ups such as "summarize it" or "what is its status?".
- Gives operational statistics and assigned-case requests priority over case lookups.
- Adds direct responses for greetings, thanks, and assistant identity questions.
- Requests a case number when a status or summary question does not contain one.
- Asks the user to choose status or summary when only a case number is provided.

No database migration is required. Restart the backend after replacing the code.
