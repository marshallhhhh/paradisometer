<script setup>
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
} from 'chart.js';
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import 'chartjs-adapter-date-fns';
import { useForecast } from '@/queries/useForecast';

ChartJS.register(
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function daysBetween(d1, d2) {
  return Math.abs((d1 - d2) / (1000 * 60 * 60 * 24))
}

/* const dateData = computed(() => {
  if (!forecast.value?.hourly) return null;

  const start = new Date(forecast.value?.hourly?.time[0])
  const end = new Date(forecast.value?.hourly?.time[forecast.value?.hourly?.time.length - 1])
  const daysBetween = daysBetween(start, end) 
  return {
    "startOfRange": start,
    "endOfRange": end,
    "numberOfDays": daysBetween 
  }
}) */

const now = new Date()
const eor = new Date()
eor.setDate(eor.getDate() + 5);

const dateData = {
  "startOfRange": now,
  "endOfRange": eor,
  "numberOfDays": 5
}

const dayBoundaryPlugin = {
  id: "dayBoundaries",
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if(!chartArea) return;
    const x = scales.x;

    for (let day = 0; day <= dateData.numberOfDays ; day++) {
      const time = new Date(dateData.startOfRange.getTime() + day * 24 * 60 * 60 * 1000)
      const px = x.getPixelForValue(time)

      if (px < chartArea.left - 1 || px > chartArea.right + 1) continue;

      ctx.save()
      ctx.strokeStyle = "rgba(150, 150, 150, 0.35)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top);
      ctx.moveTo(px, chartArea.bottom);
      ctx.stroke();
      ctx.restore()

      if (day < dateData.numberOfDays) {
        const mid = new Date(time.getTime() + 12 * 60 * 60 * 1000)
        const midPx = x.getPixelForValue(mid)
        ctx.save();
        ctx.fillStyle = "rgba(150, 150, 150, 0.35)"
        ctx.textAlign = "center"
        const label = day === 1 ? "Today" : time.getDay();
        ctx.fillText(label, midPx, chartArea.top + 16);
        ctx.restore();
      }
    }
  }
}

const {
    data: forecast,
    isPending,
    isError,
    error
} = useForecast();

const chartData = computed(() => {
  return {
    labels: forecast.value?.hourly?.time,
    datasets: [
      {
        label: 'Delta T',
        data: forecast.value?.hourly?.deltaT,
        borderWidth: 2,
        borderColor: "#4aa8ff",
        pointRadius: 0,
        tension: 0.3,
        fill: true,
        backgroundColor(ctx) {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(74, 168, 255, 0.2)"
          
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(74, 168, 255, 0.35)");
          g.addColorStop(1, "rgba(74, 168, 255, 0)");
          return g;
        }
      },
    ],
  }
});

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  
  scales: {
    x: {
        type: "time",
        time: {unit: "hour", stepSize: 6, displayFormats: { hour: "ha" }},
        }
    },
    y: {
        title: { display: true, text: "Delta T" },
    }
}
</script>

<template>
  <div v-if="isPending">
    Loading forecast...
  </div>

  <div v-else-if="isError">
    Failed to load forecast: {{ error.message }}
  </div>

  <div v-else-if="chartData" style="height: 400px">
    <Line :data="chartData" :options="options" :plugins="[dayBoundaryPlugin]" />
  </div>
</template>

<style>
.panel {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: 1rem;
  gap: 0.5rem;
  background: var(--darken-translucent);
  max-height: 800px;
}
</style>