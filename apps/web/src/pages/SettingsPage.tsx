import { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import { api, type AIConfig } from '../lib/api';

export function SettingsPage() {
  const [config, setConfig]     = useState<AIConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  const [provider, setProvider]       = useState<AIConfig['provider']>('openrouter');
  const [model, setModel]             = useState('');
  const [apiKey, setApiKey]           = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [maxTokens, setMaxTokens]     = useState(2048);
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    api.ai.getConfig().then(({ config }) => {
      if (config) {
        setConfig(config);
        setProvider(config.provider);
        setModel(config.model);
        setEndpointUrl(config.endpoint_url ?? '');
        setMaxTokens(config.max_tokens);
        setTemperature(parseFloat(config.temperature));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { config: updated } = await api.ai.saveConfig({
        provider,
        model: model || 'qwen2.5:7b',
        ...(apiKey ? { api_key: apiKey } : {}),
        endpoint_url:  endpointUrl || undefined,
        max_tokens:    maxTokens,
        temperature:   temperature as unknown as string,
        features:      config?.features ?? { compose: true, reply: true, summary: true },
      });
      setConfig(updated);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const PROVIDER_DEFAULTS: Record<AIConfig['provider'], { model: string; endpoint: string; note: string }> = {
    openai:      { model: 'gpt-4o',            endpoint: '',                             note: 'Uses api.openai.com' },
    openrouter:  { model: 'qwen/qwen-2.5-7b',  endpoint: '',                             note: 'Uses openrouter.ai — access 200+ models' },
    ollama:      { model: 'qwen2.5:7b',         endpoint: 'http://localhost:11434',       note: 'Run models locally with Ollama' },
  };

  const defaults = PROVIDER_DEFAULTS[provider];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-slate-800 mb-6">Settings</h1>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">AI Assistant</h2>

          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as AIConfig['provider'];
                  setProvider(p);
                  setModel(PROVIDER_DEFAULTS[p].model);
                  setEndpointUrl(PROVIDER_DEFAULTS[p].endpoint);
                }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (local)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">{defaults.note}</p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={defaults.model}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                API Key {config?.has_api_key && <span className="text-green-600 font-normal">(saved)</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.has_api_key ? '••••••••  (leave blank to keep existing)' : 'Enter API key'}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Endpoint URL (Ollama / custom) */}
            {(provider === 'ollama' || endpointUrl) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Max tokens */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Max tokens <span className="text-slate-400 font-normal">{maxTokens}</span>
              </label>
              <input
                type="range"
                min={256}
                max={8192}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                <span>256</span><span>8192</span>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Temperature <span className="text-slate-400 font-normal">{temperature.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                <span>Precise (0)</span><span>Creative (2)</span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 flex items-center gap-2 bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
          </button>
        </section>
      </div>
    </div>
  );
}
