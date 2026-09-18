<script setup>
import { useForecast } from '@/queries/useForecast.js';
import DailyWeatherCard from '@/components/DailyWeatherCard.vue'

const {
    data: forecast,
    isPending,
    isError,
    error
} = useForecast();
</script>

<template>
    <div v-if="isPending">
        Loading...
    </div>
    <div v-else class="panel">
        <h3 style="font-weight: 700;">Daily Forecast</h3>
        <div v-for="day in forecast.daily" :key="date">
            <DailyWeatherCard :weather="day"/>
        </div>
    </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: 1rem;
  gap: 0.5rem;
  background: var(--darken-translucent)
}

</style>