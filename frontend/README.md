# Smart Home Frontend

Frontend application for the Smart Home monorepo.

## Run

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Environment

Default API base URL:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

## Verification

```bash
npm test
npm run build
```

## Notes

- The frontend consumes the stable backend contract under `/api`.
- SSE continues to use `?token=...` for browser `EventSource` compatibility.
