import fs from 'fs';
import path from 'path';
import type {
  ActiveTimer,
  AppNotification,
  AssignmentHistoryEntry,
  AutoReportSettings,
  CrewMember,
  DashboardWidgetId,
  ManagerDivision,
  MonthlyReportRecord,
  ProjectDiscipline,
  ProjectStatus,
  ProjectWorkflowActionPayload,
  ProjectWorkflowStage,
  TimeLogEntry,
  UserDashboardConfig,
  WorkItem,
  WorkspaceState,
} from '../src/types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'workspace.json');

const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  'summary_strip',
  'live_tracker',
  'crew_workload',
  'urgent_deadlines',
  'today_schedule',
  'weekly_productivity',
];

function routeManagerByDiscipline(discipline?: ProjectDiscipline): ManagerDivision {
  return discipline === 'Installasi' ? 'technical_support' : 'video_production';
}

function getManagerTitle(division: ManagerDivision): string {
  return division === 'technical_support'
    ? 'Technical Support Manager'
    : 'Video Production Manager';
}

function deriveProjectStatus(
  workflowStage?: ProjectWorkflowStage,
  fallback?: ProjectStatus
): ProjectStatus {
  if (fallback) return fallback;
  switch (workflowStage) {
    case 'revision_admin':
      return 'Revision';
    case 'rejected_manager':
      return 'Rejected';
    case 'in_execution':
      return 'On Progress';
    case 'pending_handover':
      return 'Review';
    case 'delivered_client':
      return 'Completed';
    case 'pending_review':
    default:
      return 'Waiting List';
  }
}

function normalizeAssigneeIds(assigneeId?: string, assigneeIds?: string[]): string[] {
  const raw = Array.isArray(assigneeIds) && assigneeIds.length > 0
    ? assigneeIds
    : assigneeId
      ? [assigneeId]
      : [];
  const unique: string[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && id.trim() && !unique.includes(id)) {
      unique.push(id);
    }
  }
  if (unique.length === 0 && assigneeId) {
    unique.push(assigneeId);
  }
  return unique;
}

function getItemAssigneeIds(item: Pick<WorkItem, 'assigneeId' | 'assigneeIds'>): string[] {
  return normalizeAssigneeIds(item.assigneeId, item.assigneeIds);
}

const EDITING_AUTO_STOP_HOUR = 16;
const EDITING_AUTO_STOP_MINUTE = 30;
const DEFAULT_WIB_TZ_OFFSET_MINUTES = -420; // UTC+7 (WIB)

function isEditingProject(item?: WorkItem): boolean {
  return Boolean(item && item.category === 'project' && item.discipline === 'Editing');
}

function computeEditingAutoStopIsoServer(
  startedAtDate: Date,
  timezoneOffsetMinutes: number = DEFAULT_WIB_TZ_OFFSET_MINUTES
): string {
  const safeOffset =
    Number.isFinite(timezoneOffsetMinutes) &&
    timezoneOffsetMinutes >= -840 &&
    timezoneOffsetMinutes <= 840
      ? timezoneOffsetMinutes
      : DEFAULT_WIB_TZ_OFFSET_MINUTES;
  const offsetMs = safeOffset * 60_000;
  const localMs = startedAtDate.getTime() - offsetMs;
  const cutoffLocal = new Date(localMs);
  cutoffLocal.setUTCHours(EDITING_AUTO_STOP_HOUR, EDITING_AUTO_STOP_MINUTE, 0, 0);
  if (cutoffLocal.getTime() <= localMs) {
    cutoffLocal.setUTCDate(cutoffLocal.getUTCDate() + 1);
  }
  return new Date(cutoffLocal.getTime() + offsetMs).toISOString();
}

function createSeedWorkspace(): WorkspaceState {
  const crew: CrewMember[] = [
    {
      id: 'crew-laras',
      name: 'Laras Wijaya',
      initials: 'LW',
      role: 'Admin Project & Client Intake',
      accessRole: 'admin_project',
      division: 'Operasional',
      maxWeeklyHours: 40,
      avatarBg: 'bg-[#F0EFFC]',
      avatarText: 'text-[#3F3B99]',
      email: 'laras.wijaya@servomedia.id',
    },
    {
      id: 'crew-raka',
      name: 'Raka Pratama',
      initials: 'RP',
      role: 'Video Production Manager',
      accessRole: 'video_manager',
      division: 'Shooting',
      maxWeeklyHours: 40,
      avatarBg: 'bg-[#FEF1F5]',
      avatarText: 'text-[#9D113C]',
      email: 'raka.pratama@servomedia.id',
    },
    {
      id: 'crew-bima',
      name: 'Bima Santoso',
      initials: 'BS',
      role: 'Technical Support Manager',
      accessRole: 'tech_manager',
      division: 'Installasi',
      maxWeeklyHours: 40,
      avatarBg: 'bg-[#E0F2FE]',
      avatarText: 'text-[#0369A1]',
      email: 'bima.santoso@servomedia.id',
    },
    {
      id: 'crew-nadia',
      name: 'Nadia Putri',
      initials: 'NP',
      role: 'Lead Video Editor',
      accessRole: 'crew',
      division: 'Editing',
      maxWeeklyHours: 38,
      avatarBg: 'bg-[#F0EFFC]',
      avatarText: 'text-[#3F3B99]',
      email: 'nadia.putri@servomedia.id',
    },
    {
      id: 'crew-dimas',
      name: 'Dimas Arya',
      initials: 'DA',
      role: 'Spesialis Installasi & AV',
      accessRole: 'crew',
      division: 'Installasi',
      maxWeeklyHours: 40,
      avatarBg: 'bg-[#E0F2FE]',
      avatarText: 'text-[#0369A1]',
      email: 'dimas.arya@servomedia.id',
    },
    {
      id: 'crew-sinta',
      name: 'Sinta Dewi',
      initials: 'SD',
      role: 'Videografer & Drone',
      accessRole: 'crew',
      division: 'Shooting',
      maxWeeklyHours: 36,
      avatarBg: 'bg-[#FFF5E6]',
      avatarText: 'text-[#8C5811]',
      email: 'sinta.dewi@servomedia.id',
    },
    {
      id: 'crew-bagas',
      name: 'Bagas Mahendra',
      initials: 'BM',
      role: 'Teknisi Installasi & Audio',
      accessRole: 'crew',
      division: 'Installasi',
      maxWeeklyHours: 40,
      avatarBg: 'bg-[#FFECEB]',
      avatarText: 'text-[#942922]',
      email: 'bagas.mahendra@servomedia.id',
    },
  ];

  const workItems: WorkItem[] = [
    // === STAGE 2: MENUNGGU REVIEW MANAGER (Baru masuk dari Admin Project) ===
    {
      id: 'wi-109',
      code: 'PRJ-209',
      title: 'Shooting Iklan Peluncuran Produk EcoDrive EV',
      description: 'Brief klien: 1 video hero 60 detik + 3 cutdown 15 detik, lokasi outdoor & studio showroom, termasuk talent internal klien.',
      category: 'project',
      discipline: 'Shooting',
      priority: 'Tinggi',
      difficulty: 'Kompleks',
      estimatedHours: 14,
      loggedSeconds: 0,
      assigneeId: 'crew-raka',
      kanbanStage: 'backlog',
      status: 'Belum Mulai',
      startDate: '2026-11-20',
      dueDate: '2026-11-25',
      dueTime: '17:00',
      location: 'Showroom EcoDrive BSD & Studio Utama',
      progress: 0,
      checklist: [
        { id: 'c29', text: 'Brief kreatif & referensi warna dari klien lengkap', done: true },
        { id: 'c30', text: 'Persetujuan jadwal & crew oleh Video Production Manager', done: false },
      ],
      requestNo: 'REQ-209',
      coordinatorDepartment: 'Marketing',
      clientName: 'PT Astra EcoDrive Indonesia',
      clientPhone: '081288901122',
      clientContact: 'Andi Kurniawan (Brand Manager · 081288901122)',
      receivedDate: '2026-11-18',
      shootingDate: '2026-11-21',
      shootingStartTime: '08:30',
      shootingEndTime: '16:30',
      calendarCoordination: true,
      projectStatus: 'Waiting List',
      changeNotes: 'Brief awal diterima; talent internal klien tersedia di Showroom BSD.',
      workflowStage: 'pending_review',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      createdAt: '2026-11-18T08:15:00.000Z',
      updatedAt: '2026-11-18T08:15:00.000Z',
    },
    {
      id: 'wi-110',
      code: 'PRJ-210',
      title: 'Installasi Videowall LED 4x2m & Audio Conference Ballroom',
      description: 'Pemasangan LED pitch P2.5 ukuran 4x2 meter, processor Novastar, 4 wireless mic konferensi, serta integrasi switcher Zoom Room.',
      category: 'project',
      discipline: 'Installasi',
      priority: 'Mendesak',
      difficulty: 'Kompleks',
      estimatedHours: 18,
      loggedSeconds: 0,
      assigneeId: 'crew-bima',
      kanbanStage: 'backlog',
      status: 'Belum Mulai',
      startDate: '2026-11-20',
      dueDate: '2026-11-23',
      dueTime: '16:00',
      location: 'Ballroom Hotel Grand Nusantara',
      progress: 0,
      checklist: [
        { id: 'c31', text: 'Denah ruangan & spesifikasi listrik dari klien terlampir', done: true },
        { id: 'c32', text: 'Review teknis & penugasan crew oleh Technical Support Manager', done: false },
      ],
      requestNo: 'REQ-210',
      coordinatorDepartment: 'Event Ops',
      clientName: 'Hotel Grand Nusantara Jakarta',
      clientPhone: '081122349901',
      clientContact: 'Ibu Ratna Sari (Event Ops · 081122349901)',
      receivedDate: '2026-11-18',
      calendarCoordination: true,
      projectStatus: 'Waiting List',
      changeNotes: 'Loading dock ballroom dibuka mulai pukul 07:00 WIB.',
      workflowStage: 'pending_review',
      routedManager: 'technical_support',
      createdByAdminId: 'crew-laras',
      createdAt: '2026-11-18T09:10:00.000Z',
      updatedAt: '2026-11-18T09:10:00.000Z',
    },

    // === STAGE 1 (REVISI ADMIN): DIKEMBALIKAN MANAGER KE ADMIN PROJECT ===
    {
      id: 'wi-108',
      code: 'PRJ-208',
      title: 'Editing Video Recap Rakernas & Highlight Direksi',
      description: 'Klien meminta rangkuman acara 3 menit dan 5 klip testimoni singkat untuk LinkedIn.',
      category: 'project',
      discipline: 'Editing',
      priority: 'Tinggi',
      difficulty: 'Menengah',
      estimatedHours: 12,
      loggedSeconds: 0,
      assigneeId: 'crew-laras',
      kanbanStage: 'backlog',
      status: 'Belum Mulai',
      startDate: '2026-11-21',
      dueDate: '2026-11-26',
      dueTime: '17:00',
      location: 'Suite Editing 1',
      progress: 0,
      checklist: [
        { id: 'c27', text: 'Lengkapi tautan raw footage & panduan logo brand klien', done: false },
      ],
      requestNo: 'REQ-208',
      coordinatorDepartment: 'Corporate Comm',
      clientName: 'PT Bank Nusantara Syariah',
      clientPhone: '081377614402',
      clientContact: 'Hendra Wijaya (CorpComm · 081377614402)',
      receivedDate: '2026-11-17',
      calendarCoordination: false,
      projectStatus: 'Revision',
      changeNotes: 'Menunggu konfirmasi rasio aspek output 16:9 / 9:16 dari klien.',
      workflowStage: 'revision_admin',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      revisionNote:
        'Tautan Google Drive raw footage multi-cam belum dilampirkan dan rasio aspek output (16:9 / 9:16) belum dikonfirmasi ke klien. Mohon lengkapi dulu.',
      createdAt: '2026-11-17T13:00:00.000Z',
      updatedAt: '2026-11-18T07:40:00.000Z',
    },

    // === STAGE 3: APPROVED & DIKERJAKAN CREW (Muncul di Kanban + Gantt + Calendar) ===
    {
      id: 'wi-101',
      code: 'PRJ-201',
      title: 'Company Profile Video — Kampanye Akhir Tahun',
      description: 'Pengambilan gambar 2 hari di kantor pusat & studio utama menggunakan Sony FX6 + gimbal + lighting Aputure.',
      category: 'project',
      discipline: 'Shooting',
      priority: 'Mendesak',
      difficulty: 'Kompleks',
      estimatedHours: 16,
      loggedSeconds: 11 * 3600 + 20 * 60,
      assigneeId: 'crew-sinta',
      assigneeIds: ['crew-sinta', 'crew-bagas'],
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-16',
      dueDate: '2026-11-19',
      dueTime: '17:00',
      location: 'Studio Utama & Lantai 4',
      progress: 72,
      checklist: [
        { id: 'c1', text: 'Shot list & storyboard disetujui produser', done: true },
        { id: 'c2', text: 'Setup lighting & wawancara eksekutif', done: true },
        { id: 'c3', text: 'B-roll operasional & drone exterior', done: false },
        { id: 'c4', text: 'Backup kartu memori ke NAS Raid-1', done: false },
      ],
      requestNo: 'REQ-201',
      coordinatorDepartment: 'Brand & Marketing',
      clientName: 'PT Sinar Global Logistik',
      clientPhone: '081219405510',
      clientContact: 'Dian Pramesti (Head of Brand)',
      receivedDate: '2026-11-12',
      shootingDate: '2026-11-18',
      shootingStartTime: '09:00',
      shootingEndTime: '17:00',
      calendarCoordination: true,
      projectStatus: 'On Progress',
      changeNotes: 'Wawancara direksi dipindah ke Lantai 4 sesi pagi.',
      workflowStage: 'in_execution',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-raka',
      createdAt: '2026-11-12T08:30:00.000Z',
      updatedAt: '2026-11-18T09:15:00.000Z',
    },
    {
      id: 'wi-102',
      code: 'PRJ-202',
      title: 'Editing Highlight Acara Annual Summit (Multi-Cam)',
      description: 'Sinkronisasi 4 kamera 4K, pemotongan highlight 3 menit, sound design, dan subtitel bilingual.',
      category: 'project',
      discipline: 'Editing',
      priority: 'Mendesak',
      difficulty: 'Kritis',
      estimatedHours: 20,
      loggedSeconds: 14 * 3600 + 45 * 60,
      assigneeId: 'crew-nadia',
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-15',
      dueDate: '2026-11-19',
      dueTime: '18:00',
      location: 'Suite Editing 1',
      progress: 78,
      checklist: [
        { id: 'c5', text: 'Ingest proxy 4K & multicam sync', done: true },
        { id: 'c6', text: 'Rough cut & pemilihan musik berlisensi', done: true },
        { id: 'c7', text: 'Fine cut & transisi ritmis', done: true },
        { id: 'c8', text: 'Export Master ProRes & H.264 sosial media', done: false },
      ],
      requestNo: 'REQ-202',
      coordinatorDepartment: 'Event & Program',
      clientName: 'Asosiasi Fintech Indonesia',
      clientPhone: '081590223344',
      clientContact: 'Kevin Hartono (Program Lead)',
      receivedDate: '2026-11-13',
      calendarCoordination: true,
      projectStatus: 'On Progress',
      changeNotes: 'Tambahan subtitel bilingual ID/EN atas permintaan panitia.',
      workflowStage: 'in_execution',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-raka',
      createdAt: '2026-11-13T09:00:00.000Z',
      updatedAt: '2026-11-18T10:20:00.000Z',
    },
    {
      id: 'wi-104',
      code: 'PRJ-204',
      title: 'Shooting Konten Reels & TikTok Produk Batch Nov-3',
      description: 'Produksi 6 video pendek vertikal dengan konsep transisi cepat & pencahayaan studio produk.',
      category: 'project',
      discipline: 'Shooting',
      priority: 'Tinggi',
      difficulty: 'Menengah',
      estimatedHours: 12,
      loggedSeconds: 3 * 3600,
      assigneeId: 'crew-sinta',
      kanbanStage: 'preprod',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-19',
      dueDate: '2026-11-22',
      dueTime: '15:00',
      location: 'Studio Mini B',
      progress: 30,
      checklist: [
        { id: 'c12', text: 'Konfirmasi talent & properti produk', done: true },
        { id: 'c13', text: 'Draft script & daftar hook 3 detik', done: false },
        { id: 'c14', text: 'Pengambilan gambar 6 skenario', done: false },
      ],
      requestNo: 'REQ-204',
      coordinatorDepartment: 'Social Media',
      clientName: 'Kopi Kenangan Nusantara',
      clientPhone: '081808441230',
      clientContact: 'Mila Kusuma (Social Media Lead)',
      receivedDate: '2026-11-15',
      shootingDate: '2026-11-19',
      shootingStartTime: '10:00',
      shootingEndTime: '15:00',
      calendarCoordination: true,
      projectStatus: 'On Progress',
      changeNotes: 'Produk batch baru dikirim ke Studio Mini B pukul 09:30.',
      workflowStage: 'in_execution',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-raka',
      createdAt: '2026-11-15T11:00:00.000Z',
      updatedAt: '2026-11-18T07:50:00.000Z',
    },
    {
      id: 'wi-105',
      code: 'PRJ-205',
      title: 'Editing Dokumenter Mini Testimoni Klien Enterprise',
      description: 'Pengeditan narasi dokumenter 5 menit, pembersihan noise wawancara, dan grafis data kunci.',
      category: 'project',
      discipline: 'Editing',
      priority: 'Tinggi',
      difficulty: 'Kompleks',
      estimatedHours: 14,
      loggedSeconds: 4 * 3600 + 30 * 60,
      assigneeId: 'crew-nadia',
      kanbanStage: 'preprod',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-18',
      dueDate: '2026-11-24',
      dueTime: '17:00',
      location: 'Suite Editing 1',
      progress: 25,
      checklist: [
        { id: 'c15', text: 'Transkrip & seleksi kutipan inti', done: true },
        { id: 'c16', text: 'Struktur alur cerita & B-roll', done: false },
        { id: 'c17', text: 'Final render & QC audio', done: false },
      ],
      requestNo: 'REQ-205',
      coordinatorDepartment: 'Marketing',
      clientName: 'PT CloudNet Infrastruktur',
      clientPhone: '081299018876',
      clientContact: 'Budi Santosa (VP Marketing)',
      receivedDate: '2026-11-16',
      calendarCoordination: true,
      projectStatus: 'On Progress',
      changeNotes: 'Grafis metrik uptime 99.98% wajib ditampilkan di menit ke-2.',
      workflowStage: 'in_execution',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-raka',
      createdAt: '2026-11-16T09:00:00.000Z',
      updatedAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'wi-106',
      code: 'PRJ-206',
      title: 'Installasi Sistem Multi-Cam & Panel Akustik Studio Podcast v2',
      description: 'Pemasangan bracket kamera PTZ, jalur kabel SDI permanen, mixer audio digital, serta peredam akustik dinding.',
      category: 'project',
      discipline: 'Installasi',
      priority: 'Sedang',
      difficulty: 'Kompleks',
      estimatedHours: 16,
      loggedSeconds: 2 * 3600,
      assigneeId: 'crew-dimas',
      assigneeIds: ['crew-dimas', 'crew-bagas'],
      kanbanStage: 'backlog',
      status: 'Belum Mulai',
      startDate: '2026-11-21',
      dueDate: '2026-11-27',
      dueTime: '17:00',
      location: 'Studio Podcast Lantai 3',
      progress: 15,
      checklist: [
        { id: 'c18', text: 'Pemasangan panel akustik & jalur kabel SDI', done: false },
        { id: 'c19', text: 'Instalasi 3 kamera PTZ & switcher ATEM', done: false },
        { id: 'c20', text: 'Kalibrasi audio & uji siaran langsung', done: false },
      ],
      requestNo: 'REQ-206',
      coordinatorDepartment: 'Studio Ops',
      clientName: 'Media Suara Kreatif',
      clientPhone: '081766509912',
      clientContact: 'Reza Pahlevi (Studio Director)',
      receivedDate: '2026-11-17',
      calendarCoordination: true,
      projectStatus: 'On Progress',
      changeNotes: 'Koordinasi jalur kabel SDI dengan teknisi gedung lantai 3.',
      workflowStage: 'in_execution',
      routedManager: 'technical_support',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-bima',
      createdAt: '2026-11-17T10:00:00.000Z',
      updatedAt: '2026-11-17T10:00:00.000Z',
    },

    // === STAGE 4: SELESAI DARI CREW, DIKEMBALIKAN KE MANAGER UNTUK DIBERIKAN KE KLIEN ===
    {
      id: 'wi-103',
      code: 'PRJ-203',
      title: 'Installasi LED Videotron & Rigging Lighting Panggung Utama',
      description: 'Pemasangan panel LED P2.9, kalibrasi Novastar processor, dan rigging lampu Fresnel untuk acara Annual Summit.',
      category: 'project',
      discipline: 'Installasi',
      priority: 'Tinggi',
      difficulty: 'Kompleks',
      estimatedHours: 10,
      loggedSeconds: 9 * 3600 + 30 * 60,
      assigneeId: 'crew-dimas',
      assigneeIds: ['crew-dimas', 'crew-bagas'],
      kanbanStage: 'review',
      status: 'Review',
      startDate: '2026-11-16',
      dueDate: '2026-11-20',
      dueTime: '16:00',
      location: 'Hall Auditorium Utama',
      progress: 100,
      checklist: [
        { id: 'c9', text: 'Pemasangan rangka truss & panel LED P2.9', done: true },
        { id: 'c10', text: 'Kalibrasi warna & sinyal video SDI/HDMI', done: true },
        { id: 'c11', text: 'Uji beban penuh & serah terima teknis', done: true },
      ],
      requestNo: 'REQ-203',
      coordinatorDepartment: 'Event & Program',
      clientName: 'Asosiasi Fintech Indonesia',
      clientPhone: '081590223344',
      clientContact: 'Kevin Hartono (Program Lead)',
      receivedDate: '2026-11-14',
      calendarCoordination: true,
      projectStatus: 'Review',
      changeNotes: 'Uji beban 4 jam selesai; siap serah terima ke panitia.',
      workflowStage: 'pending_handover',
      routedManager: 'technical_support',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-bima',
      handoverNote:
        'Seluruh panel LED P2.9 dan kalibrasi Novastar sudah lulus uji 4 jam tanpa dead pixel. Berita acara uji teknis siap diserahkan ke klien.',
      createdAt: '2026-11-14T08:00:00.000Z',
      updatedAt: '2026-11-18T10:40:00.000Z',
    },

    // === STAGE 4 (DELIVERED): SUDAH DISERAHKAN MANAGER KE KLIEN ===
    {
      id: 'wi-107',
      code: 'PRJ-207',
      title: 'Shooting Wawancara Pelatihan Internal Divisi',
      description: 'Pengambilan video materi onboarding 2 sesi dengan teleprompter & mic lavalier ganda.',
      category: 'project',
      discipline: 'Shooting',
      priority: 'Sedang',
      difficulty: 'Mudah',
      estimatedHours: 8,
      loggedSeconds: 7 * 3600 + 40 * 60,
      assigneeId: 'crew-sinta',
      kanbanStage: 'done',
      status: 'Selesai',
      startDate: '2026-11-13',
      dueDate: '2026-11-15',
      dueTime: '16:00',
      location: 'Ruang Studio B',
      progress: 100,
      checklist: [
        { id: 'c21', text: 'Setup teleprompter & audio', done: true },
        { id: 'c22', text: 'Rekam sesi 1 & 2', done: true },
        { id: 'c23', text: 'Serahkan master video ke klien', done: true },
      ],
      requestNo: 'REQ-207',
      coordinatorDepartment: 'Learning & Dev',
      clientName: 'PT Telkom Corporate University',
      clientPhone: '081188203411',
      clientContact: 'Ibu Sari Dewi (L&D Lead)',
      receivedDate: '2026-11-11',
      shootingDate: '2026-11-14',
      shootingStartTime: '09:00',
      shootingEndTime: '14:00',
      calendarCoordination: true,
      projectStatus: 'Completed',
      changeNotes: 'Master video 4K disetujui tanpa revisi tambahan.',
      workflowStage: 'delivered_client',
      routedManager: 'video_production',
      createdByAdminId: 'crew-laras',
      approvedByManagerId: 'crew-raka',
      handoverNote: 'Master 4K & link unduhan Drive telah diserahkan dan dikonfirmasi diterima oleh klien.',
      deliveredToClientAt: '2026-11-15T15:30:00.000Z',
      createdAt: '2026-11-11T08:00:00.000Z',
      updatedAt: '2026-11-15T15:30:00.000Z',
      completedAt: '2026-11-15T15:30:00.000Z',
    },

    // --- ROUTINE TASKS (Non-Project — Diisi Mandiri oleh Crew) ---
    {
      id: 'wi-201',
      code: 'RTN-011',
      title: 'Backup & Verifikasi Arsip Footage NAS Mingguan',
      description: 'Sinkronisasi raw footage 4K dari SSD produksi ke NAS utama serta verifikasi checksum arsip.',
      category: 'routine',
      priority: 'Tinggi',
      difficulty: 'Mudah',
      estimatedHours: 4,
      loggedSeconds: 2 * 3600 + 15 * 60,
      assigneeId: 'crew-bagas',
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-18',
      dueDate: '2026-11-19',
      dueTime: '12:00',
      location: 'Ruang Server & Storage',
      recurrence: 'Mingguan',
      progress: 60,
      checklist: [
        { id: 'r1', text: 'Cek kapasitas kosong NAS (>20%)', done: true },
        { id: 'r2', text: 'Salin folder proyek minggu ini', done: true },
        { id: 'r3', text: 'Verifikasi integritas file proxy', done: false },
      ],
      createdAt: '2026-11-16T08:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    },
    {
      id: 'wi-202',
      code: 'RTN-012',
      title: 'Maintenance Lensa, Sensor Kamera & Kalibrasi Gimbal',
      description: 'Pembersihan rutin body kamera FX6/A7SIII, pengecekan baterai V-Mount, dan kalibrasi motor gimbal.',
      category: 'routine',
      priority: 'Sedang',
      difficulty: 'Mudah',
      estimatedHours: 5,
      loggedSeconds: 2 * 3600,
      assigneeId: 'crew-sinta',
      kanbanStage: 'preprod',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-18',
      dueDate: '2026-11-20',
      dueTime: '14:00',
      location: 'Gudang Gear Multimedia',
      recurrence: 'Mingguan',
      progress: 40,
      checklist: [
        { id: 'r4', text: 'Pembersihan optik lensa 24-70 & 70-200', done: true },
        { id: 'r5', text: 'Full-charge 8 unit baterai V-Mount', done: false },
      ],
      createdAt: '2026-11-16T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    },
    {
      id: 'wi-203',
      code: 'RTN-013',
      title: 'Kurasi Bank Aset B-Roll, Template Lower-Third & LUT',
      description: 'Penataan folder preset Premiere/DaVinci serta penamaan standar aset grafis agar mudah dipakai seluruh kru.',
      category: 'routine',
      priority: 'Sedang',
      difficulty: 'Mudah',
      estimatedHours: 5,
      loggedSeconds: 1 * 3600 + 30 * 60,
      assigneeId: 'crew-nadia',
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-17',
      dueDate: '2026-11-21',
      dueTime: '16:00',
      location: 'Server Aset Kreatif',
      recurrence: 'Mingguan',
      progress: 35,
      checklist: [
        { id: 'r6', text: 'Tagging klip B-Roll kantor terbaru', done: true },
        { id: 'r7', text: 'Perbarui template mogrt Q4', done: false },
      ],
      createdAt: '2026-11-15T09:00:00.000Z',
      updatedAt: '2026-11-18T07:30:00.000Z',
    },
    {
      id: 'wi-204',
      code: 'RTN-014',
      title: 'Pengecekan Audio Studio & Firmware Mic Wireless',
      description: 'Uji noise floor ruang rekaman podcast dan sinkronisasi frekuensi sistem wireless lavalier.',
      category: 'routine',
      priority: 'Rendah',
      difficulty: 'Mudah',
      estimatedHours: 3,
      loggedSeconds: 3 * 3600,
      assigneeId: 'crew-bagas',
      kanbanStage: 'done',
      status: 'Selesai',
      startDate: '2026-11-16',
      dueDate: '2026-11-17',
      dueTime: '11:00',
      location: 'Studio Podcast',
      recurrence: 'Mingguan',
      progress: 100,
      checklist: [
        { id: 'r8', text: 'Uji gain preamp & kabel XLR', done: true },
        { id: 'r9', text: 'Ganti baterai cadangan transmitter', done: true },
      ],
      createdAt: '2026-11-14T08:00:00.000Z',
      updatedAt: '2026-11-17T10:30:00.000Z',
      completedAt: '2026-11-17T10:30:00.000Z',
    },

    // --- FLEXIBLE / AD-HOC TASKS (Non-Project — Diisi Mandiri oleh Crew) ---
    {
      id: 'wi-301',
      code: 'FLX-031',
      title: 'Support Teknis Livestream Townhall Divisi',
      description: 'Setup OBS/vMix switcher, pengecekan bitrate internet, dan dukungan kamera dadakan untuk sesi Townhall.',
      category: 'flexible',
      priority: 'Mendesak',
      difficulty: 'Menengah',
      estimatedHours: 6,
      loggedSeconds: 2 * 3600 + 30 * 60,
      assigneeId: 'crew-bagas',
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-18',
      dueDate: '2026-11-18',
      dueTime: '16:30',
      location: 'Auditorium Lantai 2',
      recurrence: 'Sekali',
      progress: 55,
      checklist: [
        { id: 'f1', text: 'Uji stream key & audio feed Zoom', done: true },
        { id: 'f2', text: 'Operasikan live switcher selama sesi', done: false },
      ],
      createdAt: '2026-11-17T14:00:00.000Z',
      updatedAt: '2026-11-18T08:30:00.000Z',
    },
    {
      id: 'wi-302',
      code: 'FLX-032',
      title: 'Dokumentasi Foto Kunjungan Mitra Strategis',
      description: 'Pemotretan candid & foto grup formal untuk kebutuhan rilis pers dan LinkedIn perusahaan.',
      category: 'flexible',
      priority: 'Tinggi',
      difficulty: 'Mudah',
      estimatedHours: 4,
      loggedSeconds: 0,
      assigneeId: 'crew-sinta',
      kanbanStage: 'preprod',
      status: 'Belum Mulai',
      startDate: '2026-11-19',
      dueDate: '2026-11-19',
      dueTime: '13:00',
      location: 'Ruang Rapat VIP',
      recurrence: 'Sekali',
      progress: 0,
      checklist: [
        { id: 'f3', text: 'Siapkan kamera stills & flash diffuser', done: false },
        { id: 'f4', text: 'Pilih 15 foto terbaik & kirim ke PR', done: false },
      ],
      createdAt: '2026-11-18T07:00:00.000Z',
      updatedAt: '2026-11-18T07:00:00.000Z',
    },
    {
      id: 'wi-303',
      code: 'FLX-033',
      title: 'Revisi Cepat Thumbnail YouTube & Cutdown Story',
      description: 'Permintaan fleksibel tim marketing untuk mengganti judul visual thumbnail & rasio 9:16 video sebelumnya.',
      category: 'flexible',
      priority: 'Sedang',
      difficulty: 'Mudah',
      estimatedHours: 4,
      loggedSeconds: 1 * 3600,
      assigneeId: 'crew-nadia',
      kanbanStage: 'production',
      status: 'Sedang Dikerjakan',
      startDate: '2026-11-18',
      dueDate: '2026-11-20',
      dueTime: '12:00',
      location: 'Suite Editing 1',
      recurrence: 'Sekali',
      progress: 45,
      checklist: [
        { id: 'f5', text: 'Export 3 opsi thumbnail kontras tinggi', done: true },
        { id: 'f6', text: 'Cutdown 30 detik format vertikal', done: false },
      ],
      createdAt: '2026-11-18T08:15:00.000Z',
      updatedAt: '2026-11-18T09:45:00.000Z',
    },
  ];

  const seededEditingStart = new Date(Date.now() - 42 * 60 * 1000);
  const activeTimers: ActiveTimer[] = [
    {
      id: 'tmr-1',
      workItemId: 'wi-102',
      crewId: 'crew-nadia',
      startedAt: seededEditingStart.toISOString(),
      autoStopAt: computeEditingAutoStopIsoServer(seededEditingStart),
      note: 'Finalisasi cut ritmis & audio leveling',
    },
    {
      id: 'tmr-2',
      workItemId: 'wi-101',
      crewId: 'crew-sinta',
      startedAt: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
      note: 'Pengambilan B-roll lantai 4',
    },
  ];

  const timeLogs: TimeLogEntry[] = [
    {
      id: 'log-1',
      workItemId: 'wi-101',
      crewId: 'crew-sinta',
      startedAt: '2026-11-17T02:00:00.000Z',
      endedAt: '2026-11-17T06:30:00.000Z',
      durationSeconds: 4.5 * 3600,
      note: 'Shooting wawancara direksi sesi pagi (Kamera A & Drone)',
      source: 'auto',
    },
    {
      id: 'log-1b',
      workItemId: 'wi-101',
      crewId: 'crew-bagas',
      startedAt: '2026-11-17T02:00:00.000Z',
      endedAt: '2026-11-17T06:00:00.000Z',
      durationSeconds: 4 * 3600,
      note: 'Setup audio boom, lighting wawancara & monitoring (kolaborasi)',
      source: 'auto',
    },
    {
      id: 'log-2',
      workItemId: 'wi-102',
      crewId: 'crew-nadia',
      startedAt: '2026-11-17T03:00:00.000Z',
      endedAt: '2026-11-17T08:15:00.000Z',
      durationSeconds: 5.25 * 3600,
      note: 'Multicam sync 4 kamera & rough cut (lanjutan dari ingest)',
      source: 'auto',
    },
    {
      id: 'log-2-prev',
      workItemId: 'wi-102',
      crewId: 'crew-sinta',
      startedAt: '2026-11-16T02:00:00.000Z',
      endedAt: '2026-11-16T04:30:00.000Z',
      durationSeconds: 2.5 * 3600,
      note: 'Ingest raw 4 kamera & seleksi footage awal sebelum dilanjutkan editor',
      source: 'manual',
    },
    {
      id: 'log-3',
      workItemId: 'wi-103',
      crewId: 'crew-dimas',
      startedAt: '2026-11-17T05:00:00.000Z',
      endedAt: '2026-11-17T09:00:00.000Z',
      durationSeconds: 4 * 3600,
      note: 'Pemasangan truss & kalibrasi panel LED (09:00–13:00)',
      source: 'manual',
    },
    {
      id: 'log-3b',
      workItemId: 'wi-103',
      crewId: 'crew-bagas',
      startedAt: '2026-11-17T05:00:00.000Z',
      endedAt: '2026-11-17T08:30:00.000Z',
      durationSeconds: 3.5 * 3600,
      note: 'Routing kabel audio mixer & uji sinyal lapangan (09:00–12:30)',
      source: 'manual',
    },
    {
      id: 'log-4',
      workItemId: 'wi-201',
      crewId: 'crew-bagas',
      startedAt: '2026-11-18T01:30:00.000Z',
      endedAt: '2026-11-18T03:45:00.000Z',
      durationSeconds: 2.25 * 3600,
      note: 'Backup SSD produksi ke NAS',
      source: 'auto',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf-approval-210',
      type: 'urgent',
      title: 'Project Baru Masuk ke Technical Support Manager: PRJ-210',
      message:
        'Admin Project (Laras Wijaya) mengirim form Installasi dari Hotel Grand Nusantara. Menunggu review & penugasan Bima Santoso.',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      read: false,
      workItemId: 'wi-110',
      crewId: 'crew-bima',
      targetPage: 'approval_tech',
    },
    {
      id: 'ntf-handover-103',
      type: 'update',
      title: 'Project Selesai dari Crew Menunggu Serah Terima: PRJ-203',
      message:
        'Dimas Arya telah menyelesaikan Installasi LED Videotron & mengembalikannya ke Technical Support Manager untuk diberikan ke klien.',
      createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      read: false,
      workItemId: 'wi-103',
      crewId: 'crew-bima',
      targetPage: 'handover_tech',
    },
    {
      id: 'ntf-overload-nadia',
      type: 'overload',
      title: 'Peringatan Overload Beban Kerja: Nadia Putri',
      message:
        'Total beban aktif Nadia Putri mencapai 43 jam dari batas kapasitas 38 jam/minggu (113%). Segera alihkan sebagian tugas.',
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      read: false,
      crewId: 'crew-nadia',
      targetPage: 'workload',
    },
    {
      id: 'ntf-revision-108',
      type: 'deadline',
      title: 'Project Dikembalikan ke Admin Project: PRJ-208',
      message:
        'Video Production Manager mengembalikan PRJ-208 (PT Bank Nusantara Syariah) karena link raw footage & rasio output belum lengkap.',
      createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      read: false,
      workItemId: 'wi-108',
      crewId: 'crew-laras',
      targetPage: 'intake',
    },
    {
      id: 'ntf-report-oct',
      type: 'report',
      title: 'Laporan Otomatis Akhir Bulan Oktober 2026 Tersedia',
      message:
        'Rekap produktivitas tim, realisasi jam shooting/editing/installasi, tugas rutin, dan insiden overload bulan Oktober telah diarsipkan.',
      createdAt: '2026-10-31T10:00:00.000Z',
      read: true,
      targetPage: 'analytics',
    },
  ];

  const dashboardConfigs: Record<string, UserDashboardConfig> = {};
  for (const member of crew) {
    dashboardConfigs[member.id] = {
      crewId: member.id,
      widgetOrder: [...DEFAULT_WIDGET_ORDER],
      hiddenWidgets: [],
      density: 'comfortable',
    };
  }

  const monthlyReports: MonthlyReportRecord[] = [
    {
      id: 'rep-2026-10',
      monthKey: '2026-10',
      monthLabel: 'Oktober 2026',
      generatedAt: '2026-10-31T10:00:00.000Z',
      autoGenerated: true,
      totalProjectsCompleted: 11,
      totalRoutineCompleted: 18,
      totalFlexibleCompleted: 9,
      totalTrackedHours: 642.5,
      totalEstimatedHours: 660,
      onTimeRate: 92,
      overloadIncidents: 2,
      crewBreakdown: [
        {
          crewId: 'crew-nadia',
          crewName: 'Nadia Putri',
          role: 'Lead Video Editor',
          projectHours: 116,
          routineHours: 18,
          flexibleHours: 12,
          completedCount: 9,
          utilizationPct: 96,
        },
        {
          crewId: 'crew-dimas',
          crewName: 'Dimas Arya',
          role: 'Spesialis Installasi & AV',
          projectHours: 98,
          routineHours: 16,
          flexibleHours: 10,
          completedCount: 7,
          utilizationPct: 78,
        },
        {
          crewId: 'crew-sinta',
          crewName: 'Sinta Dewi',
          role: 'Videografer & Drone',
          projectHours: 102,
          routineHours: 16,
          flexibleHours: 16,
          completedCount: 8,
          utilizationPct: 86,
        },
        {
          crewId: 'crew-bagas',
          crewName: 'Bagas Mahendra',
          role: 'Teknisi Installasi & Audio',
          projectHours: 58,
          routineHours: 42,
          flexibleHours: 26,
          completedCount: 7,
          utilizationPct: 75,
        },
      ],
    },
  ];

  const autoReportSettings: AutoReportSettings = {
    enabled: true,
    dayOfMonth: 'last_day',
    runTime: '17:00',
    includeRoutineAndFlexible: true,
    lastRunAt: '2026-10-31T10:00:00.000Z',
  };

  const weeklyHistory = [
    { weekLabel: 'Minggu 1 (Okt)', plannedHours: 158, trackedHours: 152, completedProjects: 3, completedNonProject: 6 },
    { weekLabel: 'Minggu 2 (Okt)', plannedHours: 164, trackedHours: 161, completedProjects: 3, completedNonProject: 7 },
    { weekLabel: 'Minggu 3 (Okt)', plannedHours: 170, trackedHours: 166, completedProjects: 2, completedNonProject: 7 },
    { weekLabel: 'Minggu 4 (Okt)', plannedHours: 168, trackedHours: 163, completedProjects: 3, completedNonProject: 7 },
    { weekLabel: 'Minggu 1 (Nov)', plannedHours: 162, trackedHours: 159, completedProjects: 3, completedNonProject: 6 },
    { weekLabel: 'Minggu 2 (Nov)', plannedHours: 172, trackedHours: 168, completedProjects: 4, completedNonProject: 8 },
    { weekLabel: 'Minggu Ini', plannedHours: 141, trackedHours: 112, completedProjects: 2, completedNonProject: 5 },
  ];

  return {
    crew,
    workItems,
    activeTimers,
    timeLogs,
    notifications,
    dashboardConfigs,
    monthlyReports,
    autoReportSettings,
    weeklyHistory,
  };
}

export class WorkspaceStore {
  private state: WorkspaceState;

  constructor() {
    this.state = this.load();
  }

  private load(): WorkspaceState {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as WorkspaceState;
        const validRoles = new Set(['admin_project', 'video_manager', 'tech_manager', 'crew']);
        const hasWorkflowRoles =
          Array.isArray(parsed?.crew) &&
          parsed.crew.some((c) => c.accessRole === 'admin_project') &&
          parsed.crew.some((c) => c.accessRole === 'video_manager') &&
          parsed.crew.some((c) => c.accessRole === 'tech_manager') &&
          parsed.crew.every((c) => validRoles.has(c.accessRole));
        const hasWorkflowStages =
          Array.isArray(parsed?.workItems) &&
          parsed.workItems.every((w) => w.category !== 'project' || Boolean(w.workflowStage));

        if (parsed && hasWorkflowRoles && hasWorkflowStages) {
          // Migrate any legacy unified notification targetPage values to division-specific pages
          if (Array.isArray(parsed.notifications)) {
            parsed.notifications = parsed.notifications.map((n) => {
              const rawTarget = n.targetPage as string | undefined;
              if (rawTarget !== 'approval' && rawTarget !== 'kanban' && rawTarget !== 'handover') {
                return n;
              }
              const linked = n.workItemId
                ? parsed.workItems.find((w) => w.id === n.workItemId)
                : undefined;
              const isTech =
                linked?.routedManager === 'technical_support' ||
                linked?.discipline === 'Installasi';
              const mapped =
                rawTarget === 'approval'
                  ? isTech
                    ? 'approval_tech'
                    : 'approval_video'
                  : rawTarget === 'kanban'
                    ? isTech
                      ? 'kanban_tech'
                      : 'kanban_video'
                    : isTech
                      ? 'handover_tech'
                      : 'handover_video';
              return { ...n, targetPage: mapped };
            });
          }
          // One-time seamless migration to multi-crew assigneeIds on existing workspace files
          let didMigrate = false;
          const needsMultiCrewBackfill = parsed.workItems.every(
            (w) => !Array.isArray(w.assigneeIds) || w.assigneeIds.length === 0
          );
          if (needsMultiCrewBackfill) {
            const multiCrewDefaults: Record<string, string[]> = {
              'wi-101': ['crew-sinta', 'crew-bagas'],
              'wi-106': ['crew-dimas', 'crew-bagas'],
              'wi-103': ['crew-dimas', 'crew-bagas'],
            };
            parsed.workItems = parsed.workItems.map((w) => ({
              ...w,
              assigneeIds: multiCrewDefaults[w.id] || [w.assigneeId],
            }));
            didMigrate = true;
          } else {
            parsed.workItems = parsed.workItems.map((w) => {
              const ids = getItemAssigneeIds(w);
              return { ...w, assigneeId: ids[0] || w.assigneeId, assigneeIds: ids };
            });
          }

          // One-time seamless migration to standardized Project form fields
          const needsProjectFieldsBackfill = parsed.workItems.some(
            (w) => w.category === 'project' && (!w.requestNo || w.projectStatus === undefined)
          );
          if (needsProjectFieldsBackfill) {
            const seedLookup = new Map(
              createSeedWorkspace().workItems.map((sw) => [sw.id, sw])
            );
            parsed.workItems = parsed.workItems.map((w) => {
              if (w.category !== 'project') return w;
              const seedMatch = seedLookup.get(w.id);
              const isShooting = w.discipline === 'Shooting';
              const fallbackReq = w.code ? w.code.replace(/^PRJ-/, 'REQ-') : `REQ-${w.id.slice(-3)}`;
              return {
                ...w,
                requestNo: w.requestNo || seedMatch?.requestNo || fallbackReq,
                coordinatorDepartment:
                  w.coordinatorDepartment || seedMatch?.coordinatorDepartment || 'Marketing',
                clientPhone:
                  w.clientPhone ||
                  seedMatch?.clientPhone ||
                  (w.clientContact?.match(/08[\d-]+/)?.[0]?.replace(/-/g, '') ?? ''),
                receivedDate:
                  w.receivedDate ||
                  seedMatch?.receivedDate ||
                  w.createdAt?.slice(0, 10) ||
                  w.startDate,
                shootingDate: isShooting
                  ? w.shootingDate || seedMatch?.shootingDate || w.startDate
                  : undefined,
                shootingStartTime: isShooting
                  ? w.shootingStartTime || seedMatch?.shootingStartTime || '09:00'
                  : undefined,
                shootingEndTime: isShooting
                  ? w.shootingEndTime || seedMatch?.shootingEndTime || '17:00'
                  : undefined,
                calendarCoordination:
                  typeof w.calendarCoordination === 'boolean'
                    ? w.calendarCoordination
                    : seedMatch?.calendarCoordination ?? true,
                projectStatus:
                  w.projectStatus ||
                  seedMatch?.projectStatus ||
                  deriveProjectStatus(w.workflowStage),
                changeNotes:
                  w.changeNotes !== undefined
                    ? w.changeNotes
                    : seedMatch?.changeNotes || '',
              };
            });
            didMigrate = true;
          }

          // Backfill approvedAt for already-approved projects lacking an approval timestamp
          const needsApprovedAtBackfill = parsed.workItems.some(
            (w) =>
              w.category === 'project' &&
              !w.approvedAt &&
              (Boolean(w.approvedByManagerId) ||
                w.workflowStage === 'in_execution' ||
                w.workflowStage === 'pending_handover' ||
                w.workflowStage === 'delivered_client')
          );
          if (needsApprovedAtBackfill) {
            parsed.workItems = parsed.workItems.map((w) => {
              if (
                w.category !== 'project' ||
                w.approvedAt ||
                (!w.approvedByManagerId &&
                  w.workflowStage !== 'in_execution' &&
                  w.workflowStage !== 'pending_handover' &&
                  w.workflowStage !== 'delivered_client')
              ) {
                return w;
              }
              const assignLog = (w.assignmentHistory || []).find((h) => h.type === 'assigned');
              const fallbackIso =
                assignLog?.createdAt ||
                (w.receivedDate ? `${w.receivedDate}T09:00:00.000Z` : w.createdAt);
              return {
                ...w,
                approvedAt: fallbackIso,
              };
            });
            didMigrate = true;
          }

          // Backfill 16:30 autoStopAt on any running Editing project timers
          if (Array.isArray(parsed.activeTimers)) {
            for (const timer of parsed.activeTimers) {
              const linked = parsed.workItems.find((w) => w.id === timer.workItemId);
              if (isEditingProject(linked) && !timer.autoStopAt) {
                const startDate = new Date(timer.startedAt);
                timer.autoStopAt = computeEditingAutoStopIsoServer(
                  Number.isNaN(startDate.getTime()) ? new Date() : startDate
                );
                didMigrate = true;
              }
            }
          }

          // One-time non-intrusive backfill of collaborative & handoff history for seeded items
          const needsHistoryBackfill = parsed.workItems.every(
            (w) => !Array.isArray(w.assignmentHistory) || w.assignmentHistory.length === 0
          );
          if (needsHistoryBackfill) {
            const defaultHistory: Record<string, AssignmentHistoryEntry[]> = {
              'wi-101': [
                {
                  id: 'ah-seed-101',
                  type: 'assigned',
                  fromCrewIds: [],
                  toCrewIds: ['crew-sinta', 'crew-bagas'],
                  actorCrewId: 'crew-raka',
                  note: 'Ditugaskan secara kolaborasi ke Sinta Dewi & Bagas Mahendra',
                  createdAt: '2026-11-16T08:30:00.000Z',
                },
              ],
              'wi-102': [
                {
                  id: 'ah-seed-102',
                  type: 'reassigned',
                  fromCrewIds: ['crew-sinta'],
                  toCrewIds: ['crew-nadia'],
                  actorCrewId: 'crew-raka',
                  note: 'Dilanjutkan dari Sinta Dewi (ingest raw) ke Nadia Putri (editing multi-cam)',
                  createdAt: '2026-11-16T09:00:00.000Z',
                },
              ],
              'wi-103': [
                {
                  id: 'ah-seed-103',
                  type: 'assigned',
                  fromCrewIds: [],
                  toCrewIds: ['crew-dimas', 'crew-bagas'],
                  actorCrewId: 'crew-hendra',
                  note: 'Ditugaskan secara kolaborasi ke Dimas Arya & Bagas Mahendra',
                  createdAt: '2026-11-16T09:15:00.000Z',
                },
              ],
            };
            parsed.workItems = parsed.workItems.map((w) =>
              defaultHistory[w.id] ? { ...w, assignmentHistory: defaultHistory[w.id] } : w
            );
            const existingLogIds = new Set((parsed.timeLogs || []).map((l) => l.id));
            const seedLogs = createSeedWorkspace().timeLogs.filter((l) => !existingLogIds.has(l.id));
            if (seedLogs.length > 0) {
              parsed.timeLogs = [...(parsed.timeLogs || []), ...seedLogs];
            }
            didMigrate = true;
          }

          if (didMigrate) {
            this.save(parsed);
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh seed
    }
    const seed = createSeedWorkspace();
    this.save(seed);
    return seed;
  }

  private save(nextState: WorkspaceState = this.state): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
    } catch {
      // Keep running in memory if filesystem is read-only
    }
  }

  public getState(): WorkspaceState {
    return this.state;
  }

  public getCrewAllocatedHours(crewId: string): {
    total: number;
    project: number;
    routine: number;
    flexible: number;
  } {
    let project = 0;
    let routine = 0;
    let flexible = 0;
    for (const item of this.state.workItems) {
      const assignees = getItemAssigneeIds(item);
      if (!assignees.includes(crewId) || item.status === 'Selesai' || item.kanbanStage === 'done') {
        continue;
      }
      // Projects still in intake/review/admin-revision/rejected aren't counted as crew execution load
      if (
        item.category === 'project' &&
        (item.workflowStage === 'pending_review' ||
          item.workflowStage === 'revision_admin' ||
          item.workflowStage === 'rejected_manager')
      ) {
        continue;
      }
      const perCrewHours = item.estimatedHours / Math.max(1, assignees.length);
      if (item.category === 'project') project += perCrewHours;
      else if (item.category === 'routine') routine += perCrewHours;
      else flexible += perCrewHours;
    }
    return {
      total: Number((project + routine + flexible).toFixed(1)),
      project: Number(project.toFixed(1)),
      routine: Number(routine.toFixed(1)),
      flexible: Number(flexible.toFixed(1)),
    };
  }

  public pushNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
    const created: AppNotification = {
      ...notif,
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.state.notifications = [created, ...this.state.notifications].slice(0, 60);
    this.save();
    return created;
  }

  public checkAndNotifyOverload(crewId: string): AppNotification | null {
    const member = this.state.crew.find((c) => c.id === crewId);
    if (!member) return null;
    const alloc = this.getCrewAllocatedHours(crewId);
    if (alloc.total > member.maxWeeklyHours) {
      const pct = Math.round((alloc.total / member.maxWeeklyHours) * 100);
      return this.pushNotification({
        type: 'overload',
        title: `Overload Beban Kerja: ${member.name}`,
        message: `Beban aktif ${member.name} mencapai ${alloc.total} jam (batas ${member.maxWeeklyHours} jam/minggu · ${pct}%). Pertimbangkan realokasi tugas.`,
        crewId: member.id,
        targetPage: 'workload',
      });
    }
    return null;
  }

  public createWorkItem(
    payload: Omit<WorkItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'loggedSeconds'> & {
      actorCrewId?: string;
    }
  ): { item?: WorkItem; triggeredNotifications: AppNotification[]; error?: string } {
    const { actorCrewId, ...cleanPayload } = payload;
    const actor = actorCrewId ? this.state.crew.find((c) => c.id === actorCrewId) : undefined;

    if (
      cleanPayload.category === 'project' &&
      actor &&
      actor.accessRole !== 'admin_project' &&
      actor.accessRole !== 'video_manager' &&
      actor.accessRole !== 'tech_manager'
    ) {
      return {
        triggeredNotifications: [],
        error: 'Hanya Admin Project yang dapat membuat form project masuk dari klien.',
      };
    }

    const prefix =
      cleanPayload.category === 'project'
        ? 'PRJ'
        : cleanPayload.category === 'routine'
          ? 'RTN'
          : 'FLX';
    const nextNum = 210 + this.state.workItems.length + 1;
    const nowIso = new Date().toISOString();

    let item: WorkItem;
    const triggeredNotifications: AppNotification[] = [];

    if (cleanPayload.category === 'project') {
      const discipline: ProjectDiscipline = cleanPayload.discipline || 'Shooting';
      const routedManager = routeManagerByDiscipline(discipline);
      const managerMember = this.state.crew.find((c) =>
        routedManager === 'technical_support'
          ? c.accessRole === 'tech_manager'
          : c.accessRole === 'video_manager'
      );

      const initialIds =
        cleanPayload.workflowStage === 'in_execution'
          ? normalizeAssigneeIds(cleanPayload.assigneeId, cleanPayload.assigneeIds)
          : [managerMember?.id || cleanPayload.assigneeId];

      const isShooting = discipline === 'Shooting';
      const cleanedRequestNo = cleanPayload.requestNo?.trim() || `REQ-${nextNum}`;
      const cleanedPhone = cleanPayload.clientPhone?.trim() || '';
      const cleanedChangeNotes = cleanPayload.changeNotes?.trim() || '';
      const receivedDate = cleanPayload.receivedDate || cleanPayload.startDate || nowIso.slice(0, 10);
      const effectiveStartDate =
        (isShooting && cleanPayload.shootingDate) || cleanPayload.startDate || receivedDate;
      const effectiveWorkflowStage = cleanPayload.workflowStage || 'pending_review';

      item = {
        ...cleanPayload,
        discipline,
        routedManager,
        workflowStage: effectiveWorkflowStage,
        requestNo: cleanedRequestNo,
        coordinatorDepartment: cleanPayload.coordinatorDepartment?.trim() || 'Marketing',
        clientPhone: cleanedPhone,
        clientContact: cleanPayload.clientContact?.trim() || cleanedPhone,
        receivedDate,
        startDate: effectiveStartDate,
        shootingDate: isShooting ? cleanPayload.shootingDate || '' : undefined,
        shootingStartTime: isShooting ? cleanPayload.shootingStartTime || '' : undefined,
        shootingEndTime: isShooting ? cleanPayload.shootingEndTime || '' : undefined,
        calendarCoordination: cleanPayload.calendarCoordination ?? false,
        projectStatus: deriveProjectStatus(effectiveWorkflowStage),
        changeNotes: cleanedChangeNotes,
        description: cleanPayload.description?.trim() || cleanedChangeNotes,
        createdByAdminId: actor?.id || 'crew-laras',
        assigneeId: initialIds[0],
        assigneeIds: initialIds,
        kanbanStage: effectiveWorkflowStage === 'in_execution' ? 'preprod' : 'backlog',
        status: effectiveWorkflowStage === 'in_execution' ? 'Sedang Dikerjakan' : 'Belum Mulai',
        id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        code: `${prefix}-${nextNum}`,
        loggedSeconds: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      this.state.workItems = [item, ...this.state.workItems];

      triggeredNotifications.push(
        this.pushNotification({
          type: item.priority === 'Mendesak' ? 'urgent' : 'update',
          title: `Form Project Masuk → ${getManagerTitle(routedManager)}`,
          message: `${item.code} (${discipline}) dari ${item.clientName || 'Klien'} menunggu review & approval ${managerMember?.name || getManagerTitle(routedManager)}.`,
          workItemId: item.id,
          crewId: managerMember?.id,
          targetPage: routedManager === 'technical_support' ? 'approval_tech' : 'approval_video',
        })
      );

      if (item.workflowStage === 'in_execution') {
        for (const cid of initialIds) {
          const overloadNotif = this.checkAndNotifyOverload(cid);
          if (overloadNotif) triggeredNotifications.push(overloadNotif);
        }
      }
    } else {
      // Routine or Flexible — created & filled by Crew themselves
      const effectiveAssigneeId =
        actor && actor.accessRole === 'crew' ? actor.id : cleanPayload.assigneeId;

      item = {
        ...cleanPayload,
        assigneeId: effectiveAssigneeId,
        assigneeIds: [effectiveAssigneeId],
        id: `wi-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        code: `${prefix}-${nextNum}`,
        loggedSeconds: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        completedAt: cleanPayload.status === 'Selesai' ? nowIso : undefined,
      };

      this.state.workItems = [item, ...this.state.workItems];

      if (item.priority === 'Mendesak') {
        const assignee = this.state.crew.find((c) => c.id === item.assigneeId);
        triggeredNotifications.push(
          this.pushNotification({
            type: 'urgent',
            title: `Tugas Mendesak Baru: ${item.code}`,
            message: `"${item.title}" dicatat oleh ${assignee?.name || 'Kru'} (${item.estimatedHours} jam, tenggat ${item.dueDate}).`,
            workItemId: item.id,
            crewId: item.assigneeId,
            targetPage: 'tasks',
          })
        );
      }

      const overloadNotif = this.checkAndNotifyOverload(item.assigneeId);
      if (overloadNotif) triggeredNotifications.push(overloadNotif);
    }

    this.save();
    return { item, triggeredNotifications };
  }

  public transitionProjectWorkflow(
    id: string,
    payload: ProjectWorkflowActionPayload
  ): { item?: WorkItem; triggeredNotifications: AppNotification[]; error?: string } {
    const idx = this.state.workItems.findIndex((w) => w.id === id);
    if (idx === -1) {
      return { triggeredNotifications: [], error: 'Project tidak ditemukan.' };
    }

    const prev = this.state.workItems[idx];
    if (prev.category !== 'project') {
      return { triggeredNotifications: [], error: 'Alur approval hanya berlaku untuk Project.' };
    }

    const nowIso = new Date().toISOString();
    const triggeredNotifications: AppNotification[] = [];
    let next: WorkItem = { ...prev, updatedAt: nowIso };

    switch (payload.action) {
      case 'resubmit_to_manager': {
        const nextDiscipline = payload.discipline || prev.discipline || 'Shooting';
        const nextRoute = routeManagerByDiscipline(nextDiscipline);
        const managerMember = this.state.crew.find((c) =>
          nextRoute === 'technical_support'
            ? c.accessRole === 'tech_manager'
            : c.accessRole === 'video_manager'
        );
        const managerAssignee = managerMember?.id || prev.assigneeId;
        const isShooting = nextDiscipline === 'Shooting';
        const nextPhone =
          payload.clientPhone !== undefined ? payload.clientPhone.trim() : prev.clientPhone;
        const nextChangeNotes =
          payload.changeNotes !== undefined ? payload.changeNotes.trim() : prev.changeNotes;
        next = {
          ...next,
          title: payload.title?.trim() || prev.title,
          description:
            payload.description?.trim() || nextChangeNotes || prev.description,
          requestNo: payload.requestNo?.trim() || prev.requestNo,
          coordinatorDepartment:
            payload.coordinatorDepartment !== undefined
              ? payload.coordinatorDepartment.trim()
              : prev.coordinatorDepartment,
          clientName: payload.clientName?.trim() || prev.clientName,
          clientPhone: nextPhone,
          clientContact: payload.clientContact?.trim() || nextPhone || prev.clientContact,
          discipline: nextDiscipline,
          location: payload.location?.trim() || prev.location,
          receivedDate: payload.receivedDate || prev.receivedDate,
          dueDate: payload.dueDate || prev.dueDate,
          shootingDate: isShooting
            ? payload.shootingDate !== undefined
              ? payload.shootingDate
              : prev.shootingDate
            : undefined,
          shootingStartTime: isShooting
            ? payload.shootingStartTime !== undefined
              ? payload.shootingStartTime
              : prev.shootingStartTime
            : undefined,
          shootingEndTime: isShooting
            ? payload.shootingEndTime !== undefined
              ? payload.shootingEndTime
              : prev.shootingEndTime
            : undefined,
          calendarCoordination:
            payload.calendarCoordination !== undefined
              ? payload.calendarCoordination
              : prev.calendarCoordination,
          projectStatus: 'Waiting List',
          changeNotes: nextChangeNotes,
          priority: payload.priority || prev.priority,
          routedManager: nextRoute,
          workflowStage: 'pending_review',
          assigneeId: managerAssignee,
          assigneeIds: [managerAssignee],
          revisionNote: undefined,
          rejectionReason: undefined,
          rejectedAt: undefined,
          rejectedByManagerId: undefined,
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'update',
            title: `Revisi Brief Dikirim Ulang: ${next.code}`,
            message: `Admin Project telah melengkapi form ${next.code} (${nextDiscipline}) untuk direview kembali oleh ${getManagerTitle(nextRoute)}.`,
            workItemId: next.id,
            crewId: managerMember?.id,
            targetPage: nextRoute === 'technical_support' ? 'approval_tech' : 'approval_video',
          })
        );
        break;
      }

      case 'return_to_admin': {
        const adminMember = this.state.crew.find((c) => c.accessRole === 'admin_project');
        const adminAssignee = adminMember?.id || prev.createdByAdminId || prev.assigneeId;
        next = {
          ...next,
          workflowStage: 'revision_admin',
          projectStatus: 'Revision',
          assigneeId: adminAssignee,
          assigneeIds: [adminAssignee],
          revisionNote: payload.revisionNote.trim() || 'Brief atau kelengkapan data klien perlu diperbaiki.',
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'urgent',
            title: `Dikembalikan ke Admin Project: ${next.code}`,
            message: `Catatan Manager: "${next.revisionNote}"`,
            workItemId: next.id,
            crewId: adminMember?.id,
            targetPage: 'intake',
          })
        );
        break;
      }

      case 'reject_project': {
        const reason = payload.rejectionReason.trim();
        if (!reason) {
          throw new Error('Alasan penolakan wajib diisi');
        }
        const adminMember = this.state.crew.find((c) => c.accessRole === 'admin_project');
        const managerMember = this.state.crew.find((c) => c.id === payload.actorCrewId);
        const adminAssignee = adminMember?.id || prev.createdByAdminId || prev.assigneeId;

        // Stop any running timers on this project if any exist
        const activeOnItem = this.state.activeTimers.filter((t) => t.workItemId === prev.id);
        for (const tmr of activeOnItem) {
          this.stopTimer(tmr.id, { autoStopped: true });
        }

        next = {
          ...next,
          loggedSeconds: this.state.workItems[idx]?.loggedSeconds ?? next.loggedSeconds,
          workflowStage: 'rejected_manager',
          projectStatus: 'Rejected',
          kanbanStage: 'backlog',
          status: 'Belum Mulai',
          calendarCoordination: false,
          assigneeId: adminAssignee,
          assigneeIds: [adminAssignee],
          revisionNote: undefined,
          rejectionReason: reason,
          rejectedAt: nowIso,
          rejectedByManagerId: payload.actorCrewId,
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'urgent',
            title: `Project Ditolak Manager: ${next.requestNo || next.code}`,
            message: `${managerMember?.name || 'Manager'} menolak "${next.title}". Alasan: "${reason}"`,
            workItemId: next.id,
            crewId: adminMember?.id,
            targetPage: 'intake',
          })
        );
        break;
      }

      case 'approve_assign': {
        const assignedIds = normalizeAssigneeIds(payload.assigneeId, payload.assigneeIds);
        const assignedNames = assignedIds
          .map((cid) => this.state.crew.find((c) => c.id === cid)?.name)
          .filter(Boolean)
          .join(', ');
        const estHours = Math.max(0.5, Number(payload.estimatedHours) || prev.estimatedHours);
        const perCrew = Number((estHours / Math.max(1, assignedIds.length)).toFixed(1));
        const assignEntry: AssignmentHistoryEntry = {
          id: `ah-${Date.now()}`,
          type: 'assigned',
          fromCrewIds: [],
          toCrewIds: assignedIds,
          actorCrewId: payload.actorCrewId,
          note:
            assignedIds.length > 1
              ? `Ditugaskan secara kolaborasi ke ${assignedNames}`
              : `Ditugaskan ke ${assignedNames || 'Crew'}`,
          createdAt: nowIso,
        };
        next = {
          ...next,
          workflowStage: 'in_execution',
          projectStatus: 'On Progress',
          approvedByManagerId: payload.actorCrewId,
          approvedAt: nowIso,
          assigneeId: assignedIds[0] || payload.assigneeId,
          assigneeIds: assignedIds,
          assignmentHistory: [assignEntry, ...(prev.assignmentHistory || [])].slice(0, 30),
          estimatedHours: estHours,
          difficulty: payload.difficulty || prev.difficulty,
          startDate: payload.startDate || prev.startDate,
          dueDate: payload.dueDate || prev.dueDate,
          dueTime: payload.dueTime || prev.dueTime,
          kanbanStage: 'preprod',
          status: 'Sedang Dikerjakan',
          revisionNote: undefined,
        };
        this.state.workItems[idx] = next;

        const approvedRoute = next.routedManager || routeManagerByDiscipline(next.discipline);
        const loadDesc =
          assignedIds.length > 1
            ? `${estHours} jam total (~${perCrew} jam/kru · ${assignedIds.length} kru)`
            : `${estHours} jam`;
        triggeredNotifications.push(
          this.pushNotification({
            type: next.priority === 'Mendesak' ? 'urgent' : 'update',
            title: `Project Di-Approve & Masuk Crew: ${next.code}`,
            message: `"${next.title}" ditugaskan ke ${assignedNames || 'Crew'} (${loadDesc}, tenggat ${next.dueDate}). Silakan mulai log pekerjaan.`,
            workItemId: next.id,
            crewId: next.assigneeId,
            targetPage: approvedRoute === 'technical_support' ? 'kanban_tech' : 'kanban_video',
          })
        );

        for (const cid of assignedIds) {
          const overloadNotif = this.checkAndNotifyOverload(cid);
          if (overloadNotif) triggeredNotifications.push(overloadNotif);
        }

        this.save();
        return { item: next, triggeredNotifications };
      }

      case 'submit_to_manager': {
        // Auto-stop any active timers for this workItem when crew returns finished work to Manager
        const activeOnItem = this.state.activeTimers.filter((t) => t.workItemId === next.id);
        for (const tmr of activeOnItem) {
          this.stopTimer(tmr.id);
        }
        // Re-read updated loggedSeconds after stopping timers
        const refreshed = this.state.workItems[idx];
        const routed = refreshed.routedManager || routeManagerByDiscipline(refreshed.discipline);
        const managerMember = this.state.crew.find((c) =>
          routed === 'technical_support'
            ? c.accessRole === 'tech_manager'
            : c.accessRole === 'video_manager'
        );
        next = {
          ...refreshed,
          workflowStage: 'pending_handover',
          projectStatus: 'Review',
          kanbanStage: 'review',
          status: 'Review',
          progress: 100,
          handoverNote: payload.handoverNote?.trim() || refreshed.handoverNote || 'Pekerjaan crew selesai & siap direview manager.',
          revisionNote: undefined,
          updatedAt: nowIso,
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'update',
            title: `Selesai dari Crew → Review Manager: ${next.code}`,
            message: `"${next.title}" telah dikembalikan ke ${getManagerTitle(routed)} untuk pemeriksaan akhir dan serah terima ke ${next.clientName || 'Klien'}.`,
            workItemId: next.id,
            crewId: managerMember?.id,
            targetPage: routed === 'technical_support' ? 'handover_tech' : 'handover_video',
          })
        );
        break;
      }

      case 'request_crew_revision': {
        const assignedNames = getItemAssigneeIds(prev)
          .map((cid) => this.state.crew.find((c) => c.id === cid)?.name)
          .filter(Boolean)
          .join(', ');
        const revRoute = prev.routedManager || routeManagerByDiscipline(prev.discipline);
        next = {
          ...next,
          workflowStage: 'in_execution',
          projectStatus: 'Revision',
          kanbanStage: 'production',
          status: 'Sedang Dikerjakan',
          progress: Math.min(prev.progress, 80),
          revisionNote: payload.revisionNote.trim() || 'Perlu penyesuaian hasil sebelum diserahkan ke klien.',
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'urgent',
            title: `Revisi dari Manager untuk Crew: ${next.code}`,
            message: `${assignedNames || 'Crew'}, mohon revisi ${next.code}: "${next.revisionNote}"`,
            workItemId: next.id,
            crewId: next.assigneeId,
            targetPage: revRoute === 'technical_support' ? 'kanban_tech' : 'kanban_video',
          })
        );
        break;
      }

      case 'deliver_to_client': {
        const delRoute = prev.routedManager || routeManagerByDiscipline(prev.discipline);
        next = {
          ...next,
          workflowStage: 'delivered_client',
          projectStatus: 'Completed',
          kanbanStage: 'done',
          status: 'Selesai',
          progress: 100,
          handoverNote: payload.handoverNote?.trim() || prev.handoverNote || 'Final deliverable telah diserahkan ke klien.',
          deliveredToClientAt: nowIso,
          completedAt: nowIso,
        };
        triggeredNotifications.push(
          this.pushNotification({
            type: 'update',
            title: `Diserahkan ke Klien: ${next.code}`,
            message: `Manager telah menyerahkan hasil akhir "${next.title}" kepada ${next.clientName || 'Klien'}.`,
            workItemId: next.id,
            targetPage: delRoute === 'technical_support' ? 'handover_tech' : 'handover_video',
          })
        );
        break;
      }
    }

    this.state.workItems[idx] = next;
    this.save();
    return { item: next, triggeredNotifications };
  }

  public addManualTimeLog(payload: {
    workItemId: string;
    crewId: string;
    hours?: number;
    startTime?: string;
    endTime?: string;
    note?: string;
    workDate?: string;
    date?: string;
  }): { log?: TimeLogEntry; error?: string } {
    const item = this.state.workItems.find((w) => w.id === payload.workItemId);
    if (!item) return { error: 'Pekerjaan tidak ditemukan.' };

    const now = new Date();
    const effectiveDate = payload.workDate || payload.date || now.toISOString().slice(0, 10);
    const parseHm = (val?: string): number | null => {
      if (!val) return null;
      const m = /^(\d{1,2}):(\d{2})$/.exec(val.trim());
      if (!m) return null;
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return hh * 60 + mm;
    };

    const startMin = parseHm(payload.startTime);
    const endMin = parseHm(payload.endTime);

    let durationSeconds = 0;
    let hours = 0;
    let startedAt: Date;
    let endedAt: Date;
    let rangeLabel = '';

    if (payload.startTime || payload.endTime) {
      if (startMin === null || endMin === null || endMin <= startMin) {
        return { error: 'Waktu akhir pengerjaan harus lebih besar dari waktu awal.' };
      }
      const diffMinutes = endMin - startMin;
      durationSeconds = diffMinutes * 60;
      hours = Number((diffMinutes / 60).toFixed(2));
      const pad = (n: number) => String(n).padStart(2, '0');
      const sStr = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
      const eStr = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
      rangeLabel = `${sStr}–${eStr}`;
      startedAt = new Date(`${effectiveDate}T${sStr}:00.000Z`);
      endedAt = new Date(`${effectiveDate}T${eStr}:00.000Z`);
      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
        endedAt = now;
        startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
      }
    } else {
      hours = Number(payload.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        return { error: 'Durasi jam manual harus antara 0.1 hingga 24 jam.' };
      }
      durationSeconds = Math.round(hours * 3600);
      endedAt = payload.workDate || payload.date
        ? new Date(`${effectiveDate}T17:00:00.000Z`)
        : now;
      startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
    }

    item.loggedSeconds += durationSeconds;
    item.updatedAt = now.toISOString();
    if (
      item.status === 'Belum Mulai' &&
      (item.category !== 'project' || item.workflowStage === 'in_execution')
    ) {
      item.status = 'Sedang Dikerjakan';
      if (item.kanbanStage === 'backlog') item.kanbanStage = 'production';
      if (item.category === 'project') item.projectStatus = 'On Progress';
    }

    const baseNote = payload.note?.trim();
    const noteText = baseNote
      ? rangeLabel
        ? `${baseNote} (${rangeLabel})`
        : baseNote
      : rangeLabel
        ? `Input log manual (${rangeLabel} · ${hours} jam)`
        : `Input log manual (${hours} jam)`;

    const log: TimeLogEntry = {
      id: `log-man-${Date.now()}`,
      workItemId: item.id,
      crewId: payload.crewId || item.assigneeId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSeconds,
      note: noteText,
      source: 'manual',
    };

    this.state.timeLogs = [log, ...this.state.timeLogs].slice(0, 150);
    this.save();
    return { log };
  }

  public updateWorkItem(
    id: string,
    patch: Partial<WorkItem>
  ): { item: WorkItem | null; triggeredNotifications: AppNotification[] } {
    const idx = this.state.workItems.findIndex((w) => w.id === id);
    if (idx === -1) return { item: null, triggeredNotifications: [] };

    const prev = this.state.workItems[idx];
    const nowIso = new Date().toISOString();
    const next: WorkItem = {
      ...prev,
      ...patch,
      id: prev.id,
      code: prev.code,
      updatedAt: nowIso,
    };

    if (patch.assigneeIds !== undefined) {
      const normalized = normalizeAssigneeIds(patch.assigneeId || prev.assigneeId, patch.assigneeIds);
      next.assigneeIds = normalized;
      next.assigneeId = normalized[0] || prev.assigneeId;
    } else if (patch.assigneeId !== undefined) {
      next.assigneeId = patch.assigneeId;
      next.assigneeIds = [patch.assigneeId];
    }

    if (patch.discipline && next.category === 'project') {
      next.routedManager = routeManagerByDiscipline(patch.discipline);
      if (patch.discipline !== 'Shooting') {
        next.shootingDate = undefined;
        next.shootingStartTime = undefined;
        next.shootingEndTime = undefined;
      }
    }

    if (patch.clientPhone !== undefined && patch.clientContact === undefined) {
      next.clientContact = patch.clientPhone;
    }
    if (patch.changeNotes !== undefined && patch.description === undefined && !prev.description) {
      next.description = patch.changeNotes;
    }

    // Keep kanbanStage, status, progress & projectStatus automatically synchronized
    if (patch.kanbanStage && !patch.status) {
      if (patch.kanbanStage === 'done') {
        next.status = 'Selesai';
        next.progress = 100;
        next.completedAt = nowIso;
        if (next.category === 'project') {
          next.workflowStage = 'delivered_client';
          next.projectStatus = 'Completed';
          next.deliveredToClientAt = next.deliveredToClientAt || nowIso;
        }
      } else if (patch.kanbanStage === 'review') {
        next.status = 'Review';
        next.progress = Math.max(next.progress, 90);
        if (next.category === 'project') {
          next.workflowStage = 'pending_handover';
          next.projectStatus = 'Review';
        }
      } else if (patch.kanbanStage === 'backlog') {
        next.status = 'Belum Mulai';
        if (next.category === 'project') {
          next.projectStatus =
            next.workflowStage === 'in_execution'
              ? 'On Progress'
              : deriveProjectStatus(next.workflowStage);
        }
      } else {
        next.status = 'Sedang Dikerjakan';
        if (next.category === 'project') {
          if (next.workflowStage === 'pending_handover') {
            next.workflowStage = 'in_execution';
          }
          next.projectStatus = 'On Progress';
        }
      }
    } else if (patch.status && !patch.kanbanStage) {
      if (patch.status === 'Selesai') {
        next.kanbanStage = 'done';
        next.progress = 100;
        next.completedAt = nowIso;
        if (next.category === 'project') next.projectStatus = 'Completed';
      } else if (patch.status === 'Review') {
        next.kanbanStage = 'review';
        if (next.category === 'project') next.projectStatus = 'Review';
      } else if (patch.status === 'Belum Mulai') {
        next.kanbanStage = 'backlog';
        if (next.category === 'project') {
          next.projectStatus = deriveProjectStatus(next.workflowStage);
        }
      } else if (next.kanbanStage === 'backlog' || next.kanbanStage === 'done') {
        next.kanbanStage = 'production';
        if (next.category === 'project') next.projectStatus = 'On Progress';
      }
    } else if (patch.progress !== undefined) {
      if (next.category !== 'project') {
        if (next.progress >= 100) {
          next.status = 'Selesai';
          next.kanbanStage = 'done';
          next.completedAt = next.completedAt || nowIso;
        } else if (next.progress > 0) {
          next.status = 'Sedang Dikerjakan';
          if (next.kanbanStage === 'backlog' || next.kanbanStage === 'done') {
            next.kanbanStage = 'production';
          }
          next.completedAt = undefined;
        } else {
          next.status = 'Belum Mulai';
          next.kanbanStage = 'backlog';
          next.completedAt = undefined;
        }
      } else if (next.workflowStage === 'in_execution') {
        if (next.progress > 0 && next.status === 'Belum Mulai') {
          next.status = 'Sedang Dikerjakan';
          if (next.kanbanStage === 'backlog') next.kanbanStage = 'production';
          next.projectStatus = 'On Progress';
        }
      }
    }

    this.state.workItems[idx] = next;
    const triggeredNotifications: AppNotification[] = [];

    const becameUrgent = next.priority === 'Mendesak' && prev.priority !== 'Mendesak';
    const urgentStageChanged =
      next.priority === 'Mendesak' &&
      (next.kanbanStage !== prev.kanbanStage || next.status !== prev.status);

    if (becameUrgent || urgentStageChanged) {
      const nextRoute = next.routedManager || routeManagerByDiscipline(next.discipline);
      triggeredNotifications.push(
        this.pushNotification({
          type: 'urgent',
          title: `Pembaruan Mendesak: ${next.code}`,
          message: `"${next.title}" kini berstatus ${next.status} (${next.progress}% selesai).`,
          workItemId: next.id,
          crewId: next.assigneeId,
          targetPage:
            next.category === 'project'
              ? nextRoute === 'technical_support'
                ? 'kanban_tech'
                : 'kanban_video'
              : 'tasks',
        })
      );
    }

    const prevIds = getItemAssigneeIds(prev);
    const nextIds = getItemAssigneeIds(next);
    const assigneesChanged =
      prevIds.length !== nextIds.length || prevIds.some((cid, i) => cid !== nextIds[i]);

    if (assigneesChanged) {
      const removedIds = prevIds.filter((cid) => !nextIds.includes(cid));
      const addedIds = nextIds.filter((cid) => !prevIds.includes(cid));

      // Preserve in-progress work: auto-stop & save any active timer of a removed crew member
      for (const removedId of removedIds) {
        const runningTimer = this.state.activeTimers.find(
          (t) => t.workItemId === next.id && t.crewId === removedId
        );
        if (runningTimer) {
          this.stopTimer(runningTimer.id);
        }
      }

      const nameOf = (cid: string) =>
        this.state.crew.find((c) => c.id === cid)?.name || cid;
      const historyType: AssignmentHistoryEntry['type'] =
        addedIds.length > 0 && removedIds.length > 0
          ? 'reassigned'
          : addedIds.length > 0
            ? 'added_collaborator'
            : 'removed_collaborator';

      const historyNote =
        historyType === 'reassigned'
          ? `Dilanjutkan / dialihkan dari ${removedIds.map(nameOf).join(', ')} ke ${addedIds.map(nameOf).join(', ')}`
          : historyType === 'added_collaborator'
            ? `Kolaborasi ditambah: ${addedIds.map(nameOf).join(', ')}`
            : `${removedIds.map(nameOf).join(', ')} selesai dari slot tim (riwayat log tetap tersimpan)`;

      const entry: AssignmentHistoryEntry = {
        id: `ah-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: historyType,
        fromCrewIds: prevIds,
        toCrewIds: nextIds,
        note: historyNote,
        createdAt: nowIso,
      };

      // Refresh loggedSeconds from state in case stopTimer updated it above
      const refreshedLogged = this.state.workItems[idx]?.loggedSeconds ?? next.loggedSeconds;
      next.loggedSeconds = refreshedLogged;
      next.assignmentHistory = [entry, ...(prev.assignmentHistory || [])].slice(0, 30);
      this.state.workItems[idx] = next;
    }

    if (
      assigneesChanged ||
      next.estimatedHours !== prev.estimatedHours ||
      (prev.status === 'Selesai' && next.status !== 'Selesai')
    ) {
      for (const cid of nextIds) {
        const overloadNotif = this.checkAndNotifyOverload(cid);
        if (overloadNotif) triggeredNotifications.push(overloadNotif);
      }
    }

    this.save();
    return { item: next, triggeredNotifications };
  }

  public deleteWorkItem(id: string): boolean {
    const before = this.state.workItems.length;
    this.state.workItems = this.state.workItems.filter((w) => w.id !== id);
    this.state.activeTimers = this.state.activeTimers.filter((t) => t.workItemId !== id);
    const removed = this.state.workItems.length < before;
    if (removed) this.save();
    return removed;
  }

  public startTimer(
    workItemId: string,
    crewId: string,
    note?: string,
    options?: { autoStopAt?: string; timezoneOffsetMinutes?: number }
  ): ActiveTimer | null {
    const workItem = this.state.workItems.find((w) => w.id === workItemId);
    if (!workItem) return null;

    const existing = this.state.activeTimers.find((t) => t.crewId === crewId);
    if (existing) {
      if (existing.workItemId === workItemId) return existing;
      this.stopTimer(existing.id);
    }

    const nowDate = new Date();
    let autoStopAt: string | undefined;
    if (isEditingProject(workItem)) {
      const providedMs = options?.autoStopAt ? new Date(options.autoStopAt).getTime() : NaN;
      if (Number.isFinite(providedMs) && providedMs > nowDate.getTime()) {
        autoStopAt = new Date(providedMs).toISOString();
      } else {
        autoStopAt = computeEditingAutoStopIsoServer(nowDate, options?.timezoneOffsetMinutes);
      }
    }

    const timer: ActiveTimer = {
      id: `tmr-${Date.now()}`,
      workItemId,
      crewId,
      startedAt: nowDate.toISOString(),
      ...(autoStopAt ? { autoStopAt } : {}),
      note: note || `Pengerjaan ${workItem.requestNo || workItem.code}`,
    };
    this.state.activeTimers = [timer, ...this.state.activeTimers];

    if (workItem.status === 'Belum Mulai') {
      workItem.status = 'Sedang Dikerjakan';
      if (workItem.kanbanStage === 'backlog') workItem.kanbanStage = 'production';
      if (workItem.category === 'project' && workItem.workflowStage === 'in_execution') {
        workItem.projectStatus = 'On Progress';
      }
      workItem.updatedAt = nowDate.toISOString();
    }

    this.save();
    return timer;
  }

  public stopTimer(
    timerId: string,
    options?: { endedAt?: Date | string; autoStopped?: boolean }
  ): {
    durationSeconds: number;
    workItemId: string;
    autoStopped: boolean;
    notification?: AppNotification;
  } | null {
    const idx = this.state.activeTimers.findIndex((t) => t.id === timerId);
    if (idx === -1) return null;
    const timer = this.state.activeTimers[idx];
    const startMs = new Date(timer.startedAt).getTime();

    let endedAt = new Date();
    if (options?.endedAt) {
      const parsed = options.endedAt instanceof Date ? options.endedAt : new Date(options.endedAt);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > startMs) {
        endedAt = parsed;
      }
    }

    // Never exceed 16:30 autoStopAt cutoff if the timer already crossed it
    let autoStopped = Boolean(options?.autoStopped);
    if (timer.autoStopAt) {
      const cutoffDate = new Date(timer.autoStopAt);
      if (!Number.isNaN(cutoffDate.getTime()) && endedAt.getTime() >= cutoffDate.getTime()) {
        endedAt = cutoffDate;
        autoStopped = true;
      }
    }

    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startMs) / 1000));

    this.state.activeTimers.splice(idx, 1);

    const item = this.state.workItems.find((w) => w.id === timer.workItemId);
    if (item) {
      item.loggedSeconds += durationSeconds;
      item.updatedAt = endedAt.toISOString();
    }

    const baseNote = timer.note?.trim() || (item ? `Pengerjaan ${item.requestNo || item.code}` : 'Log otomatis');
    const finalNote = autoStopped
      ? baseNote.includes('Auto-stop 16:30')
        ? baseNote
        : `${baseNote} · Auto-stop 16:30`
      : baseNote;

    this.state.timeLogs = [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        workItemId: timer.workItemId,
        crewId: timer.crewId,
        startedAt: timer.startedAt,
        endedAt: endedAt.toISOString(),
        durationSeconds,
        note: finalNote,
        source: 'auto' as const,
        ...(autoStopped ? { autoStopped: true } : {}),
      },
      ...this.state.timeLogs,
    ].slice(0, 150);

    let notification: AppNotification | undefined;
    if (autoStopped && item) {
      const member = this.state.crew.find((c) => c.id === timer.crewId);
      const mins = Math.max(1, Math.round(durationSeconds / 60));
      notification = this.pushNotification({
        type: 'update',
        title: `Auto-Stop 16:30 · ${item.requestNo || item.code}`,
        message: `Timer Editing milik ${member?.name || 'Crew'} untuk "${item.title}" otomatis berhenti pada pukul 16:30 (${mins} menit tersimpan).`,
        workItemId: item.id,
        crewId: timer.crewId,
        targetPage: 'workload',
      });
    }

    this.save();
    return { durationSeconds, workItemId: timer.workItemId, autoStopped, notification };
  }

  public enforceAutoStopTimers(now: Date = new Date()): AppNotification[] {
    const notifications: AppNotification[] = [];
    const dueTimers = this.state.activeTimers.filter((timer) => {
      const item = this.state.workItems.find((w) => w.id === timer.workItemId);
      if (!isEditingProject(item)) return false;
      const cutoffIso =
        timer.autoStopAt ||
        computeEditingAutoStopIsoServer(new Date(timer.startedAt));
      const cutoffMs = new Date(cutoffIso).getTime();
      return Number.isFinite(cutoffMs) && now.getTime() >= cutoffMs;
    });

    for (const timer of dueTimers) {
      const cutoffIso =
        timer.autoStopAt ||
        computeEditingAutoStopIsoServer(new Date(timer.startedAt));
      const res = this.stopTimer(timer.id, {
        endedAt: cutoffIso,
        autoStopped: true,
      });
      if (res?.notification) {
        notifications.push(res.notification);
      }
    }

    return notifications;
  }

  public updateCrewCapacity(crewId: string, maxWeeklyHours: number): {
    crew: CrewMember | null;
    overloadNotif: AppNotification | null;
  } {
    const member = this.state.crew.find((c) => c.id === crewId);
    if (!member) return { crew: null, overloadNotif: null };
    member.maxWeeklyHours = Math.max(10, Math.min(60, Math.round(maxWeeklyHours)));
    const overloadNotif = this.checkAndNotifyOverload(crewId);
    this.save();
    return { crew: member, overloadNotif };
  }

  public updateDashboardConfig(crewId: string, config: Partial<UserDashboardConfig>): UserDashboardConfig {
    const current = this.state.dashboardConfigs[crewId] || {
      crewId,
      widgetOrder: [...DEFAULT_WIDGET_ORDER],
      hiddenWidgets: [],
      density: 'comfortable',
    };
    const next: UserDashboardConfig = {
      ...current,
      ...config,
      crewId,
    };
    this.state.dashboardConfigs[crewId] = next;
    this.save();
    return next;
  }

  public markNotificationRead(id: string): void {
    const n = this.state.notifications.find((item) => item.id === id);
    if (n) {
      n.read = true;
      this.save();
    }
  }

  public markAllNotificationsRead(): void {
    this.state.notifications = this.state.notifications.map((n) => ({ ...n, read: true }));
    this.save();
  }

  public updateAutoReportSettings(patch: Partial<AutoReportSettings>): AutoReportSettings {
    this.state.autoReportSettings = {
      ...this.state.autoReportSettings,
      ...patch,
    };
    this.save();
    return this.state.autoReportSettings;
  }

  public generateMonthlyReport(monthKey = '2026-11', autoGenerated = false): {
    report: MonthlyReportRecord;
    notification: AppNotification;
  } {
    const items = this.state.workItems;
    const totalProjectsCompleted = items.filter(
      (i) => i.category === 'project' && i.status === 'Selesai'
    ).length;
    const totalRoutineCompleted = items.filter(
      (i) => i.category === 'routine' && i.status === 'Selesai'
    ).length;
    const totalFlexibleCompleted = items.filter(
      (i) => i.category === 'flexible' && i.status === 'Selesai'
    ).length;

    const totalTrackedHours = Number(
      (items.reduce((acc, i) => acc + i.loggedSeconds, 0) / 3600).toFixed(1)
    );
    const totalEstimatedHours = Number(
      items.reduce((acc, i) => acc + i.estimatedHours, 0).toFixed(1)
    );

    const overloadIncidents = this.state.crew.filter((member) => {
      const alloc = this.getCrewAllocatedHours(member.id);
      return alloc.total > member.maxWeeklyHours;
    }).length;

    const crewBreakdown = this.state.crew.map((member) => {
      const memberItems = items.filter((i) => getItemAssigneeIds(i).includes(member.id));
      const perCrew = (i: WorkItem) => i.estimatedHours / Math.max(1, getItemAssigneeIds(i).length);
      const projectHours = Number(
        memberItems
          .filter((i) => i.category === 'project')
          .reduce((a, b) => a + perCrew(b), 0)
          .toFixed(1)
      );
      const routineHours = Number(
        memberItems
          .filter((i) => i.category === 'routine')
          .reduce((a, b) => a + perCrew(b), 0)
          .toFixed(1)
      );
      const flexibleHours = Number(
        memberItems
          .filter((i) => i.category === 'flexible')
          .reduce((a, b) => a + perCrew(b), 0)
          .toFixed(1)
      );
      const alloc = this.getCrewAllocatedHours(member.id);
      return {
        crewId: member.id,
        crewName: member.name,
        role: member.role,
        projectHours,
        routineHours,
        flexibleHours,
        completedCount: memberItems.filter((i) => i.status === 'Selesai').length,
        utilizationPct: Math.round((alloc.total / member.maxWeeklyHours) * 100),
      };
    });

    const [yearStr, monthStr] = monthKey.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const monthLabel = `${monthNames[Math.max(0, Number(monthStr) - 1)] || 'November'} ${yearStr || '2026'}`;
    const nowIso = new Date().toISOString();

    const completedItems = items.filter((i) => i.status === 'Selesai');
    const onTimeCount = completedItems.filter((i) => {
      if (!i.completedAt) return true;
      return i.completedAt.slice(0, 10) <= i.dueDate;
    }).length;
    const onTimeRate =
      completedItems.length > 0 ? Math.round((onTimeCount / completedItems.length) * 100) : 94;

    const report: MonthlyReportRecord = {
      id: `rep-${monthKey}-${Date.now()}`,
      monthKey,
      monthLabel,
      generatedAt: nowIso,
      autoGenerated,
      totalProjectsCompleted,
      totalRoutineCompleted,
      totalFlexibleCompleted,
      totalTrackedHours,
      totalEstimatedHours,
      onTimeRate,
      overloadIncidents,
      crewBreakdown,
    };

    this.state.monthlyReports = [
      report,
      ...this.state.monthlyReports.filter((r) => r.monthKey !== monthKey),
    ];
    this.state.autoReportSettings.lastRunAt = nowIso;

    const notification = this.pushNotification({
      type: 'report',
      title: `Laporan Akhir Bulan ${monthLabel} Dibuat`,
      message: `Rekap otomatis mencatatkan ${totalTrackedHours} jam terlacak, ${totalProjectsCompleted} project selesai, dan rasio tepat waktu ${onTimeRate}%.`,
      targetPage: 'analytics',
    });

    this.save();
    return { report, notification };
  }
}
