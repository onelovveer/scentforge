function getAmoBaseUrl() {
  const subdomain = (process.env.AMOCRM_SUBDOMAIN || '').trim();
  const domain = (process.env.AMOCRM_DOMAIN || 'amocrm.ru').trim();
  if (!subdomain) return null;
  return `https://${subdomain}.${domain}`;
}

function getCRMProvider() {
  if ((process.env.CRM_PROVIDER || '').trim() === 'amocrm') return 'amocrm';
  if (process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN) return 'amocrm';
  return process.env.CRM_PROVIDER || 'none';
}

function getCRMUrl() {
  const explicit = (process.env.CRM_URL || '').trim();
  if (explicit) return explicit;
  return getAmoBaseUrl();
}

function isCRMConfigured() {
  if (getCRMProvider() !== 'amocrm') return false;
  return !!(process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN);
}

function getCRMStatus() {
  const provider = getCRMProvider();
  const url = getCRMUrl();
  return {
    configured: isCRMConfigured(),
    provider,
    url,
    subdomain: process.env.AMOCRM_SUBDOMAIN || null,
    pipeline_id: process.env.AMOCRM_PIPELINE_ID || null
  };
}

function bootstrapCRM() {
  if (!process.env.CRM_PROVIDER && process.env.AMOCRM_SUBDOMAIN) {
    process.env.CRM_PROVIDER = 'amocrm';
  }
  if (!process.env.CRM_URL && getAmoBaseUrl()) {
    process.env.CRM_URL = getAmoBaseUrl();
  }
}

async function amocrmRequest(path, { method = 'GET', body } = {}) {
  const base = getAmoBaseUrl();
  const token = process.env.AMOCRM_ACCESS_TOKEN;
  if (!base || !token) throw new Error('amoCRM не настроена');

  const res = await fetch(`${base}/api/v4${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`amoCRM ${res.status}: ${text.slice(0, 400)}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function findContactByEmail(email) {
  const data = await amocrmRequest(`/contacts?query=${encodeURIComponent(email)}&limit=1`);
  return data?._embedded?.contacts?.[0] || null;
}

async function createContact(customer) {
  const data = await amocrmRequest('/contacts', {
    method: 'POST',
    body: [{
      name: customer.name || customer.email,
      custom_fields_values: [{
        field_code: 'EMAIL',
        values: [{ value: customer.email, enum_code: 'WORK' }]
      }]
    }]
  });
  return data?._embedded?.contacts?.[0] || null;
}

async function findOrCreateContact(customer) {
  const existing = await findContactByEmail(customer.email);
  if (existing) return existing;
  return createContact(customer);
}

function buildOrderNote(order, items) {
  const lines = items.map(i =>
    `• ${i.name} (${i.brand}) × ${i.qty} — ${(i.price * i.qty).toLocaleString('ru-RU')} ₽`
  );
  return [
    `Заказ ScentForge #${order.id}`,
    `Дата: ${new Date(order.created_at).toLocaleString('ru-RU')}`,
    `Клиент: ${order.user_name} (${order.user_email})`,
    '',
    'Состав:',
    ...lines,
    '',
    `Итого: ${order.total.toLocaleString('ru-RU')} ₽`
  ].join('\n');
}

async function sendAmoCRM(order, customer) {
  if (!isCRMConfigured()) {
    return { sent: false, reason: 'amocrm_not_configured' };
  }

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const contact = await findOrCreateContact(customer);

  const lead = {
    name: `Заказ #${order.id} — ScentForge`,
    price: order.total,
    _embedded: {
      contacts: [{ id: contact.id }]
    }
  };

  const pipelineId = process.env.AMOCRM_PIPELINE_ID ? Number(process.env.AMOCRM_PIPELINE_ID) : null;
  const statusId = process.env.AMOCRM_STATUS_ID ? Number(process.env.AMOCRM_STATUS_ID) : null;
  if (pipelineId) lead.pipeline_id = pipelineId;
  if (statusId) lead.status_id = statusId;

  const leadData = await amocrmRequest('/leads', {
    method: 'POST',
    body: [lead]
  });

  const leadId = leadData?._embedded?.leads?.[0]?.id;
  if (!leadId) throw new Error('amoCRM: сделка не создана');

  await amocrmRequest(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: [{
      note_type: 'common',
      params: { text: buildOrderNote(order, items) }
    }]
  });

  console.log(`[CRM] amoCRM: сделка #${leadId} для заказа #${order.id}`);
  return { sent: true, provider: 'amocrm', lead_id: leadId, contact_id: contact.id };
}

async function sendOrderToCRM(order, customer) {
  bootstrapCRM();

  if (!isCRMConfigured()) {
    console.log('[CRM] amoCRM не настроена. Заказ #' + order.id + ' не отправлен.');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    return await sendAmoCRM(order, customer);
  } catch (err) {
    console.error('[CRM] amoCRM заказ #' + order.id + ':', err.message);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = {
  bootstrapCRM,
  getCRMUrl,
  getCRMStatus,
  isCRMConfigured,
  sendOrderToCRM
};
