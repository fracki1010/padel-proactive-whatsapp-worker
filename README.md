# padel-proactive-whatsapp-worker

Worker de WhatsApp desacoplado del backend API.

## Responsabilidades

- Consumir comandos desde Redis/BullMQ.
- Ejecutar acciones de WhatsApp (activar/desactivar, enviar mensaje, reiniciar, listar grupos).
- Persistir estado de comando y runtime en Mongo.
- Exponer healthcheck HTTP.

## Ejecutar

```bash
cp .env.example .env
npm install
npm start
```

## Variables clave

- `MONGO_URI`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `WHATSAPP_QUEUE_NAME` (default `whatsapp-commands`)
- `WORKER_CONCURRENCY` (default `2`)

## Contrato de job BullMQ

- `job.name`: `whatsapp-command`
- `job.data`:
  - `commandId` (Mongo `_id` de `WhatsappCommand`)
  - `companyId`
  - `type`
  - `payload`
# padel-proactive-whatsapp-worker
