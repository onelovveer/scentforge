function getCRMUrl() {
  return (process.env.CRM_URL || '').trim() || null;
}

function isCRMConfigured() {
  if (process.env.CRM_WEBHOOK_URL) return true;
  if (process.env.CRM_PROVIDER === 'amocrm') {
    return !!(process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN);
  }
  return false;
}

function getCRMStatus() {
  const provider = process.env.CRM_PROVIDER || (process.env.CRM_WEBHOOK_URL ? 'webhook' : 'none');
  return {
    configured: isCRMConfigured(),
    provider,
    url: getCRMUrl()
  };
}

function buildOrderPayload(order, customer) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  return {
    event: 'order.created',
    source: 'scentforge',
    order: {
      id: order.id,
      total: order.total,
      status: order.status,
      created_at: order.created_at,
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        brand: i.brand,
        price: i.price,
        qty: i.qty,
        line_total: i.price * i.qty
      }))
    },
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email
    }
  };
}

async function sendWebhook(order, customer) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return { sent: false, reason: 'webhook_not_configured' };

  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'ScentForge-CRM/1.0' };
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildOrderPayload(order, customer)),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook ${res.status}: ${text.slice(0, 200)}`);
  }

  return { sent: true, provider: 'webhook' };
}

async function sendAmoCRM(order, customer) {
  const subdomain = process.env.AMOCRM_SUBDOMAIN;
  const token = process.env.AMOCRM_ACCESS_TOKEN;
  if (!subdomain || !token) return { sent: false, reason: 'amocrm_not_configured' };

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const itemsText = items
    .map(i => `${i.name} (${i.brand}) × ${i.qty} — ${(i.price * i.qty).toLocaleString('ru-RU')} ₽`)
    .join('\n');

  const pipelineId = process.env.AMOCRM_PIPELINE_ID ? Number(process.env.AMOCRM_PIPELINE_ID) : undefined;

  const lead = {
    name: `Заказ #${order.id} — ScentForge`,
    price: order.total,
    _embedded: {
      contacts: [{
        name: customer.name,
        custom_fields_values: [{
          field_code: 'EMAIL',
          values: [{ value: customer.email, enum_code: 'WORK' }]
        }]
      }]
    }
  };
  if (pipelineId) lead.pipeline_id = pipelineId;

  const leadRes = await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify([lead]),
    signal: AbortSignal.timeout(15000)
  });

  if (!leadRes.ok) {
    const text = await leadRes.text().catch(() => '');
    throw new Error(`amoCRM ${leadRes.status}: ${text.slice(0, 200)}`);
  }

  const leadData = await leadRes.json();
  const leadId = leadData._embedded?.leads?.[0]?.id;

  if (leadId) {
    await fetch(`https://${subdomain}.amocrm.ru/api/v4/leads/${leadId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify([{
        note_type: 'common',
        params: { text: `Состав заказа:\n${itemsText}\n\nИтого: ${order.total.toLocaleString('ru-RU')} ₽` }
      }]),
      signal: AbortSignal.timeout(15000)
    }).catch(err => console.error('[CRM] amoCRM note:', err.message));
  }

  return { sent: true, provider: 'amocrm', lead_id: leadId || null };
}

async function sendOrderToCRM(order, customer) {
  if (!isCRMConfigured()) {
    console.log('[CRM] Не настроена. Заказ #' + order.id + ' не отправлен во внешнюю CRM.');
    return { sent: false, reason: 'not_configured' };
  }

  const provider = process.env.CRM_PROVIDER || 'webhook';

  try {
    if (provider === 'amocrm') {
      return await sendAmoCRM(order, customer);
    }
    return await sendWebhook(order, customer);
  } catch (err) {
    console.error('[CRM] Ошибка отправки заказа #' + order.id + ':', err.message);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = { getCRMUrl, getCRMStatus, isCRMConfigured, sendOrderToCRM };
