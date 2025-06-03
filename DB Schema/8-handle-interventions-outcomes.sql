ALTER TABLE patient_case_study_highlights
ADD COLUMN interventions text[],
ADD COLUMN outcomes text[],
ADD COLUMN clinical_risks text[];


UPDATE patient_case_study_highlights
SET
  interventions = '{}',
  outcomes = '{}',
  clinical_risks = '{}'
WHERE
  interventions IS NULL
  OR outcomes IS NULL
  OR clinical_risks IS NULL;
