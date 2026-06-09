'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('log');
  const [period, setPeriod] = useState('week');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [spend, setSpend] = useState('');
  const [revenue, setRevenue] = useState('');
  const [sales, setSales] = useState('');
  const [campaign, setCampaign] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() {
    const res = await fetch('/api/entries');
    if (res.status === 401) { router.push('/'); return; }
    const data = await res.json();
    setEntries(data);
    setLoading(false);
  }

  async function addEntry() {
    if (!date || !spend || !revenue) { setError('Date, spend and revenue are required.'); return; }
    setError('');
    await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, spend: parseFloat(spend), revenue: parseFloat(revenue), sales: parseInt(sales) || 0, cpu: 0, campaign }),
    });
    setSpend(''); setRevenue(''); setSales(''); setCampaign('');
    setDate(new Date().toISOString().split('T')[0]);
    fetchEntries();
  }

  async function deleteEntry(id) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    fetchEntries();
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
  }

  const fmtN = (n) => '₦' + Math.round(parseFloat(n) || 0).toLocaleString();

  const totSpend = entries.reduce((a, e) => a + parseFloat(e.spend), 0);
  const totRev = entries.reduce((a, e) => a + parseFloat(e.revenue), 0);
  const totSales = entries.reduce((a, e) => a + parseInt(e.sales), 0);
  const netProfit = totRev - totSpend;
  const overallRoas = totSpend ? (totRev / totSpend).toFixed(2) : '—';

  function getPeriodKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (period === 'week') {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      return d.getFullYear() + '-W' + String(week).padStart(2, '0');
    }
    if (period === 'month') return dateStr.slice(0, 7);
    if (period === 'quarter') return d.getFullYear() + '-Q' + Math.ceil((d.getMonth() + 1) / 3);
    return String(d.getFullYear());
  }

  function getPeriodLabel(key) {
    if (period === 'week') { const [y, w] = key.split('-W'); return 'Week ' + w + ', ' + y; }
    if (period === 'month') { const [y, m] = key.split('-'); return ['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(m)-1] + ' ' + y; }
    if (period === 'quarter') return key.replace('-', ' ');
    return key;
  }

  const grouped = {};
  entries.forEach(e => {
    const k = getPeriodKey(e.date);
    if (!grouped[k]) grouped[k] = { spend: 0, rev: 0, sales: 0, entries: [] };
    grouped[k].spend += parseFloat(e.spend);
    grouped[k].rev += parseFloat(e.revenue);
    grouped[k].sales += parseInt(e.sales);
    grouped[k].entries.push(e);
  });

  const periodKeys = Object.keys(grouped).sort().reverse();

  function exportPDF(key) {
    const g = grouped[key];
    const np = g.rev - g.spend;
    const roas = g.spend ? (g.rev / g.spend).toFixed(2) : '—';
    const margin = g.rev ? ((np / g.rev) * 100).toFixed(1) : '0';
    const label = getPeriodLabel(key);

    const rows = g.entries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const enp = parseFloat(e.revenue) - parseFloat(e.spend);
      const eroas = parseFloat(e.spend) ? (parseFloat(e.revenue) / parseFloat(e.spend)).toFixed(2) : '—';
      return `
        <tr>
          <td>${e.date}</td>
          <td>${e.campaign || '—'}</td>
          <td>${fmtN(e.spend)}</td>
          <td>${fmtN(e.revenue)}</td>
          <td>${e.sales}</td>
          <td>${eroas !== '—' ? eroas + 'x' : '—'}</td>
          <td style="color:${enp >= 0 ? '#10b981' : '#ef4444'}">${enp >= 0 ? '+' : ''}${fmtN(enp)}</td>
        </tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Marketing Report — ${label}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 48px; background: #fff; }
          .header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 32px; }
          .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
          .header p { font-size: 14px; color: #666; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 36px; }
          .card { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px; }
          .card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          .card .value { font-size: 20px; font-weight: 700; }
          .green { color: #10b981; }
          .red { color: #ef4444; }
          h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #333; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { text-align: left; padding: 10px 12px; background: #f3f3f3; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #e5e5e5; }
          td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
          tr:last-child td { border-bottom: none; }
          .footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Marketing Performance Report</h1>
          <p>${label} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div class="summary">
          <div class="card"><div class="label">Revenue</div><div class="value">${fmtN(g.rev)}</div></div>
          <div class="card"><div class="label">Ad spend</div><div class="value">${fmtN(g.spend)}</div></div>
          <div class="card"><div class="label">Net profit</div><div class="value ${np >= 0 ? 'green' : 'red'}">${fmtN(np)}</div></div>
          <div class="card"><div class="label">ROAS</div><div class="value">${roas !== '—' ? roas + 'x' : '—'}</div></div>
          <div class="card"><div class="label">Total sales</div><div class="value">${g.sales}</div></div>
          <div class="card"><div class="label">Profit margin</div><div class="value ${parseFloat(margin) >= 0 ? 'green' : 'red'}">${margin}%</div></div>
          <div class="card"><div class="label">Profit per sale</div><div class="value ${np >= 0 ? 'green' : 'red'}">${g.sales ? fmtN(np / g.sales) : '—'}</div></div>
        </div>
        <h2>Daily breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Campaign</th><th>Ad spend</th><th>Revenue</th><th>Sales</th><th>ROAS</th><th>Net profit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Kaizen Digital Academy · Marketing Tracker</div>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">MT</div>
          <span className="font-medium text-white">Marketing Tracker</span>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-white transition-colors">Sign out</button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total revenue', value: fmtN(totRev), color: 'text-white' },
            { label: 'Total spend', value: fmtN(totSpend), color: 'text-white' },
            { label: 'Net profit', value: fmtN(netProfit), color: netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Overall ROAS', value: overallRoas !== '—' ? overallRoas + 'x' : '—', color: overallRoas !== '—' && parseFloat(overallRoas) >= 2 ? 'text-emerald-400' : 'text-white' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {['log', 'history', 'analytics'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'log' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg">
            <h2 className="text-sm font-medium text-white mb-5">Log new entry</h2>
            <div className="space-y-4">
              {[
                ['Date', 'date', 'date', date, setDate],
                ['Ad spend (₦)', 'number', '0', spend, setSpend],
                ['Revenue (₦)', 'number', '0', revenue, setRevenue],
                ['No. of sales', 'number', '0', sales, setSales],
                ['Campaign', 'text', 'e.g. PFA webinar', campaign, setCampaign],
              ].map(([label, type, placeholder, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
                  <input type={type} placeholder={placeholder} value={val} onChange={e => setter(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                </div>
              ))}
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button onClick={addEntry}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors mt-2">
                Add entry
              </button>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-12 text-center text-gray-600 text-sm">No entries yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Date', 'Campaign', 'Ad spend', 'Revenue', 'Sales', 'ROAS', 'Net profit', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {entries.map(e => {
                    const roas = parseFloat(e.spend) ? (parseFloat(e.revenue) / parseFloat(e.spend)).toFixed(2) : null;
                    const np = parseFloat(e.revenue) - parseFloat(e.spend);
                    return (
                      <tr key={e.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-300">{e.date}</td>
                        <td className="px-4 py-3">
                          {e.campaign ? <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-lg">{e.campaign}</span> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{fmtN(e.spend)}</td>
                        <td className="px-4 py-3 text-gray-300">{fmtN(e.revenue)}</td>
                        <td className="px-4 py-3 text-gray-300">{e.sales}</td>
                        <td className="px-4 py-3">
                          {roas ? <span className={`text-xs font-medium px-2 py-1 rounded-lg ${parseFloat(roas) >= 2 ? 'bg-emerald-500/10 text-emerald-400' : parseFloat(roas) < 1 ? 'bg-red-500/10 text-red-400' : 'bg-gray-700 text-gray-300'}`}>{roas}x</span> : '—'}
                        </td>
                        <td className={`px-4 py-3 font-medium ${np >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{np >= 0 ? '+' : ''}{fmtN(np)}</td>
                        <td className="px-4 py-3"><button onClick={() => deleteEntry(e.id)} className="text-gray-700 hover:text-red-400 transition-colors text-lg leading-none">×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <div>
            <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
              {['week', 'month', 'quarter', 'year'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {periodKeys.length === 0 ? (
              <p className="text-gray-600 text-sm">No entries yet.</p>
            ) : (
              <div className="space-y-4">
                {periodKeys.map(k => {
                  const g = grouped[k];
                  const np = g.rev - g.spend;
                  const roas = g.spend ? (g.rev / g.spend).toFixed(2) : null;
                  const margin = g.rev ? ((np / g.rev) * 100).toFixed(1) : '0';
                  return (
                    <div key={k} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-medium text-white">{getPeriodLabel(k)}</p>
                        <button onClick={() => exportPDF(k)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all">
                          Export PDF
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                          ['Revenue', fmtN(g.rev), 'text-white'],
                          ['Ad spend', fmtN(g.spend), 'text-white'],
                          ['Net profit', fmtN(np), np >= 0 ? 'text-emerald-400' : 'text-red-400'],
                          ['ROAS', roas ? roas + 'x' : '—', roas && parseFloat(roas) >= 2 ? 'text-emerald-400' : 'text-white'],
                          ['Sales', g.sales, 'text-white'],
                          ['Margin', margin + '%', parseFloat(margin) >= 0 ? 'text-emerald-400' : 'text-red-400'],
                          ['Profit/sale', g.sales ? fmtN(np / g.sales) : '—', np >= 0 ? 'text-emerald-400' : 'text-red-400'],
                        ].map(([l, v, c]) => (
                          <div key={l} className="bg-gray-800/50 rounded-xl p-3">
                            <p className="text-xs text-gray-500 mb-1">{l}</p>
                            <p className={`text-base font-semibold ${c}`}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}