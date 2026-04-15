# PPT Reader API

Upload `.ppt` / `.pptx` files and get back all extracted metadata including document properties, slide information, and a text preview.

## Tech Stack

| Library | Purpose |
|---|---|
| **Express 5** | HTTP server |
| **Multer 2** | File upload handling |
| **officeparser 6** | PPT/PPTX parsing & metadata extraction |
| **Winston 3** | Structured logging |

## Quick Start

```bash
npm install
npm start
```

Server starts on `http://localhost:3000` (override with `PORT` env variable).

## API

### `POST /upload`

Upload a PPT/PPTX file (multipart form-data, field name: `file`).

```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@presentation.pptx"
```

**Response:**

```json
{
  "success": true,
  "metadata": {
    "file": {
      "name": "file-1234567890-123456789.pptx",
      "size": 102400,
      "sizeHuman": "100 KB",
      "extension": ".pptx",
      "lastModified": "2026-03-30T10:00:00.000Z"
    },
    "document": {
      "title": "My Presentation",
      "creator": "John Doe",
      "lastModifiedBy": "Jane Smith",
      "created": "2026-01-01T00:00:00Z",
      "modified": "2026-03-01T00:00:00Z"
    },
    "slides": {
      "count": 12,
      "details": [
        { "index": 1, "title": "Introduction", "textLength": 250 }
      ]
    },
    "textPreview": "First 2000 characters of text..."
  }
}
```

### `GET /health`

Health check endpoint.

## Constraints

- Max file size: **50 MB**
- Accepted extensions: `.ppt`, `.pptx`
- Uploaded files are deleted after processing

## Logs

Logs are written to `logs/combined.log` and `logs/error.log`. In development, logs also print to the console with color.
