<script setup>
import Chevron from '@/components/icons/Chevron.vue'
import { ref } from 'vue'
import { getDescription, getImage } from '@/utils/wmoCodes'
import { useForecast } from '@/queries/useForecast'

const isOpen = ref(false)

function toggleCard() {
  isOpen.value = !isOpen.value
}

function formatDate(dateString) {
  const date = new Date(dateString);

  const options = {
    day: 'numeric',
    month: 'short'
  }
  
  return new Intl.DateTimeFormat('en-AU', options).format(date);
}

function formatDay(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  
  if (date.getUTCDate() == now.getUTCDate()) {
    return "Today"
  } else {
    return new Intl.DateTimeFormat('en-AU', { weekday: 'long'}).format(date);
  }
}

defineProps({
  weather: Object
});

</script>

<template>
  <article class="card" :class="{ open: isOpen }">
    <button class="card-header" type="button" :aria-expanded="isOpen" @click="toggleCard">
        <div class="day-date">
          <span class="day">{{ formatDay(weather.date) }}</span>
          <span class="date">{{ formatDate(weather.date) }}</span>
        </div>
          <img class="weather-icon" :src="getImage(weather.weather_code)" />
          <span class="description">{{ getDescription(weather.weather_code) }}</span>

          <div class="temps">
            <span class="max">{{ (weather.temperature_2m_max).toFixed(0) }}°</span>
            <span class="min">{{ (weather.temperature_2m_min).toFixed(0) }}°</span>
          </div>
        <Chevron class="card-chevron" />
    </button>
    <div v-if="isOpen" class="card-detail">
      <p>this is the card content</p>
    </div>
  </article>
</template>

<style scoped>
.card {
  min-width: fit-content;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: 1rem;
  background: var(--darken-translucent)
}

.card-header {
  display: grid;
  grid-template-columns: 125px 60px 1fr auto 25px;
  grid-template-rows: 1fr;
  width: 100%;
  align-items: center;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card-header[aria-expanded='true'] .card-chevron {
  transform: rotate(180deg);
}

.card-detail {
  margin-top: 0.5rem;
}

.card:hover {
  border-color: var(--color-border-hover);
}

.day-date {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.day {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--color-text);
}

.weather-icon {
  width: 54px;
  height: 54px;
  object-fit: contain;
  flex-shrink: 0;
}

.description {
  font-size: 1.5rem;
  color: var(--color-text);
  white-space: nowrap;
  margin-right: 0.5rem;
}

.temps {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin-right: 0.5rem;
}

.max {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffffff;
}

.min {
  font-size: 1rem;
  color: #ffffff;
}
</style>
