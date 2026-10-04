import { computed, reactive, watch } from 'vue'
import { achievementDefinitions, createDemoState, daysFromToday, isThisWeek, normalRanges, todayISO, uid } from '../data'

const STORAGE_KEY = 'petcare-home-state'
const saved = localStorage.getItem(STORAGE_KEY)
const state = reactive(saved ? JSON.parse(saved) : createDemoState())
if (!Array.isArray(state.vaccineHistory)) state.vaccineHistory = []

watch(state, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

export function usePetStore() {
  const petById = (id) => state.pets.find((pet) => pet.id === id)
  const petName = (id) => petById(id)?.name || '未命名宠物'
  const totalActivity = computed(() => state.activities.filter((item) => isThisWeek(item.date)).reduce((sum, item) => sum + Number(item.duration || 0), 0))
  const withVaccineDays = (item) => ({ ...item, days: daysFromToday(item.nextDate) })
  const overdueVaccines = computed(() => state.vaccines.map(withVaccineDays).filter((item) => item.days < 0).sort((a, b) => a.days - b.days))
  const dueSoonVaccines = computed(() => state.vaccines.map(withVaccineDays).filter((item) => item.days >= 0 && item.days <= 7).sort((a, b) => a.days - b.days))
  const pendingVaccines = computed(() => overdueVaccines.value.length + dueSoonVaccines.value.length)
  const vaccineHistory = computed(() => [...state.vaccineHistory].sort((a, b) => b.date.localeCompare(a.date)))
  const feedingTasks = computed(() => state.feedings.reduce((sum, item) => sum + Number(item.times || 0), 0))
  const medicationsToday = computed(() => state.medications.filter((item) => item.startDate <= todayISO() && item.endDate >= todayISO()).length)
  const achievements = computed(() => achievementDefinitions.map((item) => ({ ...item, unlocked: item.condition(state) })))
  const healthCompleteness = (petId) => {
    const fields = ['weight', 'temperature', 'heartRate']
    const count = fields.filter((type) => state.healthRecords.some((item) => item.petId === petId && item.type === type)).length
    return Math.round((count / fields.length) * 100)
  }
  const weightCompliance = (petId) => {
    const records = state.healthRecords.filter((item) => item.petId === petId && item.type === 'weight')
    if (!records.length) return 0
    return Math.round((records.filter((item) => item.value >= normalRanges.weight.min && item.value <= normalRanges.weight.max).length / records.length) * 100)
  }

  function add(itemType, payload) {
    state[itemType].unshift({ id: uid(itemType.slice(0, -1)), ...payload })
  }
  function archiveVaccine(plan, overrides = {}) {
    const date = overrides.date ?? plan.date
    if (!date) return
    state.vaccineHistory.unshift({
      id: uid('history'),
      petId: plan.petId,
      name: plan.name,
      category: plan.category || '疫苗',
      date,
      hospital: overrides.hospital ?? plan.hospital ?? '',
      notes: overrides.notes ?? plan.notes ?? '',
    })
  }
  function addVaccine(payload) {
    const existing = state.vaccines.find((item) => item.petId === payload.petId && (item.name || '').trim() === (payload.name || '').trim())
    if (!existing) {
      state.vaccines.unshift({ id: uid('vaccine'), ...payload })
      return
    }
    archiveVaccine(existing)
    Object.assign(existing, payload)
  }
  function completeVaccine(id, payload = {}) {
    const plan = state.vaccines.find((item) => item.id === id)
    if (!plan) return
    const doneDate = payload.date || todayISO()
    archiveVaccine(plan, { date: doneDate, hospital: payload.hospital, notes: payload.notes })
    if (payload.nextDate) {
      Object.assign(plan, { date: doneDate, nextDate: payload.nextDate, hospital: payload.hospital ?? plan.hospital, notes: payload.notes ?? plan.notes })
    } else {
      state.vaccines.splice(state.vaccines.indexOf(plan), 1)
    }
  }
  function addPet(payload) {
    add('pets', payload)
  }
  function resetDemo() {
    const fresh = createDemoState()
    Object.keys(state).forEach((key) => { state[key].splice(0, state[key].length, ...(fresh[key] || [])) })
  }

  return { state, petById, petName, totalActivity, pendingVaccines, overdueVaccines, dueSoonVaccines, vaccineHistory, feedingTasks, medicationsToday, achievements, healthCompleteness, weightCompliance, add, addVaccine, completeVaccine, addPet, resetDemo }
}
