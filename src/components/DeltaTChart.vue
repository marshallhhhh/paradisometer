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

const {
    data: forecast,
    isPending,
    isError,
    error
} = useForecast();

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
    <Line :data="chartData" :options="options" />
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