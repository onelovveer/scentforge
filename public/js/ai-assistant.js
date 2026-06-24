const aiHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('ai-toggle');
  const panel = document.getElementById('ai-panel');
  const closeBtn = document.getElementById('ai-close');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  const messages = document.getElementById('ai-messages');

  if (!toggle) return;

  toggle.addEventListener('click', () => panel.classList.toggle('open'));
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  if (SF.isServer) loadAIStatus();

  async function loadAIStatus() {
    try {
      const res = await SF.fetch('/api/ai/status', { cache: 'no-store' });
      const data = await res.json();
      const hint = document.querySelector('.ai-header h4');
      if (hint && data.label) {
        const ver = data.version ? ` v${data.version}` : '';
        const mode = data.provider === 'gemini' ? ' · Gemini'
          : data.provider === 'groq' ? ' · Groq'
          : data.provider === 'openai' ? ' · GPT'
          : data.needsKey ? ' (нужен API-ключ)' : '';
        hint.textContent = '✨ ' + data.label + ver + mode;
      }
    } catch { /* ignore */ }
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (!SF.isServer) {
      showToast('ИИ работает только через сервер (start.bat)', 'error');
      return;
    }

    appendMessage(text, 'user');
    input.value = '';
    sendBtn.disabled = true;
    input.disabled = true;

    const typing = appendMessage('Думаю...', 'bot');
    typing.style.opacity = '0.6';

    try {
      const res = await SF.fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: aiHistory }),
        cache: 'no-store'
      });
      const data = await res.json();
      typing.remove();

      if (!res.ok) throw new Error(data.error || 'Ошибка');

      appendMessage(data.reply, 'bot');
      aiHistory.push({ role: 'user', content: text });
      aiHistory.push({ role: 'assistant', content: data.reply });
      if (aiHistory.length > 24) aiHistory.splice(0, aiHistory.length - 24);
    } catch (err) {
      typing.remove();
      appendMessage('Не удалось получить ответ. Попробуйте переформулировать вопрос.', 'bot');
    }

    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }

  function appendMessage(text, type) {
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${type === 'user' ? 'user' : 'bot'}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
