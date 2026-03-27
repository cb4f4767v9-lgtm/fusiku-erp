# FUSIKU ERP Public API

**Think Smart. Play Cool.**

## Authentication

All requests to the Public API require an API key.

### Headers

```
X-API-Key: fusiku_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Or:

```
Authorization: Bearer fusiku_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Obtaining an API Key

1. Log in to FUSIKU ERP
2. Go to **Developer Settings**
3. Click **Generate** to create a new API key
4. Copy the key immediately — it is shown only once

### Permissions

API keys have scoped permissions:

| Permission       | Description                    |
|-----------------|--------------------------------|
| `read_inventory`| List inventory and devices      |
| `create_sales`  | Create sales via API           |
| `read_reports`  | Access dashboard and reports   |

## Base URL

```
https://your-domain.com/api/public/v1
```

## Rate Limiting

- **100 requests per minute** per API key
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- HTTP 429 when exceeded

## Endpoints

### GET /inventory

List all inventory items.

**Permission:** `read_inventory`

**Query params:** `branchId`, `status`, `search`, `brand`, `model`, etc.

**Example request:**
```bash
curl -H "X-API-Key: fusiku_xxx" "https://api.example.com/api/public/v1/inventory?status=available"
```

**Example response:**
```json
{
  "data": [
    {
      "id": "clx...",
      "imei": "123456789012345",
      "brand": "Apple",
      "model": "iPhone 11",
      "storage": "128GB",
      "color": "Black",
      "condition": "refurbished",
      "purchasePrice": 200,
      "sellingPrice": 299,
      "status": "available",
      "branchId": "clx...",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### GET /devices

List available devices (inventory with status=available).

**Permission:** `read_inventory`

**Example response:**
```json
{
  "data": [
    {
      "imei": "123456789012345",
      "brand": "Apple",
      "model": "iPhone 11",
      "storage": "128GB",
      "color": "Black",
      "condition": "refurbished",
      "sellingPrice": 299
    }
  ]
}
```

### POST /sales

Create a sale.

**Permission:** `create_sales`

**Request body:**
```json
{
  "branchId": "optional-if-single-branch",
  "customerId": "optional",
  "items": [{ "inventoryId": "clx..." }],
  "paymentMethod": "cash",
  "notes": "optional"
}
```

**Example request:**
```bash
curl -X POST -H "X-API-Key: fusiku_xxx" -H "Content-Type: application/json" \
  -d '{"items":[{"inventoryId":"clx123"}]}' \
  "https://api.example.com/api/public/v1/sales"
```

**Example response:**
```json
{
  "data": {
    "id": "clx...",
    "totalAmount": 299,
    "profit": 99,
    "saleItems": [...]
  }
}
```

### GET /reports

Get dashboard reports.

**Permission:** `read_reports`

**Query params:** `branchId`

**Example response:**
```json
{
  "data": {
    "totalDevicesInStock": 50,
    "totalInventoryValue": 15000,
    "todaySales": 500,
    "recentSales": [...]
  }
}
```

## Webhooks

Configure webhooks in **Developer Settings** to receive event notifications.

### Events

| Event              | Description                    |
|--------------------|--------------------------------|
| `sale.completed`   | Sale finalized                 |
| `repair.completed` | Repair marked complete         |
| `inventory.updated`| Inventory item updated         |
| `low_stock.alert`  | Low stock threshold triggered  |

### Payload

Webhooks receive HTTP POST with:

- `Content-Type: application/json`
- `X-Webhook-Event`: event type
- `X-Webhook-Signature`: `sha256=<hmac>` (verify with your secret)

**Body:**
```json
{
  "event": "sale.completed",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "data": { ... }
}
```

### Signature Verification

```javascript
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
if (signature !== expected) throw new Error('Invalid signature');
```
