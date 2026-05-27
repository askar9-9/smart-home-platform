# homeIQ ML Package

This package contains the reusable ML-specific pieces for homeIQ:

- feature extraction for energy anomaly detection;
- model artifact loading;
- shared anomaly scoring helpers.

Backend-specific concerns such as database access, FastAPI error mapping, and `/api/ml/...` orchestration remain in `backend`.
