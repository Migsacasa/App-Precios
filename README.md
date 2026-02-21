# La Calle No Miente
Comparativo de Competencia

## Local ports
- Web app (`price-compare`): `http://localhost:3000`
- API (`App-Precios`): `http://localhost:3001` (default)

## Run both services together

From the repository root:

```bash
npm install
npm run dev
```

If ports are stuck from previous runs, use:

```bash
npm run dev:reset
```

This starts:
- Web app (`price-compare`) on `http://localhost:3000`
- API (`App-Precios`) on `http://localhost:3001`

To override the API port:

```bash
cd App-Precios
PORT=3000 npm start
```
