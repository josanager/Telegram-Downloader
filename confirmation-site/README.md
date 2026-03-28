# Confirmation Site

Static confirmation page for Misil payments.

## Local preview

Run a static server from this directory:

```bash
python3 -m http.server 4173
```

Open:

- `http://localhost:4173/pago-completado/`
- `http://localhost:4173/pago-completado/?plan=pro`
- `http://localhost:4173/pago-completado/?plan=forever`

## Cloudflare Pages

Deploy this folder as the Pages output directory:

- project root: `confirmation-site`
- build command: none
- output directory: `.`

Recommended final route:

- `/pago-completado/`
