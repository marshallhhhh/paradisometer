<script setup>
import Chevron from '@/components/icons/Chevron.vue'
import { ref } from 'vue'

const isOpen = ref(false)

function toggleCard() {
  isOpen.value = !isOpen.value
}
function handleCardClick() {
  const card = document.querySelector('.card')
  card.classList.toggle('open')
}
</script>

<template>
  <article class="card" :class="{ open: isOpen }">
    <button 
      class="card-header"
      type="button"
      :aria-expanded="isOpen"
      @click="toggleCard"
    >
      <div class="left">
        <div class="day-date">
          <span class="day">Today</span>
          <span class="date">17 Sep</span>
        </div>
        <div class="weather">
          <span>☀️</span>
          <span class="description">Sunny</span>
        </div>
      </div>

      <div class="right">
        <div class="daily-temps">
          <span class="max">25°</span>
          <span class="min">15°</span>
        </div>
        <Chevron class="card-chevron" />
      </div>
    </button>
        <div v-if="isOpen" class="card-detail">
          <p>this is the card content</p>
        </div>
  </article>
</template>

<style scoped>
.card {
  min-width: fit-content;
  border: 2px solid var(--color-border);
  border-radius: var(--border-radius);
  padding: 1rem;
  background: var(--darken-translucent)
}

.card-header {
  display: flex;
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

.left {
  display: flex;
  gap: 2rem;
}

.weather {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.weather .description {
  font-size: 1.5rem;
  color: var(--color-text)
}

.right {
  display: flex;
  margin-left: auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.daily-temps {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 0.5rem;
}

.daily-temps .max {
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffffff;
}

.daily-temps .min {
  font-size: 1rem;
  color: #ffffff;
}
</style>
