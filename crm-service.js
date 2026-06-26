let cachedPipelineMeta = null;

function getAmoBaseUrl() {
  const subdomain = (process.env.AMOCRM_SUBDOMAIN || '').trim();
  const domain = (process.env.AMOCRM_DOMAIN || 'amocrm.ru').trim();
  if (!subdomain) return null;
  return `https://${subdomain}.${domain}`;
}

function getCRMUrl() {
  const explicit = (process.env.CRM_URL || '').trim();
  const base = getAmoBaseUrl();

  if (explicit && !isGenericAmoHomepage(explicit)) {
    return explicit;
  }

  if (!base) return null;

  const pipelineId = process.env.AMOCRM_PIPELINE_ID
    ? Number(process.env.AMOCRM_PIPELINE_ID)
    : cachedPipelineMeta?.pipeline_id || null;
  if (pipelineId) {
    return `${base}/leads/pipeline/${pipelineId}/`;
  }
  return `${base}/leads/list/`;
}

function getCRMProvider() {
  if ((process.env.CRM_PROVIDER || '').trim() === 'amocrm') return 'amocrm';
  if (process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN) return 'amocrm';
  return process.env.CRM_PROVIDER || 'none';
}

function isGenericAmoHomepage(url) {
  return /^(https?:\/\/)?(www\.)?amocrm\.ru\/?$/i.test(url);
}

function isCRMConfigured() {
  if (getCRMProvider() !== 'amocrm') return false;
  return !!(process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN);
}

function getCRMStatus() {
  const provider = getCRMProvider();
  return {
    configured: isCRMConfigured(),
    provider,
    url: getCRMUrl(),
    subdomain: process.env.AMOCRM_SUBDOMAIN || null,
    pipeline_id: process.env.AMOCRM_PIPELINE_ID || cachedPipelineMeta?.pipeline_id || null
  };
}

function bootstrapCRM() {
  if (!process.env.CRM_PROVIDER && process.env.AMOCRM_SUBDOMAIN) {
    process.env.CRM_PROVIDER = 'amocrm';
  }
}

async function amocrmRequest(path, { method = 'GET', body } = {}) {
  const base = getAmoBaseUrl();
  const token = (process.env.AMOCRM_ACCESS_TOKEN || '').trim();
  if (!base || !token) throw new Error('amoCRM не настроена: проверьте AMOCRM_SUBDOMAIN и AMOCRM_ACCESS_TOKEN');

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
    throw new Error(`amoCRM ${res.status}: ${text.slice(0, 500)}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getPipelineMeta() {
  if (cachedPipelineMeta) return cachedPipelineMeta;

  const envPipeline = process.env.AMOCRM_PIPELINE_ID ? Number(process.env.AMOCRM_PIPELINE_ID) : null;
  const envStatus = process.env.AMOCRM_STATUS_ID ? Number(process.env.AMOCRM_STATUS_ID) : null;

  const data = await amocrmRequest('/leads/pipelines');
  const pipelines = data?._embedded?.pipelines || [];
  if (!pipelines.length) throw new Error('amoCRM: нет доступных воронок');

  const pipeline = envPipeline
    ? pipelines.find(p => p.id === envPipeline) || pipelines[0]
    : pipelines[0];

  const statuses = pipeline._embedded?.statuses || [];
  const status = envStatus
    ? statuses.find(s => s.id === envStatus) || statuses[0]
    : statuses[0];

  if (!status) throw new Error('amoCRM: не найден этап воронки');

  cachedPipelineMeta = {
    pipeline_id: pipeline.id,
    status_id: status.id,
    pipeline_name: pipeline.name,
    status_name: status.name
  };
  return cachedPipelineMeta;
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

function splitCustomerName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: 'Клиент', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

async function sendAmoCRM(order, customer) {
  if (!isCRMConfigured()) {
    return { sent: false, reason: 'amocrm_not_configured' };
  }

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const pipeline = await getPipelineMeta();
  const { first_name, last_name } = splitCustomerName(customer.name);

  const lead = {
    name: `Заказ #${order.id} — ScentForge`,
    price: order.total,
    pipeline_id: pipeline.pipeline_id,
    status_id: pipeline.status_id,
    _embedded: {
      contacts: [{
        first_name,
        last_name: last_name || undefined,
        custom_fields_values: [{
          field_code: 'EMAIL',
          values: [{ value: customer.email, enum_code: 'WORK' }]
        }]
      }]
    }
  };

  const leadData = await amocrmRequest('/leads', {
    method: 'POST',
    body: [lead]
  });

  const created = leadData?._embedded?.leads?.[0];
  const leadId = created?.id;
  if (!leadId) throw new Error('amoCRM: сделка не создана — пустой ответ API');

  await amocrmRequest(`/leads/${leadId}/notes`, {
    method: 'POST',
    body: [{
      note_type: 'common',
      params: { text: buildOrderNote(order, items) }
    }]
  });

  console.log(`[CRM] amoCRM: сделка #${leadId} (${pipeline.pipeline_name} → ${pipeline.status_name}) для заказа #${order.id}`);
  return {
    sent: true,
    provider: 'amocrm',
    lead_id: leadId,
    pipeline: pipeline.pipeline_name,
    status: pipeline.status_name
  };
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

async function testAmoCRMConnection() {
  if (!isCRMConfigured()) {
    return { ok: false, error: 'Не заданы AMOCRM_SUBDOMAIN или AMOCRM_ACCESS_TOKEN' };
  }

  try {
    const account = await amocrmRequest('/account?with=amojo_id');
    const pipeline = await getPipelineMeta();
    return {
      ok: true,
      account: account?.name || process.env.AMOCRM_SUBDOMAIN,
      subdomain: process.env.AMOCRM_SUBDOMAIN,
      pipeline
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  bootstrapCRM,
  getCRMUrl,
  getCRMStatus,
  isCRMConfigured,
  sendOrderToCRM,
  testAmoCRMConnection
};
