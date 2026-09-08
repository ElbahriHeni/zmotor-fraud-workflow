# Fraud Assessment Module

## Navigation

The **Fraud Assessment** item in the left menu expands to the eight assessment areas supplied in `Fraud Assessment 2026.xlsx`:

- 01. Strategy & Risk Appetite
- 02. Governance Risk Framework
- 03. Core Decisions & Processes
- 04. Controls & Rules
- 05. Organisation & Culture
- 06. People & Performance
- 07. Core Technology Systems
- 08. Data, Analytics & MI

The source workbook's **Glossary**, **Instructions**, and **NAVIGATOR** content is not exposed as assessment navigation or form content.

## Form behaviour

Every assessment uses the same screen pattern originally implemented for **01. Strategy & Risk Appetite**:

- Assessment title and status/progress summary.
- Tabs for the source workbook's sections within that assessment.
- Every question has an **Answer** and **Comments** field.
- Questions marked `Select only one answer` in the workbook render as single-select controls.
- Questions marked `Select all that apply` render as multi-select controls.
- Other questions render as text inputs.
- `Other, please specify` reveals a conditional text field when it is an available option.
- **Save Draft**, **Submit Assessment**, and **Export Excel** are available through the same RBAC permissions used by assessment 01.
- Glossary/definition expanders have been removed from the UI.

### Source-workbook note

The source workbook identifies 03.034, 03.036, and 03.040 as selection questions, but their selectable choices are not exposed in the workbook's recoverable Checkboxes/lookup structures. These three are therefore rendered as text answers rather than inventing choices that are not present in the supplied source.

## Excel export

All assessment exports use the supplied original workbook as the template:

`backend/templates/fraud-assessment-template.xlsx`

For the selected assessment:

- Answers are written into the original Answer cells.
- Comments are written into the original Comments cells.
- Recoverable single-select and multi-select controls are updated in the workbook.
- The selected assessment worksheet is the only assessment worksheet shown to the user in the export.
- `Instructions`, `NAVIGATOR`, helper sheets, and the other assessment worksheets are hidden.
- The source Glossary column is hidden in the exported assessment worksheet.

No additional npm package is required for the Excel export. The backend updates the XLSX package using Node.js built-in modules.

## RBAC permissions

- `fraud_assessment.view`
- `fraud_assessment.edit`
- `fraud_assessment.submit`

Users with `fraud_assessment.view` can export assessments to Excel.

## API

The same generic endpoints support assessment codes `01` through `08`:

- `GET /api/fraud-assessments/:assessmentCode`
- `PUT /api/fraud-assessments/:assessmentCode`
- `POST /api/fraud-assessments/:assessmentCode/submit`
- `POST /api/fraud-assessments/:assessmentCode/export`

The backend validates that submitted question codes belong to the selected assessment.

## Database

No new database tables are needed for assessments 02-08. The existing generic tables support all assessment codes:

- `fraud_assessments`
- `fraud_assessment_answers`

The existing fraud-assessment migration remains sufficient.

## Local development

Frontend:

```powershell
cd <project-folder>
npm install
npm run dev
```

Backend (second terminal):

```powershell
cd <project-folder>\backend
npm install
npm start
```

For local development, `npm run dev` is enough for the frontend. Run `npm run build` later when preparing a production frontend package for IIS.
