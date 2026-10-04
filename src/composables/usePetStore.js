import { computed, reactive, watch } from 'vue'
import { achievementDefinitions, createDemoState, daysFromToday, isThisWeek, normalRanges, todayISO, uid } from '../data'

const STORAGE_KEY = 'petcare-home-state'
const saved = localStorage.getItem(STORAGE_KEY)
const state = reactive(saved ? JSON.parse(saved) : createDemoState())

watch(state, (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })

export function usePetStore() {
  const petById = (id) => state.pets.find((pet) => pet.id === id)
  const petName = (id) => petById(id)?.name || '未命名宠物'
  const totalActivity = computed(() => state.activities.filter((item) => isThisWeek(item.date)).reduce((sum, item) => sum + Number(item.duration || 0), 0))
  // 未完成、也未被补录替换的接种安排，按到期日从近到远排列
  const upcomingVaccines = computed(() => state.vaccines
    .filter((item) => !item.completed && !item.superseded && item.nextDate)
    .map((item) => ({ ...item, days: daysFromToday(item.nextDate) }))
    .sort((a, b) => a.days - b.days))
  const overdueVaccines = computed(() => upcomingVaccines.value.filter((item) => item.days < 0))
  const dueSoonVaccines = computed(() => upcomingVaccines.value.filter((item) => item.days >= 0 && item.days <= 7))
  const overdueCount = computed(() => overdueVaccines.value.length)
  const dueSoonCount = computed(() => dueSoonVaccines.value.length)
  const pendingVaccines = computed(() => overdueCount.value + dueSoonCount.value)
  // 已完成或被补录的记录依然保留，只进入历史视图
  const vaccineHistory = computed(() => state.vaccines
    .filter((item) => item.completed || item.superseded)
    .map((item) => ({ ...item, finishedDate: item.completedDate || item.supersededDate || item.date }))
    .sort((a, b) => (b.finishedDate || '').localeCompare(a.finishedDate || '')))
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
    if (itemType === 'vaccines') settleVaccinePlans(payload)
    state[itemType].unshift({ id: uid(itemType.slice(0, -1)), ...payload })
  }
  // 补录一次接种时，把同一宠物、同名称、同类型且应在本次接种前完成的旧安排标记为已替换，
  // 记录本身保留作为历史，不再出现在逾期/临期列表里
  function settleVaccinePlans(payload) {
    state.vaccines.forEach((item) => {
      if (item.completed || item.superseded) return
      if (item.petId !== payload.petId || item.name !== payload.name) return
      if ((item.category || '疫苗') !== (payload.category || '疫苗')) return
      if (item.nextDate && item.nextDate <= payload.date) {
        item.superseded = true
        item.supersededDate = payload.date
      }
    })
  }
  // 标记安排已完成：只更新状态，不删除任何历史数据
  function completeVaccine(id, date = todayISO()) {
    const item = state.vaccines.find((entry) => entry.id === id)
    if (item && !item.completed) {
      item.completed = true
      item.completedDate = date
    }
  }
  function addPet(payload) {
    add('pets', payload)
  }
  function resetDemo() {
    const fresh = createDemoState()
    Object.keys(state).forEach((key) => { state[key].splice(0, state[key].length, ...(fresh[key] || [])) })
  }

  return { state, petById, petName, totalActivity, upcomingVaccines, overdueVaccines, dueSoonVaccines, overdueCount, dueSoonCount, pendingVaccines, vaccineHistory, feedingTasks, medicationsToday, achievements, healthCompleteness, weightCompliance, add, addPet, completeVaccine, resetDemo }
}
