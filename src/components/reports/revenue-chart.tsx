"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/utils";

export function RevenueTrendChart({
  data,
}: {
  data: { month: string; value: number; bookings: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          width={70}
          tickFormatter={(v: number) => formatINR(v)}
        />
        <Tooltip
          formatter={(value: number | string, name: string) =>
            name === "Booking Value" ? [formatINR(Number(value)), name] : [value, name]
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#16a34a"
          fill="url(#gRevenue)"
          name="Booking Value"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
