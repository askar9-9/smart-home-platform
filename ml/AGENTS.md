# ML Agent Notes

This project is the reusable ML module for Smart Home energy analysis.

## Scope

- Keep this package framework-light and reusable.
- Put pure ML logic here: feature extraction, artifact loading, scoring helpers.
- Keep database access, HTTP errors, and FastAPI endpoint orchestration out of this package.

## Structure

- `src/smart_home_ml/features.py`: feature engineering helpers
- `src/smart_home_ml/model.py`: artifact loading and scoring helpers
- `src/smart_home_ml/artifacts`: packaged trained model artifacts when needed

## Safety

- Avoid importing backend application modules into `ml`.
- Preserve stable Python interfaces consumed by `backend/app/services/ml.py`.
- Keep model/runtime errors generic enough for backend to map them into API responses.
