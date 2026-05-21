import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Droplets, Lightbulb, Thermometer } from 'lucide-react';
import type { DashboardArea } from '../api/types';

// Explicit grid placements that compose a floor-plan-like layout (4-column grid)
// Each entry corresponds to areas[i]; extras fall back to auto-flow.
const PLACEMENTS: CSSProperties[] = [
  { gridColumn: '1/3', gridRow: '1/3' }, // large room   — 2×2
  { gridColumn: '3/4', gridRow: '1/2' }, // small room   — 1×1
  { gridColumn: '4/5', gridRow: '1/3' }, // tall room    — 1×2 (e.g. bathroom)
  { gridColumn: '3/4', gridRow: '2/3' }, // small room   — 1×1
  { gridColumn: '1/2', gridRow: '3/4' }, // small room   — 1×1
  { gridColumn: '2/4', gridRow: '3/4' }, // medium room  — 2×1
  { gridColumn: '4/5', gridRow: '3/4' }, // small room   — 1×1
  { gridColumn: '1/5', gridRow: '4/5' }, // hallway/garage — 4×1
];

export function FloorPlanCard({ areas }: { areas: DashboardArea[] }) {
  const visible = areas.slice(0, 8);
  // Calculate minimum row tracks needed for the placements actually used
  const rowCount = visible.length <= 4 ? 2 : visible.length <= 7 ? 3 : 4;

  return (
    <div className="overflow-hidden rounded-lg border-2 border-stone-600">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-stone-600 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-300">
          План дома
        </span>
        <span className="text-[10px] text-stone-400">{areas.length} зон</span>
      </div>

      {/* Grid — background color shows through gaps as "walls" */}
      <div
        className="grid grid-cols-4 bg-stone-600"
        style={{
          gap: '2px',
          gridTemplateRows: `repeat(${rowCount}, minmax(80px, auto))`,
        }}
      >
        {visible.map((area, i) => (
          <RoomCell key={area.id} area={area} placement={PLACEMENTS[i]} />
        ))}
      </div>
    </div>
  );
}

function RoomCell({ area, placement }: { area: DashboardArea; placement: CSSProperties }) {
  const total = area.devices_total ?? 0;
  const online = area.devices_online ?? 0;
  const offlineCount = total - online;
  const hasIssues = offlineCount > 0;

  return (
    <Link
      to={`/areas/${area.id}`}
      className="group relative flex flex-col bg-[#ede8df] p-2.5 transition-colors hover:bg-[#e3dcd3]"
      style={placement}
    >
      {/* Subtle paper grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(#7a6e65 1px, transparent 1px), linear-gradient(90deg, #7a6e65 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />

      {/* Warning triangle — matches screenshot style */}
      {hasIssues && (
        <span className="absolute right-1.5 top-1.5 drop-shadow-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" fill="rgba(251,191,36,0.18)" />
        </span>
      )}

      {/* Room name */}
      <div className="relative truncate text-xs font-semibold leading-tight text-stone-700 group-hover:text-sky-700">
        {area.name}
      </div>

      {/* Device status */}
      <div className="relative mt-1.5 flex items-center gap-1">
        <Lightbulb
          className="h-3 w-3 shrink-0"
          style={{ color: online > 0 ? '#f59e0b' : '#c8c4c0' }}
          fill={online > 0 ? 'rgba(245,158,11,0.22)' : 'none'}
        />
        <span className="text-[10px] leading-none text-stone-500">
          {online}/{total}
        </span>
        {hasIssues && (
          <span className="text-[10px] leading-none text-amber-600">
            ({offlineCount} офлайн)
          </span>
        )}
      </div>

      {/* Climate readout */}
      {(area.temperature != null || area.humidity != null) && (
        <div className="relative mt-auto flex flex-wrap gap-x-2 pt-1">
          {area.temperature != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-stone-500">
              <Thermometer className="h-3 w-3 text-red-400" />
              {area.temperature}°C
            </span>
          )}
          {area.humidity != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-stone-500">
              <Droplets className="h-3 w-3 text-sky-400" />
              {area.humidity}%
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
