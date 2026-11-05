import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

export const PALETTE = ['#1d3a78', '#7554dc', '#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#94acdf', '#a28ff5'];
const axis = { tick: { fontSize: 11, fill: '#64748b' }, axisLine: false, tickLine: false };
const Tip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1 font-semibold text-navy-800">{label}</p>}
      {payload.map((p) => (<p key={p.dataKey + p.name} className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />{p.name}: <b className="text-navy-800">{typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : p.value}{unit}</b></p>))}
    </div>
  );
};
const Box = ({ h = 260, children }) => <div style={{ height: h }} className="w-full"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
const NoData = ({ h = 260 }) => <div style={{ height: h }} className="flex items-center justify-center text-xs text-slate-400">No data to display</div>;

export function LineC({ data, xKey, lines, h, unit = '%', domain = [0, 100], minLine }) {
  if (!data?.length) return <NoData h={h} />;
  return (<Box h={h}><LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} />
    <XAxis dataKey={xKey} {...axis} /><YAxis {...axis} domain={domain} /><Tooltip content={<Tip unit={unit} />} />{lines.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
    {minLine !== undefined && <ReferenceLine y={minLine} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: `${minLine}%`, fontSize: 10, fill: '#f43f5e', position: 'insideTopRight' }} />}
    {lines.map((l, i) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key} stroke={l.color || PALETTE[i]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />)}</LineChart></Box>);
}
export function AreaC({ data, xKey, dataKey, name, h, unit = '%', domain = [0, 100], color = "#7554dc", minLine }) {
  if (!data?.length) return <NoData h={h} />;
  return (<Box h={h}><AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id={`g${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={false} /><XAxis dataKey={xKey} {...axis} /><YAxis {...axis} domain={domain} /><Tooltip content={<Tip unit={unit} />} />
    {minLine !== undefined && <ReferenceLine y={minLine} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: `${minLine}% min`, fontSize: 10, fill: '#f43f5e', position: 'insideBottomRight' }} />}
    <Area type="monotone" dataKey={dataKey} name={name || dataKey} stroke={color} strokeWidth={2.5} fill={`url(#g${dataKey})`} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} /></AreaChart></Box>);
}
export function BarC({ data, xKey, bars, h, unit = '%', domain, stacked, horizontal, colorByPoint }) {
  if (!data?.length) return <NoData h={h} />;
  return (<Box h={h}><BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 20 : -18, bottom: 0 }} barGap={4}>
    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" vertical={horizontal} horizontal={!horizontal} />
    {horizontal ? (<><XAxis type="number" {...axis} domain={domain} /><YAxis type="category" dataKey={xKey} {...axis} width={90} /></>) : (<><XAxis dataKey={xKey} {...axis} /><YAxis {...axis} domain={domain} allowDecimals={false} /></>)}
    <Tooltip content={<Tip unit={unit} />} cursor={{ fill: '#f1f4fb' }} />{bars.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
    {bars.map((b, i) => (<Bar key={b.key} dataKey={b.key} name={b.name || b.key} stackId={stacked ? 'a' : undefined} fill={b.color || PALETTE[i]} radius={stacked ? 0 : [6, 6, 0, 0]} maxBarSize={36}>
      {colorByPoint && data.map((d, k) => <Cell key={k} fill={d.fill || PALETTE[k % PALETTE.length]} />)}</Bar>))}</BarChart></Box>);
}
export function PieC({ data, nameKey = 'name', valueKey = 'value', h = 240, colors = PALETTE, money, unit = '' }) {
  const d = (data || []).filter((x) => x[valueKey] > 0);
  if (!d.length) return <NoData h={h} />;
  return (<Box h={h}><PieChart><Pie data={d} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="85%" paddingAngle={3} cornerRadius={6} stroke="none">
    {d.map((x, i) => <Cell key={i} fill={x.fill || colors[i % colors.length]} />)}</Pie><Tooltip content={<Tip unit={unit} />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></Box>);
}
export function RadarC({ data, h = 280, series }) {
  if (!data?.length) return <NoData h={h} />;
  return (<Box h={h}><RadarChart data={data} outerRadius="72%"><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
    {series.map((s, i) => <Radar key={s.key} name={s.name} dataKey={s.key} stroke={s.color || PALETTE[i]} fill={s.color || PALETTE[i]} fillOpacity={0.2} strokeWidth={2} />)}<Tooltip content={<Tip unit="%" />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></RadarChart></Box>);
}
