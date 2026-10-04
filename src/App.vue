<script setup>
import { computed, ref } from 'vue'
import { Activity, Award, Bell, BookOpen, CalendarDays, ChartNoAxesCombined, Check, ChevronRight, CircleHelp, HeartPulse, LayoutDashboard, Menu, PawPrint, Pill, Plus, Settings, ShieldCheck, Sparkles, Utensils, X } from 'lucide-vue-next'
import PetModal from './components/PetModal.vue'
import RecordModal from './components/RecordModal.vue'
import TrendChart from './components/TrendChart.vue'
import { calculateAge, formatDate, normalRanges, todayISO } from './data'
import { usePetStore } from './composables/usePetStore'

const { state, petById, petName, totalActivity, upcomingVaccines, overdueVaccines, dueSoonVaccines, overdueCount, dueSoonCount, vaccineHistory, feedingTasks, medicationsToday, achievements, healthCompleteness, weightCompliance, add, addPet, completeVaccine } = usePetStore()
const activeNav = ref('overview')
const showPetModal = ref(false)
const recordType = ref('')
const selectedPetId = ref('pet-momo')
const selectedMetric = ref('weight')
const mobileMenu = ref(false)
const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'health', label: '健康档案', icon: HeartPulse },
  { id: 'schedule', label: '日程提醒', icon: CalendarDays },
  { id: 'activity', label: '活动记录', icon: Activity },
  { id: 'achievements', label: '成就徽章', icon: Award },
]
const currentPet = computed(() => petById(selectedPetId.value) || state.pets[0])
const recentHealthRecords = computed(() => state.healthRecords.filter((item) => item.petId === selectedPetId.value && item.type === selectedMetric.value).sort((a, b) => a.date.localeCompare(b.date)).slice(-7))
const healthStatus = computed(() => {
  const value = Number(recentHealthRecords.value.at(-1)?.value || currentPet.value?.weight || 0)
  const range = normalRanges[selectedMetric.value]
  if (!value) return { label: '等待记录', className: 'neutral' }
  return value >= range.min && value <= range.max
    ? { label: '处于正常范围', className: 'good' }
    : { label: '建议重点关注', className: 'attention' }
})
const activeAchievements = computed(() => achievements.value.filter((item) => item.unlocked))
const agenda = computed(() => {
  const feedingItems = state.feedings.flatMap((item) => Array.from(
    { length: Number(item.times || 1) },
    (_, index) => ({
      id: `${item.id}-${index}`,
      kind: 'feeding',
      title: `${petName(item.petId)} · ${item.food}`,
      detail: `${item.portion || '按计划'} · 第 ${index + 1} 餐`,
      time: index === 0 ? '08:00' : index === 1 ? '18:00' : '21:00',
    }),
  ))
  const medicationItems = state.medications
    .filter((item) => item.startDate <= todayISO() && item.endDate >= todayISO())
    .map((item) => ({
      id: item.id,
      kind: 'medication',
      title: `${petName(item.petId)} · ${item.name}`,
      detail: `${item.dose} · ${item.frequency}`,
      time: '09:00',
    }))
  // 七天内到期（含今天）的安排进入日程；逾期项单独分组并置顶
  const dueSoonItems = dueSoonVaccines.value.map((item) => ({
    id: item.id,
    kind: 'vaccine',
    actionable: true,
    title: `${petName(item.petId)} · ${item.name}`,
    detail: item.days === 0 ? '今天需要接种' : `${item.days} 天后到期 · ${formatDate(item.nextDate, true)}`,
    time: item.days === 0 ? '今天' : `${item.days}天`,
  }))
  const overdueItems = overdueVaccines.value.map((item) => ({
    id: item.id,
    kind: 'vaccine',
    urgent: true,
    actionable: true,
    title: `${petName(item.petId)} · ${item.name}`,
    detail: `已逾期 ${-item.days} 天 · 应于 ${formatDate(item.nextDate, true)} 接种`,
    time: '逾期',
  }))
  return [...overdueItems, ...feedingItems, ...medicationItems, ...dueSoonItems]
})
const averageWeightChange = computed(() => {
  const records = state.healthRecords.filter((item) => item.type === 'weight')
  if (records.length < 2) return '0.0 kg'
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  return `${(Number(sorted[sorted.length - 1].value) - Number(sorted[0].value)).toFixed(1)} kg`
})
const leaderboard = computed(() => state.pets.map((pet) => ({ ...pet, completeness: healthCompleteness(pet.id), activity: state.activities.filter((item) => item.petId === pet.id).reduce((sum, item) => sum + Number(item.duration || 0), 0) })).sort((a, b) => b.completeness - a.completeness))

function openRecord(type) { recordType.value = type }
function saveRecord({ collection, payload }) { add(collection, payload); recordType.value = '' }
function metricLabel(type) { return normalRanges[type]?.label || type }
function vaccineTone(days) { return days < 0 ? 'danger' : days <= 7 ? 'warning' : 'success' }
const agendaIcons = { feeding: Utensils, medication: Pill, vaccine: ShieldCheck }
function markAgendaDone(item) {
  if (item.kind === 'vaccine' && item.actionable) completeVaccine(item.id)
}
const vaccineStatHint = computed(() => {
  if (overdueCount.value) return { text: `已逾期 ${overdueCount.value} 项，请尽快安排`, className: 'text-danger' }
  if (dueSoonCount.value) return { text: `${dueSoonCount.value} 项 7 天内到期`, className: 'text-warning' }
  return { text: '近期暂无接种安排', className: '' }
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'is-open': mobileMenu }">
      <div class="brand"><div class="brand-mark"><PawPrint :size="20" /></div><div><strong>宠物家</strong><span>Petcare Home</span></div><button class="icon-btn mobile-close" @click="mobileMenu = false"><X :size="18" /></button></div>
      <div class="household"><div class="household-avatar">林</div><div><strong>林家宠物屋</strong><span>2 位家庭成员</span></div><ChevronRight :size="16" /></div>
      <nav class="nav-list"><button v-for="item in navItems" :key="item.id" :class="{ active: activeNav === item.id }" @click="activeNav = item.id; mobileMenu = false"><component :is="item.icon" :size="18" /><span>{{ item.label }}</span><span v-if="item.id === 'schedule' && agenda.length" class="nav-count" :class="{ danger: overdueCount }">{{ agenda.length }}</span></button></nav>
      <div class="sidebar-bottom"><button><BookOpen :size="18" />知识库</button><button><Settings :size="18" />设置</button><div class="help-box"><CircleHelp :size="17" /><span>需要帮助？<b>查看使用指南</b></span></div></div>
    </aside>
    <main class="main-content">
      <header class="topbar"><button class="icon-btn menu-toggle" @click="mobileMenu = true"><Menu :size="21" /></button><div><span class="eyebrow">{{ activeNav === 'overview' ? '家庭健康空间' : navItems.find((item) => item.id === activeNav)?.label }}</span><h1>{{ activeNav === 'overview' ? '早上好，林家。' : navItems.find((item) => item.id === activeNav)?.label }}</h1></div><div class="top-actions"><button class="icon-btn notification"><Bell :size="19" /><i></i></button><button class="user-chip"><span>林</span><strong>Lin</strong></button></div></header>
      <div v-if="activeNav === 'overview'" class="page">
        <section class="welcome-row"><div><p class="section-kicker">星期三，2026年9月16日</p><h2>今天也要好好照顾它们。</h2><p class="muted">这里是你和 Momo、Nori 的小小健康空间。</p></div><button class="btn btn-primary" @click="showPetModal = true"><Plus :size="17" />添加宠物</button></section>
        <section class="stat-grid"><article class="stat-card"><div class="stat-icon green"><PawPrint :size="19" /></div><div><span>我的宠物</span><strong>{{ state.pets.length }}<small> 位</small></strong><em>档案都很完整</em></div></article><article class="stat-card"><div class="stat-icon peach"><Utensils :size="19" /></div><div><span>今日待喂食</span><strong>{{ feedingTasks }}<small> 餐</small></strong><em>按计划进行中</em></div></article><article class="stat-card" :class="{ 'is-overdue': overdueCount }"><div class="stat-icon lavender"><ShieldCheck :size="19" /></div><div class="vaccine-stat"><span>待接种疫苗</span><div class="stat-dual"><strong :class="{ 'text-danger': overdueCount }">{{ overdueCount }}<small> 项逾期</small></strong><i></i><strong :class="{ 'text-warning': dueSoonCount }">{{ dueSoonCount }}<small> 项临期</small></strong></div><em :class="vaccineStatHint.className">{{ vaccineStatHint.text }}</em></div></article><article class="stat-card"><div class="stat-icon blue"><Activity :size="19" /></div><div><span>本周活动</span><strong>{{ totalActivity }}<small> 分钟</small></strong><em>平均体重变化 {{ averageWeightChange }}</em></div></article></section>
        <section class="content-grid">
          <article class="panel pets-panel"><div class="panel-heading"><div><span class="eyebrow">成员档案</span><h3>我的宠物</h3></div><button class="text-btn" @click="activeNav = 'health'">查看档案 <ChevronRight :size="15" /></button></div><div class="pet-list"><button v-for="pet in state.pets" :key="pet.id" class="pet-card" :class="{ selected: selectedPetId === pet.id }" @click="selectedPetId = pet.id"><div class="pet-avatar" :class="pet.species === '狗' ? 'dog' : 'cat'"><img v-if="pet.photo" :src="pet.photo" :alt="pet.name" /><span v-else>{{ pet.species === '狗' ? '🐕' : pet.species === '猫' ? '🐈' : '🐾' }}</span></div><div class="pet-info"><strong>{{ pet.name }}</strong><span>{{ pet.breed || pet.species }} · {{ pet.gender }}</span><span>{{ calculateAge(pet.birthDate) }} · {{ pet.weight || '--' }} kg</span></div><div class="pet-status"><span class="status-dot"></span>健康</div><ChevronRight class="pet-arrow" :size="17" /></button><button class="add-pet-card" @click="showPetModal = true"><span><Plus :size="18" /></span><strong>添加新宠物</strong><small>建立专属健康档案</small></button></div></article>
          <article class="panel agenda-panel"><div class="panel-heading"><div><span class="eyebrow">今天 · 9月16日</span><h3>日程提醒</h3></div><button class="icon-btn subtle"><CalendarDays :size="18" /></button></div><div class="agenda-list"><div v-for="item in agenda.slice(0, 5)" :key="item.id" class="agenda-item" :class="{ urgent: item.urgent }"><div class="agenda-time">{{ item.time }}</div><div class="agenda-icon" :class="[item.kind, { urgent: item.urgent }]"><component :is="agendaIcons[item.kind]" :size="17" /></div><div class="agenda-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></div><button v-if="item.actionable" class="check-circle actionable" title="标记已完成" @click="markAgendaDone(item)"><Check :size="14" /></button><button v-else class="check-circle"><Check :size="14" /></button></div><div v-if="!agenda.length" class="empty-state">今天没有待办，享受轻松的一天吧。</div></div><button class="full-btn" @click="activeNav = 'schedule'">查看全部日程 <ChevronRight :size="15" /></button></article>
        </section>
        <section class="content-grid lower-grid">
          <article class="panel trend-panel"><div class="panel-heading"><div><span class="eyebrow">健康趋势</span><h3>{{ currentPet?.name }} 的{{ metricLabel(selectedMetric) }}变化</h3></div><div class="segmented"><button v-for="metric in ['weight', 'temperature', 'heartRate']" :key="metric" :class="{ active: selectedMetric === metric }" @click="selectedMetric = metric">{{ metricLabel(metric) }}</button></div></div><div class="trend-summary"><div><strong>{{ recentHealthRecords.at(-1)?.value || currentPet?.weight || '--' }} <small>{{ normalRanges[selectedMetric].unit }}</small></strong><span>最近记录 · {{ recentHealthRecords.at(-1)?.date ? formatDate(recentHealthRecords.at(-1).date) : '暂无' }}</span></div><span class="health-status" :class="healthStatus.className"><i></i>{{ healthStatus.label }}</span><span class="range-tag"><span></span>正常范围 {{ normalRanges[selectedMetric].min }} - {{ normalRanges[selectedMetric].max }} {{ normalRanges[selectedMetric].unit }}</span></div><TrendChart :records="recentHealthRecords" :type="selectedMetric" /><button class="full-btn" @click="openRecord('health')">记录健康指标 <Plus :size="15" /></button></article>
          <article class="panel quick-panel"><div class="panel-heading"><div><span class="eyebrow">快速记录</span><h3>把日常变成习惯</h3></div><Sparkles :size="18" class="heading-spark" /></div><div class="quick-actions"><button @click="openRecord('health')"><span class="quick-icon health"><HeartPulse :size="19" /></span><span><strong>健康指标</strong><small>体重、体温、心率</small></span><ChevronRight :size="16" /></button><button @click="openRecord('vaccine')"><span class="quick-icon vaccine"><ShieldCheck :size="19" /></span><span><strong>疫苗与驱虫</strong><small>守护免疫计划</small></span><ChevronRight :size="16" /></button><button @click="openRecord('activity')"><span class="quick-icon activity"><Activity :size="19" /></span><span><strong>活动记录</strong><small>记录每一次活力</small></span><ChevronRight :size="16" /></button><button @click="openRecord('feeding')"><span class="quick-icon feeding"><Utensils :size="19" /></span><span><strong>喂食计划</strong><small>安排每日饮食</small></span><ChevronRight :size="16" /></button></div></article>
        </section>
        <section class="content-grid bottom-grid"><article class="panel vaccine-panel"><div class="panel-heading"><div><span class="eyebrow">免疫计划</span><h3>疫苗与驱虫</h3></div><button class="text-btn" @click="openRecord('vaccine')">添加 <Plus :size="15" /></button></div><div class="vaccine-list"><div v-for="item in upcomingVaccines.slice(0, 3)" :key="item.id" class="vaccine-item" :class="{ urgent: item.days < 0 }"><div class="vaccine-mark" :class="{ urgent: item.days < 0 }"><ShieldCheck :size="17" /></div><div><strong>{{ item.category || '疫苗' }} · {{ item.name }}</strong><span>{{ petName(item.petId) }} · {{ item.hospital || '未填写医院' }}</span></div><span class="date-badge" :class="vaccineTone(item.days)">{{ item.days < 0 ? `已逾期 ${-item.days} 天` : item.days === 0 ? '今天' : `${item.days} 天后` }}</span><button v-if="item.days <= 7" class="check-circle actionable" title="标记已完成" @click="completeVaccine(item.id)"><Check :size="14" /></button></div><div v-if="!upcomingVaccines.length" class="empty-state">所有接种计划都已完成，记得补录新的安排。</div></div><button class="full-btn" @click="activeNav = 'schedule'">查看历史接种记录 <ChevronRight :size="15" /></button></article><article class="panel achievement-panel"><div class="panel-heading"><div><span class="eyebrow">成长足迹</span><h3>成就徽章 <small>{{ activeAchievements.length }}/12</small></h3></div><button class="text-btn" @click="activeNav = 'achievements'">全部 <ChevronRight :size="15" /></button></div><div class="badge-row"><div v-for="item in achievements.slice(0, 6)" :key="item.id" class="badge-item" :class="{ locked: !item.unlocked }"><div><Award v-if="item.unlocked" :size="21" /><span v-else>?</span></div><small>{{ item.title }}</small></div></div></article></section>
      </div>
      <div v-else class="page placeholder-page">
        <section class="welcome-row"><div><p class="section-kicker">家庭健康空间</p><h2>{{ navItems.find((item) => item.id === activeNav)?.label }}</h2><p class="muted">所有记录都会自动保存在当前设备。</p></div><button class="btn btn-primary" @click="openRecord(activeNav === 'health' ? 'health' : activeNav === 'activity' ? 'activity' : 'vaccine')"><Plus :size="17" />添加记录</button></section>
        <section class="content-grid"><article class="panel wide-panel"><div class="panel-heading"><div><span class="eyebrow">数据概览</span><h3>{{ activeNav === 'achievements' ? '我的成就' : activeNav === 'schedule' ? '全部日程' : activeNav === 'activity' ? '活动历史' : '健康档案' }}</h3></div></div><div v-if="activeNav === 'achievements'" class="all-badges"><div v-for="item in achievements" :key="item.id" class="achievement-row" :class="{ unlocked: item.unlocked }"><div class="badge-large"><Award v-if="item.unlocked" :size="22" /><span v-else>?</span></div><div><strong>{{ item.title }}</strong><span>{{ item.desc }}</span></div><b>{{ item.unlocked ? '已解锁' : '未解锁' }}</b></div></div><div v-else-if="activeNav === 'schedule'" class="schedule-body"><div class="agenda-list large-list"><div v-for="item in agenda" :key="item.id" class="agenda-item" :class="{ urgent: item.urgent }"><div class="agenda-time">{{ item.time }}</div><div class="agenda-icon" :class="[item.kind, { urgent: item.urgent }]"><component :is="agendaIcons[item.kind]" :size="17" /></div><div class="agenda-copy"><strong>{{ item.title }}</strong><span>{{ item.detail }}</span></div><button v-if="item.actionable" class="check-circle actionable" title="标记已完成" @click="markAgendaDone(item)"><Check :size="14" /></button><button v-else class="check-circle"><Check :size="14" /></button></div><div v-if="!agenda.length" class="empty-state">没有逾期或临期的安排，免疫计划都在正轨上。</div></div><section class="history-block"><div class="history-heading"><div><span class="eyebrow">档案留存</span><h3>历史接种记录 <small>{{ vaccineHistory.length }} 条</small></h3></div><button class="text-btn" @click="openRecord('vaccine')">补录接种 <Plus :size="15" /></button></div><div v-if="vaccineHistory.length" class="vaccine-history"><div v-for="item in vaccineHistory" :key="item.id" class="history-row"><span class="history-tag" :class="item.completed ? 'done' : 'replaced'">{{ item.completed ? '已完成' : '补录替换' }}</span><div class="history-main"><strong>{{ item.category || '疫苗' }} · {{ item.name }} · {{ petName(item.petId) }}</strong><span>{{ item.hospital || '未填写医院' }}<template v-if="item.notes"> · {{ item.notes }}</template></span></div><span class="history-date">{{ item.completed ? '完成于' : '补录于' }} {{ formatDate(item.finishedDate, true) }}</span></div></div><div v-else class="empty-state">还没有历史接种记录，标记完成或补录后会保存在这里。</div></section></div><div v-else-if="activeNav === 'activity'" class="table-list"><div v-for="item in state.activities" :key="item.id" class="table-row"><strong>{{ petName(item.petId) }}</strong><span>{{ formatDate(item.date, true) }}</span><span>{{ item.type }} · {{ item.duration }} 分钟</span><span>{{ item.location || '未填写地点' }}</span></div></div><div v-else class="table-list"><div v-for="item in state.healthRecords" :key="item.id" class="table-row"><strong>{{ petName(item.petId) }}</strong><span>{{ formatDate(item.date, true) }}</span><span>{{ metricLabel(item.type) }}</span><span>{{ item.value }} {{ normalRanges[item.type].unit }}</span></div></div></article><article class="panel leaderboard-panel"><div class="panel-heading"><div><span class="eyebrow">家庭榜单</span><h3>健康榜</h3></div><ChartNoAxesCombined :size="19" /></div><div v-for="(pet, index) in leaderboard" :key="pet.id" class="rank-row"><span class="rank-number">{{ String(index + 1).padStart(2, '0') }}</span><div class="mini-avatar">{{ pet.species === '狗' ? '🐕' : '🐈' }}</div><div><strong>{{ pet.name }}</strong><span>档案完整度 {{ pet.completeness }}%</span></div><b>{{ pet.completeness }}</b></div></article></section>
      </div>
    </main>
    <PetModal :visible="showPetModal" @close="showPetModal = false" @submit="(payload) => { addPet(payload); showPetModal = false }" />
    <RecordModal :visible="!!recordType" :type="recordType || 'health'" :pets="state.pets" @close="recordType = ''" @submit="saveRecord" />
  </div>
</template>
