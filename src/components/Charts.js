// All charts are hand-drawn with react-native-svg (no chart lib dependency).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path, Defs, LinearGradient as SvgGradient, Stop, Polyline, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';

// ---- Grouped bars: last week (gray) vs this week (gradient) ----
export function WeeklyBarChart({ thisWeek, lastWeek, labels, width = 340, height = 160 }) {
  const { theme, gradients } = useTheme();
  const max = Math.max(1, ...thisWeek, ...lastWeek);
  const pad = 24;
  const groupW = (width - pad * 2) / 7;
  const barW = groupW / 3;
  const chartH = height - 34;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gradients.secondary[0]} />
          <Stop offset="1" stopColor={gradients.secondary[1]} />
        </SvgGradient>
      </Defs>
      {labels.map((lbl, i) => {
        const x = pad + i * groupW;
        const h1 = (lastWeek[i] / max) * (chartH - 10);
        const h2 = (thisWeek[i] / max) * (chartH - 10);
        return (
          <G key={i}>
            <Rect x={x + barW * 0.4} y={chartH - h1} width={barW} height={Math.max(2, h1)} rx={3} fill="#8A8A9E" opacity={0.5} />
            <Rect x={x + barW * 1.6} y={chartH - h2} width={barW} height={Math.max(2, h2)} rx={3} fill="url(#barGrad)" />
          </G>
        );
      })}
    </Svg>
  );
}

// ---- Smooth-ish polyline completion rate ----
export function LineChart({ values, width = 340, height = 130, labels }) {
  const { gradients, theme } = useTheme();
  const max = Math.max(1, ...values);
  const pad = 18;
  const stepX = (width - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${pad + i * stepX},${height - 22 - (v / max) * (height - 44)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={gradients.accent[0]} />
          <Stop offset="1" stopColor={gradients.accent[1]} />
        </SvgGradient>
      </Defs>
      <Polyline points={pts} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <Circle key={i} cx={pad + i * stepX} cy={height - 22 - (v / max) * (height - 44)} r={4} fill={gradients.accent[0]} />
      ))}
    </Svg>
  );
}

// ---- Donut/pie for category breakdown ----
export function PieChart({ slices, size = 170 }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2;
  const cx = r;
  const cy = r;
  const radius = r - 6;
  let angle = -Math.PI / 2;
  const paths = slices.filter((s) => s.value > 0).map((s, i) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(angle);
    const y1 = cy + radius * Math.sin(angle);
    const x2 = cx + radius * Math.cos(angle + sweep);
    const y2 = cy + radius * Math.sin(angle + sweep);
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += sweep;
    return <Path key={i} d={d} fill={s.color} opacity={0.92} />;
  });
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {paths}
        <Circle cx={cx} cy={cy} r={radius * 0.55} fill="#1A1A2E22" />
      </Svg>
    </View>
  );
}

// ---- Circular progress ring for the daily summary ----
export function CircularProgress({ progress, size = 130, stroke = 12, colors, children }) {
  const { gradients } = useTheme();
  const grad = colors || gradients.primary;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#8A8A9E33" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ---- GitHub-style heatmap for the streak calendar (last ~12 weeks) ----
export function Heatmap({ days, columns = 12, cell = 13, gap = 3 }) {
  const { theme } = useTheme();
  const max = Math.max(1, ...days.map((d) => d.count));
  const width = columns * (cell + gap);
  const height = 7 * (cell + gap);
  return (
    <Svg width={width} height={height}>
      {days.map((d, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const intensity = d.count / max;
        const color = d.count === 0
          ? theme.cardAlt
          : intensity < 0.34 ? '#4ECDC455' : intensity < 0.67 ? '#4ECDC499' : '#4ECDC4';
        return (
          <Rect key={d.date} x={col * (cell + gap)} y={row * (cell + gap)} width={cell} height={cell} rx={3} fill={color} />
        );
      })}
    </Svg>
  );
}

// ---- Mini horizontal progress bar with moving dot (pomodoro) ----
export function ProgressBar({ progress, height = 8, colors }) {
  const { gradients } = useTheme();
  const grad = colors || gradients.primary;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ height: height + 10, justifyContent: 'center' }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: '#8A8A9E30', overflow: 'hidden' }}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: `${p * 100}%`, height, borderRadius: height / 2 }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: `${p * 100}%`,
          marginLeft: -6,
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: grad[0],
          borderWidth: 2, borderColor: '#fff',
        }}
      />
    </View>
  );
}

