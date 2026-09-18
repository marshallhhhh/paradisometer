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
import { Line } from 'vue-chartjs';
import 'chartjs-adapter-date-fns';

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

const dates = [] 

for (let i = -1; i < 4; i++) {
    const nextDate = new Date()
    nextDate.setHours(nextDate.getHours() + i)
    dates.push(nextDate);
}

const data = {
  labels: dates,
  datasets: [
    {
      label: 'Delta T',
      data: [5, 4, 6, 3, 6],
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

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  
  scales: {
    x: {
        type: "time",
        min: dates.min,
        max: dates.max,
        time: {unit: "hour", stepSize: 6, displayFormats: { hour: "ha" }},
        }
    },
    y: {
        title: { display: true, text: "Delta T" },
    }
}
</script>

<template>
  <div style="height: 400px">
    <Line :data="data" :options="options" />
  </div>
</template>