import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Tag, RefreshCw } from 'lucide-react';
import api, { type Plugin } from '../lib/api';

const CATEGORY_ALL = '\u5168\u90E8';

export default function PluginStorePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ALL);
  const [search, setSearch] = useState('');

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.plugins.list().then((r) => r.data.plugins),
  });

  const categories = [
    CATEGORY_ALL,
    ...new Set((plugins || []).map((p) => p.category).filter(Boolean)),
  ];

  const filtered = (plugins || []).filter((p) => {
    const matchCategory = activeCategory === CATEGORY_ALL || p.category === activeCategory;
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const priceLabel = (price: number) => {
    if (price === 0) return '\u514D\u8D39';
    return `\u00A5${price}/\u6708`;
  };

  const priceColor = (price: number) => {
    if (price === 0) return 'bg-green-100 text-green-700';
    return 'bg-amber-100 text-amber-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-primary-600" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">\u63D2\u4EF6\u5546\u5E97</h2>
        <p className="text-gray-500 text-sm mt-1">\u6D4F\u89C8\u548C\u8BA2\u9605\u63D2\u4EF6\u4E3A\u4F60\u7684 Bot \u6DFB\u52A0\u529F\u80FD</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="input-field pl-10"
          placeholder="\u641C\u7D22\u63D2\u4EF6..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Plugin grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p>\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u63D2\u4EF6</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              priceLabel={priceLabel}
              priceColor={priceColor}
              onSubscribe={() =>
                navigate(`/plugins/${plugin.id}/config`, { state: { plugin } })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PluginCard({
  plugin,
  priceLabel,
  priceColor,
  onSubscribe,
}: {
  plugin: Plugin;
  priceLabel: (p: number) => string;
  priceColor: (p: number) => string;
  onSubscribe: () => void;
}) {
  return (
    <div className="card hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priceColor(plugin.price_monthly)}`}
        >
          {priceLabel(plugin.price_monthly)}
        </span>
      </div>

      {plugin.category && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
            <Tag size={10} /> {plugin.category}
          </span>
        </div>
      )}

      <p className="text-sm text-gray-600 mb-4 flex-1">{plugin.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">v{plugin.version}</span>
        <button className="btn-primary text-sm" onClick={onSubscribe}>
          \u8BA2\u9605 / \u914D\u7F6E
        </button>
      </div>
    </div>
  );
}
